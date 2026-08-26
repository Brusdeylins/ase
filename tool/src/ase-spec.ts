/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                     from "node:path"
import fs                       from "node:fs"

import { Command }              from "commander"
import { isScalar }             from "yaml"
import { z }                    from "zod"
import sourceCodeError          from "source-code-error"
import type { McpServer }       from "@modelcontextprotocol/sdk/server/mcp.js"
import { SpecBook, renderDiagnostic, renderVerbose, formats, parseOutputSpec } from "@rse/specbook"
import type { Diagnostic, ExportFormat }                                       from "@rse/specbook"

import type Log                 from "./ase-log.js"
import { Config, configSchema } from "./ase-config.js"
import { Task }                 from "./ase-task.js"
import { Artifact }             from "./ase-artifact.js"
import { Meta }                 from "./ase-meta.js"
import { writeStdout }          from "./ase-stdio.js"

/*  reusable functionality: lint and export the SpecBook-based project
    specification, located via the "project.artifact.spec.basedir" and
    "project.artifact.spec.schema" configuration  */
export class Spec {
    /*  resolve the YAML schema configuration file: the configured
        "project.artifact.spec.schema" relative to the project root, or
        the bundled standard "ase-format-specbook.yaml" plugin meta file
        if unset or empty  */
    static configFile (log: Log): string {
        const cfg = new Config("config", configSchema, log)
        cfg.read()
        const val  = cfg.get("project.artifact.spec.schema")
        const file = val === undefined ? "" : String(isScalar(val) ? val.value : val)
        if (file === "")
            return Meta.resolve("ase-format-specbook.yaml")
        return path.resolve(Task.projectRoot(), file)
    }

    /*  create the SpecBook API instance, routing its verbose processing
        messages into the info log if requested, else into the debug log  */
    private static api (log: Log, verbose: boolean): SpecBook {
        return new SpecBook({
            verbose: (cmd, msg) => log.write(verbose ? "info" : "debug", `specbook: ${cmd}: ${renderVerbose(msg)}`)
        })
    }

    /*  render a diagnostic file path relative to the project root,
        keeping paths outside the project (like the bundled schema) as-is  */
    private static relativize (file: string): string {
        const rel = path.relative(Task.projectRoot(), file)
        if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel))
            return file
        return rel.replace(/\\/g, "/")
    }

    /*  lint the specification Markdown files below the "spec" artifact
        base directory against the schema configuration  */
    static async lint (log: Log, verbose = false): Promise<Diagnostic[]> {
        const result = await Spec.api(log, verbose).lint({
            config:  Spec.configFile(log),
            basedir: Artifact.basedir(log, "spec")
        })
        return result.diagnostics.map((d) => ({ ...d, file: Spec.relativize(d.file) }))
    }

    /*  render a diagnostic as a multi-line message with the affected
        source snippet (like the verbose SpecBook CLI), falling back to
        the single-line message when the source file is unreadable or
        empty (as there is no snippet to show)  */
    static render (diagnostic: Diagnostic, colors: boolean): string {
        let code: string
        try {
            code = fs.readFileSync(path.resolve(Task.projectRoot(), diagnostic.file), "utf8")
        }
        catch {
            return `${renderDiagnostic(diagnostic)}\n`
        }
        if (code === "")
            return `${renderDiagnostic(diagnostic)}\n`
        return sourceCodeError({
            message:  diagnostic.message,
            filename: diagnostic.file,
            code,
            line:     diagnostic.line,
            column:   diagnostic.column,
            colors
        })
    }

    /*  export the specification Markdown files below the "spec" artifact
        base directory into the requested formats, one buffer per format  */
    static export (log: Log, formats: ExportFormat[], verbose = false): Promise<Buffer[]> {
        return Spec.api(log, verbose).export({
            config:  Spec.configFile(log),
            basedir: Artifact.basedir(log, "spec"),
            formats
        })
    }
}

/*  CLI command "ase spec"  */
export default class SpecCommand {
    constructor (private log: Log) {}

    /*  register commands  */
    register (program: Command): void {
        /*  register CLI top-level command "ase spec"  */
        const spec = program
            .command("spec")
            .description("Lint and export the SpecBook-based project specification")
            .action(() => {
                spec.outputHelp()
                process.exit(1)
            })

        /*  register CLI sub-command "ase spec lint"  */
        spec
            .command("lint")
            .description("Lint the specification Markdown files against the SpecBook schema configuration")
            .option("-v, --verbose", "print verbose processing information and each diagnostic with its affected source snippet")
            .action(async (opts: { verbose?: boolean }) => {
                const diagnostics = await Spec.lint(this.log, opts.verbose === true)
                for (const diagnostic of diagnostics)
                    await writeStdout(opts.verbose === true ?
                        Spec.render(diagnostic, process.stdout.isTTY === true) :
                        `${renderDiagnostic(diagnostic)}\n`)
                if (diagnostics.length > 0)
                    process.exitCode = 1
            })

        /*  register CLI sub-command "ase spec export"  */
        spec
            .command("export")
            .description("Export the specification Markdown files as JSON, JSON5, YAML, TOON, HTML, PDF, or normalized Markdown")
            .option("-o, --output <[format:]file>",
                "output file (\"-\" for stdout, repeatable), with the format inferred " +
                "from the filename extension unless explicitly prefixed " +
                "(default: \"index.html\" inside the specification base directory)",
                (value: string, previous: string[]) => previous.concat(value), new Array<string>())
            .option("-v, --verbose", "print verbose processing information")
            .action(async (opts: { output: string[], verbose?: boolean }) => {
                const outputs  = (opts.output.length > 0 ? opts.output :
                    [ path.join(Artifact.basedir(this.log, "spec"), "index.html") ]).map(parseOutputSpec)
                const distinct = Array.from(new Set(outputs.map(({ format }) => format)))
                const buffers  = await Spec.export(this.log, distinct, opts.verbose === true)
                for (const { format, output } of outputs) {
                    const data = buffers[distinct.indexOf(format)]
                    if (output === "-")
                        await writeStdout(data)
                    else {
                        await fs.promises.writeFile(output, data)
                        this.log.write("info", `spec: exported specification into "${output}" (${data.length} bytes)`)
                    }
                }
            })
    }
}

