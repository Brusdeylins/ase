/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  CLI subcommand wiring + renderArchReport helper for the arch-report pipeline  */

import fs                                     from "node:fs/promises"
import path                                   from "node:path"

import { Command }                            from "commander"

import type Log                               from "../ase-log.js"
import { discover, resolveBasename }          from "./discover.js"
import { Parser }                             from "./parse.js"
import { extractSymbols }                     from "./extract.js"
import { clusterize }                         from "./cluster.js"
import { resolveEdges }                       from "./resolve.js"
import { resolveInheritDocs }                 from "./inherit-doc.js"
import { renderJson }                         from "./render-json.js"
import { renderClusterMd, renderIndexMd }     from "./render/md.js"
import { renderClusterHtml, renderIndexHtml } from "./render/html.js"
import type { ArchReportOpts, Language, ArchSymbol } from "./types.js"

/*  filename sanitizer for cluster slugs  */
const safeFile = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_")

/*  result returned by the renderArchReport helper  */
export interface ArchReportResult {
    outputDir: string
    files:     string[]
    stats:     { clusters: number; symbols: number; docDebt: number }
}

/*  scope-root prefix extracted from a path-or-glob argument  */
const resolveScopeRoot = (pathOrGlob: string): string => {
    const cut    = pathOrGlob.search(/[*?[]/)
    const prefix = cut < 0 ? pathOrGlob : pathOrGlob.slice(0, cut)
    return prefix.replace(/\/+$/, "")
}

/*  pure orchestration helper: discover -> parse -> extract -> cluster ->
    resolve -> render. Writes outputs into a sibling `.tmp` directory and
    atomically renames it on success so partial output never lingers.  */
export const renderArchReport = async (opts: ArchReportOpts): Promise<ArchReportResult> => {
    const queriesDir = opts.queriesDir ??
        path.resolve(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report", "queries")
    const wasmDir    = path.resolve(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report", "wasm")
    const today      = new Date().toISOString().slice(0, 10)
    const basename   = resolveBasename(opts.pathOrGlob)
    const outputDir  = path.resolve(opts.output !== "" ? opts.output : path.join("docs", "reports", `${basename}-${today}`))
    const tmpDir     = `${outputDir}.tmp`
    await fs.rm(tmpDir,    { recursive: true, force: true })
    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(path.join(tmpDir, "_meta"), { recursive: true })

    /*  discover + parse + extract per (lang, file)  */
    const { files } = await discover(opts.pathOrGlob, opts.lang)
    const parser    = new Parser(wasmDir)
    const allSyms: { lang: Language; syms: ArchSymbol[] }[] = []
    for (const lang of Object.keys(files) as Language[]) {
        const grammar  = await parser.getGrammar(lang)
        const fileList = files[lang] ?? []
        for (const f of fileList) {
            const tree = await parser.parse(f, lang)
            const syms = await extractSymbols(tree, grammar, lang, f, queriesDir)
            allSyms.push({ lang, syms })
        }
    }

    /*  cluster per language against the scope root.  Cluster names are
        derived from the *absolute* `s.file` paths so `path.relative()`
        inside `clusterize()` has a well-defined absolute second argument;
        only AFTER clustering do we rewrite `s.file` to a path relative
        to the scope root for portable api.json / rendered pages  */
    const scopeRoot = path.resolve(resolveScopeRoot(opts.pathOrGlob))
    const byLang    = new Map<Language, ArchSymbol[]>()
    for (const { lang, syms } of allSyms) {
        const arr = byLang.get(lang) ?? []
        arr.push(...syms)
        byLang.set(lang, arr)
    }
    const clusters = [ ...byLang ]
        .flatMap(([ lang, syms ]) => clusterize(syms, scopeRoot, lang))
        .sort((a, b) => a.name.localeCompare(b.name))
    /*  rewrite each symbol's `file` field from the absolute path
        produced by glob into a path relative to the scope root, so
        api.json and the rendered pages stay portable across machines
        (no `/Users/<somebody>/...` leaking into the report)  */
    for (const c of clusters)
        for (const s of c.symbols) {
            const rel = path.relative(scopeRoot, s.file)
            s.file = rel === "" ? path.basename(s.file) : rel
        }

    /*  resolve `{@inheritDoc}` placeholders across the full symbol set
        before downstream consumers (edges, doc-debt, renderers) read docs  */
    resolveInheritDocs(clusters)

    /*  resolve edges + assemble doc-debt list (covers both symbol-level
        and member-level missing docs; member entries use the
        `Symbol#member` FQN form so cluster pages can match them by
        splitting on `#` and looking up the symbol part)  */
    const { edges, unresolved } = resolveEdges(clusters)
    const docDebt = clusters.flatMap((c) => c.symbols.flatMap((s) => {
        const entries: { fqn: string; file: string; line: number }[] = []
        if (s.doc === null)
            entries.push({ fqn: s.fqn, file: s.file, line: s.line })
        for (const m of s.members)
            if (m.doc === null)
                entries.push({ fqn: `${s.fqn}#${m.name}`, file: s.file, line: m.line })
        return entries
    }))

    /*  build the canonical api.json shape  */
    const api = renderJson({
        scope:     opts.pathOrGlob,
        languages: [ ...byLang.keys() ].sort(),
        clusters,
        edges,
        docDebt,
        unresolved
    })

    /*  emit api.json + unresolved.md into _meta/  */
    const written: string[] = []
    await fs.writeFile(path.join(tmpDir, "_meta", "api.json"), JSON.stringify(api, null, 2))
    written.push(path.join(outputDir, "_meta", "api.json"))
    await fs.writeFile(path.join(tmpDir, "_meta", "unresolved.md"),
        unresolved.length === 0 ?
            "_no unresolved external references_\n" :
            unresolved.map((u) => `- \`${u.ref}\` referenced from \`${u.from}\``).join("\n") + "\n")
    written.push(path.join(outputDir, "_meta", "unresolved.md"))

    /*  emit per-format rendered files  */
    const wantMd   = opts.format === "md"   || opts.format === "both"
    const wantHtml = opts.format === "html" || opts.format === "both"
    if (wantMd) {
        await fs.writeFile(path.join(tmpDir, "index.md"), renderIndexMd(api))
        written.push(path.join(outputDir, "index.md"))
        for (const c of clusters) {
            const file = `${safeFile(c.name)}.md`
            await fs.writeFile(path.join(tmpDir, file), renderClusterMd(c, api))
            written.push(path.join(outputDir, file))
        }
    }
    if (wantHtml) {
        await fs.writeFile(path.join(tmpDir, "index.html"), renderIndexHtml(api))
        written.push(path.join(outputDir, "index.html"))
        for (const c of clusters) {
            const file = `${safeFile(c.name)}.html`
            await fs.writeFile(path.join(tmpDir, file), renderClusterHtml(c, api))
            written.push(path.join(outputDir, file))
        }
    }

    /*  atomically swap the temp tree into place  */
    await fs.rename(tmpDir, outputDir)
    return {
        outputDir,
        files: written,
        stats: {
            clusters: clusters.length,
            symbols:  clusters.reduce((n, c) => n + c.symbols.length, 0),
            docDebt:  docDebt.length
        }
    }
}

/*  command-line handling  */
export default class ArchReportCommand {
    constructor (private log: Log) {}

    /*  register commands  */
    register (program: Command): void {
        program
            .command("arch-report")
            .description("generate a deterministic architecture report for a code scope")
            .argument("<path-or-glob>", "source scope")
            .option("--lang <lang>",   "language filter or \"auto\"", "auto")
            .option("--output <dir>",  "output directory")
            .option("--format <fmt>",  "\"md\", \"html\", or \"both\"", "both")
            .option("--config <file>", "cluster overrides (YAML or JSON)")
            .action(async (pathOrGlob: string, flags: { lang: Language | "auto"; output?: string; format: "md" | "html" | "both"; config?: string }) => {
                try {
                    const result = await renderArchReport({
                        pathOrGlob,
                        lang:   flags.lang,
                        output: flags.output ?? "",
                        format: flags.format,
                        config: flags.config
                    })
                    if (flags.format === "md" || flags.format === "both")
                        process.stdout.write(`Report: ${path.join(result.outputDir, "index.md")}\n`)
                    if (flags.format === "html" || flags.format === "both")
                        process.stdout.write(`Report: ${path.join(result.outputDir, "index.html")}\n`)
                }
                catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err)
                    this.log.write("error", `arch-report: ${message}`)
                    process.exit(1)
                }
            })
    }
}
