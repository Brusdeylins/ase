/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  CLI subcommand wiring + renderArchReport helper for the arch-report pipeline  */

import fs                                     from "node:fs/promises"
import path                                   from "node:path"

import { Command }                            from "commander"
import { z }                                  from "zod"
import { McpServer }                          from "@modelcontextprotocol/sdk/server/mcp.js"

import type Log                               from "../ase-log.js"
import { discover, resolveBasename, findDiscoveryRoot, findFilesByTypeNames } from "./discover.js"
import { Parser }                             from "./parse.js"
import { extractSymbols, extractImports }     from "./extract.js"
import { clusterize }                         from "./cluster.js"
import { resolveEdges }                       from "./resolve.js"
import { resolveInheritDocs }                 from "./inherit-doc.js"
import { renderJson }                         from "./render-json.js"
import { renderArc42 }                        from "./render/arc42/index.js"
import { collectProjectMeta }                 from "./project-meta.js"
import type { RenderContext }                 from "./render/context.js"
import { computeCoupling }                    from "./metrics/coupling.js"
import { computeAllMartin }                   from "./metrics/martin.js"
import { computeDocCoverage, computeAggregateDocCoverage } from "./metrics/doc-coverage.js"
import { computeShortlist }                   from "./metrics/shortlist.js"
import { computeInheritance }                 from "./metrics/inheritance.js"
import { tarjanSCC, feedbackArcSet, layerAssignment }      from "./graph/index.js"
import type { CycleReport }                   from "./render/cycles.js"
import type { ArchReportOpts, Language, ArchSymbol, ArchFile } from "./types.js"

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
    const allSyms:  { lang: Language; syms: ArchSymbol[] }[] = []
    const archFiles: ArchFile[] = []
    const parseFiles = async (perLang: Partial<Record<Language, string[]>>): Promise<void> => {
        for (const lang of Object.keys(perLang) as Language[]) {
            const grammar  = await parser.getGrammar(lang)
            for (const f of perLang[lang] ?? []) {
                const tree    = await parser.parse(f, lang)
                const syms    = await extractSymbols(tree, grammar, lang, f, queriesDir)
                const imports = extractImports(tree, lang)
                allSyms.push({ lang, syms })
                archFiles.push({ path: f, language: lang, imports })
            }
        }
    }
    await parseFiles(files)

    /*  Auto-scope expansion: in-scope code that references types
        living *outside* the user's scope (e.g. an `adapter/` package
        implementing a sibling `interfaces/` API) would otherwise leave
        those targets unresolved, deflate Martin Abstractness to zero
        across the entire report, and put the cluster page burden on
        the user to widen their scope manually.  Instead, after the
        initial pass we collect every heritage target that did not
        resolve internally and try to locate its source file in a
        wider "discovery root" (walked upward from the scope until a
        project marker — `pom.xml`/`build.gradle`/`package.json`/...
        is hit).  Files we find by basename match get parsed + their
        symbols joined to the primary set; `clusterize()` then
        naturally places them in sibling clusters via its existing
        `../` strip logic.  No-op when no project marker is found
        within the ascent cap (auto-expand stays a *helpful default*,
        never a surprise).  */
    const scopeRoot = path.resolve(resolveScopeRoot(opts.pathOrGlob))
    const discoveryRoot = await findDiscoveryRoot(scopeRoot)
    if (discoveryRoot !== scopeRoot) {
        const inScopeNames = new Set<string>()
        for (const { syms } of allSyms)
            for (const s of syms)
                inScopeNames.add(s.name)
        const unresolvedHeritage = new Set<string>()
        for (const { syms } of allSyms)
            for (const s of syms)
                for (const ref of [ ...s.extends, ...s.implements ])
                    if (!inScopeNames.has(ref))
                        unresolvedHeritage.add(ref)
        if (unresolvedHeritage.size > 0) {
            const auxFiles = await findFilesByTypeNames(
                discoveryRoot, unresolvedHeritage, scopeRoot, opts.lang)
            const auxCount = Object.values(auxFiles).reduce(
                (n, list) => n + (list?.length ?? 0), 0)
            if (auxCount > 0)
                process.stderr.write(`arch-report: auto-expanded scope: pulled ${auxCount} file${auxCount === 1 ? "" : "s"} from ${discoveryRoot} to resolve heritage targets\n`)
            await parseFiles(auxFiles)
        }
    }

    /*  cluster per language against the scope root.  Cluster names are
        derived from the *absolute* `s.file` paths so `path.relative()`
        inside `clusterize()` has a well-defined absolute second argument;
        only AFTER clustering do we rewrite `s.file` to a path relative
        to the scope root for portable api.json / rendered pages  */
    const byLang    = new Map<Language, ArchSymbol[]>()
    for (const { lang, syms } of allSyms) {
        const arr = byLang.get(lang) ?? []
        arr.push(...syms)
        byLang.set(lang, arr)
    }
    const clusters = [ ...byLang ]
        .flatMap(([ lang, syms ]) => clusterize(syms, scopeRoot, lang))
        .sort((a, b) => a.name.localeCompare(b.name))
    /*  Single pass over every cluster/symbol that does three things
        the pipeline used to do as three independent traversals: (a)
        rewrite each symbol's absolute glob path to a path relative
        to the scope root (so api.json + the rendered pages stay
        portable across machines — no `/Users/<somebody>/...`
        leaking out); (b) accumulate the total LOC for the index
        stats panel; (c) assemble the doc-debt list with both
        symbol-level and member-level missing-doc entries (member
        entries use the `Symbol#member` FQN form so cluster pages
        can match them by splitting on `#`).  archFiles undergo
        the same path normalisation in the same step.  */
    const docDebt: { fqn: string; file: string; line: number }[] = []
    let totalLoc = 0
    for (const c of clusters)
        for (const s of c.symbols) {
            const rel = path.relative(scopeRoot, s.file)
            s.file = rel === "" ? path.basename(s.file) : rel
            totalLoc += s.loc
            if (s.doc === null)
                docDebt.push({ fqn: s.fqn, file: s.file, line: s.line })
            for (const m of s.members)
                if (m.doc === null)
                    docDebt.push({ fqn: `${s.fqn}#${m.name}`, file: s.file, line: m.line })
        }
    for (const af of archFiles) {
        const rel = path.relative(scopeRoot, af.path)
        af.path = rel === "" ? path.basename(af.path) : rel
    }

    /*  resolve `{@inheritDoc}` placeholders across the full symbol set
        before downstream consumers (edges, doc-debt, renderers) read docs  */
    resolveInheritDocs(clusters)

    /*  resolve edges  */
    const { edges, unresolved } = resolveEdges(clusters)

    /*  build the canonical api.json shape  */
    archFiles.sort((a, b) => a.path.localeCompare(b.path))
    const api = renderJson({
        scope:     opts.pathOrGlob,
        languages: [ ...byLang.keys() ].sort(),
        clusters,
        archFiles,
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
            unresolved.map((u) => `- [${u.kind}] \`${u.ref}\` referenced from \`${u.from}\``).join("\n") + "\n")
    written.push(path.join(outputDir, "_meta", "unresolved.md"))

    /*  build the per-report RenderContext that every renderer call
        consumes — pure aggregation of the metrics/graph modules so
        each renderer stays declarative.  */
    const coupling     = computeCoupling(clusters, archFiles)
    const martin       = computeAllMartin(clusters, coupling)
    const docCovPerCluster = new Map<string, ReturnType<typeof computeDocCoverage>>()
    for (const c of clusters)
        docCovPerCluster.set(c.name, computeDocCoverage(c))
    const docCovAggregate  = computeAggregateDocCoverage(clusters)
    /*  cluster-level graph for cycle + layering computations  */
    const clusterNodes = clusters.map((c) => c.name)
    const clusterEdges = edges.map((e) => ({ from: e.from, to: e.to }))
    const sccs   = tarjanSCC(clusterNodes, clusterEdges)
    const layers = layerAssignment(clusterNodes, clusterEdges)
    const sortedClusterNames = [ ...layers.sccOrder ]
        .flatMap((sccIdx) => [ ...layers.sccs[sccIdx] ].sort())
    /*  cycles: keep SCCs with >= 2 members, compute FAS per group  */
    const cycleReport: CycleReport = {
        cycles: sccs
            .filter((scc) => scc.length >= 2)
            .map((members) => {
                const inGroup = new Set(members)
                const subEdges = clusterEdges.filter((e) =>
                    inGroup.has(e.from) && inGroup.has(e.to))
                return { members: [ ...members ].sort(), cut: feedbackArcSet(members, subEdges) }
            })
    }
    const allInScopeSymbols = new Set<string>()
    for (const c of clusters)
        for (const s of c.symbols)
            allInScopeSymbols.add(s.name)
    /*  Architectural-debt shortlist + per-class inheritance
        metrics — pure derivations from the data above, no extra
        AST work required.  */
    const shortlist   = computeShortlist(clusters, coupling, martin)
    const inheritance = computeInheritance(clusters)
    const ctx: RenderContext = {
        coupling,
        martin,
        docCovPerCluster,
        docCovAggregate,
        cycleReport,
        sortedClusterNames,
        layerOfCluster: layers.layerOfNode,
        allInScopeSymbols,
        totalLoc,
        shortlist,
        inheritance
    }

    /*  collect project metadata for arc42 auto-fill chapters
        (1, 2, 7, 8, 9) — uses scopeRoot for upward manifest discovery  */
    const meta = await collectProjectMeta(scopeRoot)

    /*  emit the arc42 documentation as one index.md / index.html
        with all 12 chapters inline; help text and auto-fill are
        produced by tool/src/ase-arch-report/render/arc42/  */
    const arc42 = await renderArc42(api, ctx, meta, opts, tmpDir)
    for (const f of arc42.files) {
        const rel = path.relative(tmpDir, f)
        written.push(path.join(outputDir, rel))
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
            .description("generate a deterministic arc42 architecture documentation for a code scope")
            .argument("<path-or-glob>", "source scope")
            .option("--lang <lang>",        "language filter or \"auto\"", "auto")
            .option("--output <dir>",       "output directory")
            .option("--format <fmt>",       "\"md\", \"html\", or \"both\"", "both")
            .option("--report-lang <lang>", "report language: \"de\" or \"en\"", "en")
            .option("--config <file>",      "cluster overrides (YAML or JSON)")
            .action(async (pathOrGlob: string, flags: { lang: Language | "auto"; output?: string; format: "md" | "html" | "both"; reportLang: "de" | "en"; config?: string }) => {
                try {
                    const result = await renderArchReport({
                        pathOrGlob,
                        lang:       flags.lang,
                        output:     flags.output ?? "",
                        format:     flags.format,
                        reportLang: flags.reportLang,
                        config:     flags.config
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

/*  MCP registration entry point for arch-report tools  */
export class ArchReportMCP {
    register (mcp: McpServer): void {
        mcp.registerTool("arch_report", {
            title:       "ASE arch report",
            description:
                "Generate a deterministic arc42 architecture documentation (Markdown " +
                "and/or HTML) for a code scope. Pass `pathOrGlob`, optional `lang`, " +
                "`output`, `format` ('md' | 'html' | 'both'), `reportLang` ('de' | 'en'), " +
                "and `config`. Returns the absolute output directory, the list of written " +
                "files, and basic stats. The report follows the standard arc42 12-chapter " +
                "layout with the official arc42 help texts inline; ten of twelve chapters " +
                "are auto-filled from project-metadata detection (manifest files, git " +
                "authors, ADR scan, deployment artefacts) and from the source-code " +
                "analysis pipeline (cluster diagrams, class diagrams, metrics, doc debt).",
            inputSchema: {
                pathOrGlob: z.string()
                    .describe("source scope: directory or glob pattern"),
                lang: z.enum([
                    "auto", "java", "typescript", "javascript", "python",
                    "go", "rust", "kotlin", "csharp", "c", "cpp"
                ]).default("auto")
                    .describe("language filter; 'auto' detects by file extension"),
                output: z.string().default("")
                    .describe("output directory; empty string applies the default docs/reports/<basename>-<date>/"),
                format: z.enum([ "md", "html", "both" ]).default("both")
                    .describe("which renderers to run"),
                reportLang: z.enum([ "de", "en" ]).default("en")
                    .describe("report language: \"de\" (German) or \"en\" (English)"),
                config: z.string().optional()
                    .describe("path to a YAML or JSON file with cluster overrides")
            }
        }, async (args) => {
            try {
                const result = await renderArchReport({
                    pathOrGlob: args.pathOrGlob,
                    lang:       args.lang,
                    output:     args.output,
                    format:     args.format,
                    reportLang: args.reportLang,
                    config:     args.config
                })
                return {
                    content: [ { type: "text", text: JSON.stringify(result, null, 2) } ]
                }
            }
            catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return {
                    isError: true,
                    content: [ { type: "text", text: `arch_report: FAILED: ${message}` } ]
                }
            }
        })
    }
}