/*  render a caught error as an MCP tool error result  */
const mcpToolError = (err: unknown) => ({
    isError: true,
    content: [ { type: "text" as const, text: `ERROR: ${err instanceof Error ? err.message : String(err)}` } ]
})

/*  MCP registration entry point for SpecBook tools  */
export class SpecMCP {
    constructor (private log: Log) {}

    /*  register MCP tools  */
    register (mcp: McpServer): void {
        mcp.registerTool("ase_specbook_lint", {
            title: "ASE SpecBook lint",
            description:
                "Lint the SpecBook specification Markdown files of the project (located via the " +
                "`project.artifact.spec.basedir` configuration) against the SpecBook YAML schema " +
                "configuration (`project.artifact.spec.schema`, defaulting to the bundled `ase-format-specbook.yaml`). " +
                "Returns a `diagnostics` array of `{ file, line, column, message }` objects (with " +
                "project-relative `file`), rendered as bullet points in `text`. With `verbose`, " +
                "each diagnostic additionally carries a multi-line `snippet` rendering with the " +
                "affected source lines, which is also used for `text`. An empty array " +
                "(`text` of `specification valid`) means the specification is valid.",
            inputSchema: {
                verbose: z.boolean().optional()
                    .describe("if true, render each diagnostic with its affected source snippet (default: false)")
            },
            outputSchema: {
                diagnostics: z.array(z.object({
                    file:    z.string().describe("project-relative file path"),
                    line:    z.number().describe("line number (1-based)"),
                    column:  z.number().describe("column number (1-based)"),
                    message: z.string().describe("diagnostic message"),
                    snippet: z.string().optional()
                        .describe("multi-line rendering with the affected source snippet (with `verbose` only)")
                })).describe("lint diagnostics, empty if the specification is valid")
            }
        }, async (args) => {
            try {
                const verbose = args.verbose ?? false
                const diagnostics: Array<Diagnostic & { snippet?: string }> = (await Spec.lint(this.log))
                    .map((d) => verbose ? { ...d, snippet: Spec.render(d, false) } : d)
                const text = diagnostics.length === 0 ? "specification valid" :
                    verbose ?
                        diagnostics.map((d) => d.snippet ?? "").join("").replace(/\n$/, "") :
                        diagnostics.map((d) => `- ${renderDiagnostic(d)}`).join("\n")
                return {
                    structuredContent: { diagnostics },
                    content: [ { type: "text", text } ]
                }
            }
            catch (err: unknown) {
                return mcpToolError(err)
            }
        })

        mcp.registerTool("ase_specbook_export", {
            title: "ASE SpecBook export",
            description:
                "Export the SpecBook specification Markdown files of the project (located via the " +
                "`project.artifact.spec.basedir` configuration) as JSON, JSON5, YAML, TOON, HTML, PDF, " +
                "or normalized Markdown. The result is written to the `output` file (a relative path " +
                "resolves against the project root) if given, else it is returned directly " +
                "(PDF as a base64-encoded resource). The export fails on any lint diagnostic.",
            inputSchema: {
                format: z.enum(formats).optional()
                    .describe("output format (default: inferred from the `output` file extension, else `json`)"),
                output: z.string().optional()
                    .describe("output file path (\"-\" or omitted returns the result directly)")
            }
        }, async (args) => {
            try {
                /*  an explicit format takes the output as a plain file path, while
                    otherwise the output is an "[<format>:]<file>" specification  */
                const spec = args.format !== undefined || args.output === undefined ?
                    { format: args.format ?? "json", output: args.output } :
                    parseOutputSpec(args.output)
                const [ data ] = await Spec.export(this.log, [ spec.format ])
                if (spec.output !== undefined && spec.output !== "-") {
                    await fs.promises.writeFile(path.resolve(Task.projectRoot(), spec.output), data)
                    return { content: [ { type: "text", text: `exported specification into "${spec.output}" (${data.length} bytes)` } ] }
                }
                else if (spec.format === "pdf")
                    return {
                        content: [ {
                            type:     "resource",
                            resource: { uri: "ase:specbook-export.pdf", mimeType: "application/pdf", blob: data.toString("base64") }
                        } ]
                    }
                else
                    return { content: [ { type: "text", text: data.toString("utf8") } ] }
            }
            catch (err: unknown) {
                return mcpToolError(err)
            }
        })
    }
}
