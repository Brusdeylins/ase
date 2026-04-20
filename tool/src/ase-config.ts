/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path                   from "node:path"
import os                     from "node:os"
import fs                     from "node:fs"
import readline               from "node:readline/promises"

import { Command }                                  from "commander"
import { Document, parseDocument, isMap, isScalar } from "yaml"
import { execaSync }                                from "execa"
import * as v                                       from "valibot"
import Table                                        from "cli-table3"

import type Log                                     from "./ase-log.js"

/*  classification taxonomy  */
export const projectClassification = {
    source: {
        ambition:  [ "artist",    "craftsman", "engineer"  ],
        boxing:    [ "white",     "grey",      "black"     ],
        size:      [ "small",     "medium",    "large"     ],
        structure: [ "bare",      "library",   "framework" ]
    },
    process: {
        actors:    [ "person",    "team",      "crew"      ],
        control:   [ "human",     "hitl",      "agent"     ],
        drive:     [ "spec",      "code",      "test"      ]
    },
    result: {
        target:    [ "prototype", "mvp",       "product"   ]
    }
} as const

/*  classification presets  */
export const projectClassificationPresets: Record<string, Record<string, string>> = {
    vibe: {
        "project.id":                "example",
        "project.name":              "Example Project",
        "project.source.ambition":   "engineer",
        "project.source.boxing":     "black",
        "project.source.size":       "small",
        "project.source.structure":  "bare",
        "project.process.actors":    "person",
        "project.process.control":   "agent",
        "project.process.drive":     "spec",
        "project.result.target":     "prototype"
    },
    pro: {
        "project.id":                "example",
        "project.name":              "Example Project",
        "project.source.ambition":   "artist",
        "project.source.boxing":     "white",
        "project.source.size":       "medium",
        "project.source.structure":  "framework",
        "project.process.actors":    "person",
        "project.process.control":   "human",
        "project.process.drive":     "code",
        "project.result.target":     "product"
    },
    industry: {
        "project.id":                "example",
        "project.name":              "Example Project",
        "project.source.ambition":   "craftsman",
        "project.source.boxing":     "grey",
        "project.source.size":       "large",
        "project.source.structure":  "framework",
        "project.process.actors":    "crew",
        "project.process.control":   "hitl",
        "project.process.drive":     "code",
        "project.result.target":     "mvp"
    }
}

/*  configuration scope selector  */
type Scope =
    | { kind: "user"                }
    | { kind: "project"             }
    | { kind: "task",    id: string }
    | { kind: "session", id: string }

/*  parse a raw "--scope" option value into a Scope object  */
const parseScope = (value: string | undefined): Scope => {
    if (value === "user")
        return { kind: "user" }
    else if (value === undefined || value === "project")
        return { kind: "project" }
    const m = /^(session|task):([A-Za-z0-9._-]+)$/.exec(value)
    if (m !== null)
        return { kind: m[1] as "session" | "task", id: m[2] }
    throw new Error(`invalid --scope value "${value}" ` +
        "(expected: \"user\", \"project\", \"task:<id>\", or \"session:<id>\")")
}

/*  schema for ".ase/config.yaml"  */
export const configSchema = v.nullish(v.strictObject({
    project: v.optional(v.strictObject({
        id:      v.optional(v.pipe(v.string(), v.minLength(1))),
        name:    v.optional(v.pipe(v.string(), v.minLength(1))),
        source:  v.optional(v.strictObject({
            ambition:  v.optional(v.picklist(projectClassification.source.ambition)),
            boxing:    v.optional(v.picklist(projectClassification.source.boxing)),
            size:      v.optional(v.picklist(projectClassification.source.size)),
            structure: v.optional(v.picklist(projectClassification.source.structure))
        })),
        process: v.optional(v.strictObject({
            actors:    v.optional(v.picklist(projectClassification.process.actors)),
            control:   v.optional(v.picklist(projectClassification.process.control)),
            drive:     v.optional(v.picklist(projectClassification.process.drive))
        })),
        result:  v.optional(v.strictObject({
            target:    v.optional(v.picklist(projectClassification.result.target))
        }))
    }))
}))

/*  encapsulate read/write access to a "<name>.yaml" configuration file  */
export class Config {
    /*  public state  */
    public  filename: string

    /*  private state  */
    private doc:      Document
    private schema:   v.GenericSchema | null
    private log:      Log

    /*  creation  */
    constructor (
        name:   string,
        schema: v.GenericSchema | undefined,
        log:    Log,
        scope:  Scope = { kind: "project" }
    ) {
        this.filename = this.resolveFilename(name, scope)
        this.doc      = new Document()
        this.schema   = schema ?? null
        this.log      = log
    }

    /*  resolve the per-OS user-scope base directory  */
    private userConfigDir (): string {
        if (process.platform === "darwin")
            /*  macOS  */
            return path.join(os.homedir(), "Library", "Application Support", "ase")
        else if (process.platform === "win32")
            /*  Windows  */
            return path.join(process.env.APPDATA ?? os.homedir(), "ase")
        else {
            /*  Linux  */
            const xdg  = process.env.XDG_CONFIG_HOME
            const base = xdg !== undefined && xdg !== "" ? xdg : path.join(os.homedir(), ".config")
            return path.join(base, "ase")
        }
    }

    /*  resolve the configuration filename based on the selected scope  */
    private resolveFilename (name: string, scope: Scope): string {
        if (scope.kind === "user")
            return path.join(this.userConfigDir(), `${name}.yaml`)
        else if (scope.kind === "project") {
            const rel   = path.join(".ase", `${name}.yaml`)
            const cwd   = process.cwd()
            const top   = this.gitToplevel()
            const found = top !== null ?
                this.findUpward(cwd, top, rel) :
                (fs.existsSync(path.join(cwd, rel)) ? path.join(cwd, rel) : null)
            return found ?? path.join(top ?? cwd, rel)
        }
        else if (scope.kind === "session" || scope.kind === "task") {
            const sub = scope.kind === "session" ? "sessions" : "tasks"
            const top = this.gitToplevel()
            if (top !== null)
                return path.join(top, ".ase", sub, scope.id, `${name}.yaml`)
            else
                return path.join(this.userConfigDir(), sub, scope.id, `${name}.yaml`)
        }
    }

    /*  upward-walk on filesystem for a file path relative to a start directory,
        bounded above (inclusive) by a stop directory  */
    private findUpward (start: string, stop: string, rel: string): string | null {
        let   dir     = fs.realpathSync(start)
        const end     = fs.realpathSync(stop)
        const between = path.relative(end, dir)
        const steps   = between === "" ? 0 : between.split(path.sep).length
        for (let i = 0; i <= steps; i++) {
            const candidate = path.join(dir, rel)
            if (fs.existsSync(candidate))
                return candidate
            const parent = path.dirname(dir)
            if (parent === dir)
                return null
            dir = parent
        }
        return null
    }

    /*  determine the Git top-level directory, if inside a Git repository  */
    private gitToplevel (): string | null {
        try {
            const result = execaSync("git", [ "rev-parse", "--show-toplevel" ], {
                stderr: "ignore"
            })
            return result.stdout.trim() || null
        }
        catch {
            return null
        }
    }

    /*  read configuration file into memory  */
    read (mode: "strict" | "lenient" = "lenient"): void {
        const text = fs.existsSync(this.filename) ? fs.readFileSync(this.filename, "utf8") : ""
        this.doc   = parseDocument(text)
        if (this.doc.errors.length > 0) {
            const msg = `invalid YAML in ${this.filename}: ${this.doc.errors[0].message}`
            if (mode === "strict")
                throw new Error(msg)
            this.log.write("warning", msg)
            this.doc = new Document()
        }
        this.validate(mode)
    }

    /*  write in-memory configuration back to file  */
    write (): void {
        this.validate("strict")
        fs.mkdirSync(path.dirname(this.filename), { recursive: true })
        fs.writeFileSync(this.filename, this.doc.toString({ indent: 4 }), "utf8")
    }

    /*  validate in-memory configuration against the optional schema  */
    private validate (mode: "strict" | "lenient" = "strict"): void {
        if (this.schema === null)
            return
        for (;;) {
            const result = v.safeParse(this.schema, this.doc.toJS())
            if (result.success)
                return
            if (mode === "strict") {
                const issues = result.issues.map((i) => {
                    const dotPath = (i.path ?? []).map((p) => String(p.key)).join(".")
                    return dotPath ? `${dotPath}: ${i.message}` : i.message
                }).join("; ")
                throw new Error(`invalid configuration in ${this.filename}: ${issues}`)
            }
            let progressed = false
            for (const i of result.issues) {
                const segs    = (i.path ?? []).map((p) => String(p.key))
                const dotPath = segs.join(".")
                this.log.write("warning", `invalid entry in ${this.filename}: ${dotPath ? `${dotPath}: ` : ""}${i.message}`)
                if (segs.length > 0) {
                    this.doc.deleteIn(segs)
                    progressed = true
                }
                else
                    /*  root-level issue is structurally unrecoverable: do not wipe
                        the document, let the next strict validate() surface it  */
                    return
            }
            if (!progressed)
                return
        }
    }

    /*  enumerate all full dotted leaf paths from the attached valibot schema  */
    private schemaLeafPaths (): string[][] {
        const unwrap = (s: any): any => {
            while (s !== undefined && s !== null && (s.type === "optional" || s.type === "nullish"
                || s.type === "nullable" || s.type === "undefinedable"))
                s = s.wrapped
            return s
        }
        const walk = (s: any, prefix: string[]): string[][] => {
            const u = unwrap(s)
            if (u !== undefined && u !== null
                && (u.type === "object" || u.type === "strict_object" || u.type === "loose_object")
                && u.entries !== undefined) {
                const paths: string[][] = []
                for (const [ k, sub ] of Object.entries(u.entries))
                    paths.push(...walk(sub, [ ...prefix, k ]))
                return paths
            }
            return [ prefix ]
        }
        return walk(this.schema, [])
    }

    /*  resolve a (possibly trailing-segment) dotted key to its full schema path  */
    resolveKey (key: string): string {
        if (this.schema === null)
            return key
        const segs    = key.split(".")
        const matches = this.schemaLeafPaths().filter((p) => {
            if (p.length < segs.length)
                return false
            for (let i = 0; i < segs.length; i++)
                if (p[p.length - segs.length + i] !== segs[i])
                    return false
            return true
        })
        if (matches.length === 0)
            return key
        if (matches.length > 1)
            throw new Error(`ambiguous key "${key}" matches: ${matches.map((m) => m.join(".")).join(", ")}`)
        return matches[0].join(".")
    }

    /*  retrieve a value at a dotted key, or the root contents if no key given  */
    get (key?: string): unknown {
        if (key === undefined)
            return this.doc.contents
        return this.doc.getIn(this.resolveKey(key).split("."))
    }

    /*  set a value at a dotted key, creating intermediate maps as needed  */
    set (key: string, value: unknown): void {
        const segments = this.resolveKey(key).split(".")
        const next     = this.doc.clone()
        for (let i = 1; i < segments.length; i++) {
            const prefix = segments.slice(0, i)
            const node   = next.getIn(prefix, true)
            if (node !== undefined && !isMap(node))
                throw new Error(`cannot set "${key}": intermediate path "${prefix.join(".")}" is not a map`)
            if (node === undefined)
                next.setIn(prefix, next.createNode({}))
        }
        next.setIn(segments, value)
        const saved = this.doc
        this.doc    = next
        try {
            this.validate("strict")
        }
        catch (err) {
            this.doc = saved
            throw err
        }
    }

    /*  delete a value at a dotted key  */
    delete (key: string): void {
        const next = this.doc.clone()
        next.deleteIn(this.resolveKey(key).split("."))
        const saved = this.doc
        this.doc    = next
        try {
            this.validate("strict")
        }
        catch (err) {
            this.doc = saved
            throw err
        }
    }
}

/*  CLI command "ase config"  */
export default class ConfigCommand {
    constructor (private log: Log) {}

    /*  register commands  */
    register (program: Command): void {
        /*  register CLI top-level command "ase config"  */
        const configCmd = program
            .command("config")
            .option("--scope <scope>",
                "configuration scope: \"user\", \"project\", \"task:<id>\", or \"session:<id>\"",
                "project")
            .description("manage ASE configuration")
            .action((_opts, cmd: Command) => {
                cmd.outputHelp()
                process.exit(1)
            })

        /*  register CLI sub-command "ase config init"  */
        configCmd
            .command("init")
            .description("initialize configuration with preset values (vibe|pro|industry)")
            .argument("<type>", "Preset type (vibe|pro|industry)")
            .action((type: string, _opts: unknown, cmd: Command) => {
                const scope  = parseScope(cmd.optsWithGlobals().scope as string | undefined)
                const preset = projectClassificationPresets[type]
                if (preset === undefined)
                    throw new Error(`unknown preset "${type}" (expected: vibe|pro|industry)`)
                const cfg = new Config("config", configSchema, this.log, scope)
                cfg.read()
                for (const [ k, val ] of Object.entries(preset))
                    cfg.set(k, val)
                cfg.write()
            })

        /*  register CLI sub-command "ase config list"  */
        configCmd
            .command("list")
            .description("list all configured values as flat dotted keys")
            .action((_opts: unknown, cmd: Command) => {
                const scope = parseScope(cmd.optsWithGlobals().scope as string | undefined)
                const cfg   = new Config("config", configSchema, this.log, scope)
                cfg.read()
                const table = new Table({
                    head:  [ "KEY", "VALUE" ],
                    chars: { "mid": "", "left-mid": "", "mid-mid": "", "right-mid": "" },
                    style: { head: [ "blue" ] }
                })
                const list = (node: unknown, prefix: string) => {
                    if (isMap(node))
                        for (const item of node.items) {
                            const k = prefix ? `${prefix}.${item.key}` : String(item.key)
                            if (isMap(item.value))
                                list(item.value, k)
                            else if (!isScalar(item.value))
                                throw new Error(`key "${k}" has unsupported node type`)
                            else
                                table.push([ k, String(item.value.value) ])
                        }
                }
                list(cfg.get(), "")
                process.stdout.write(`${table.toString()}\n`)
            })

        /*  register CLI sub-command "ase config edit"  */
        configCmd
            .command("edit")
            .description("edit configuration file with $EDITOR")
            .action(async (_opts: unknown, cmd: Command) => {
                const scope  = parseScope(cmd.optsWithGlobals().scope as string | undefined)
                const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi"
                const cfg    = new Config("config", configSchema, this.log, scope)
                fs.mkdirSync(path.dirname(cfg.filename), { recursive: true })
                if (!fs.existsSync(cfg.filename))
                    fs.writeFileSync(cfg.filename, "", "utf8")
                const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
                try {
                    for (;;) {
                        execaSync(editor, [ cfg.filename ], { stdio: "inherit" })
                        try {
                            cfg.read("strict")
                            break
                        }
                        catch (err) {
                            const msg = err instanceof Error ? err.message : String(err)
                            this.log.write("error", msg)
                            const ans = (await rl.question("re-edit? [Y/n] ")).trim().toLowerCase()
                            if (ans === "n" || ans === "no")
                                throw err
                        }
                    }
                }
                finally {
                    rl.close()
                }
            })

        /*  register CLI sub-command "ase config get"  */
        configCmd
            .command("get")
            .description("print the value at a dotted configuration key")
            .argument("<key>", "configuration key (dotted path)")
            .action((key: string, _opts: unknown, cmd: Command) => {
                const scope = parseScope(cmd.optsWithGlobals().scope as string | undefined)
                const cfg   = new Config("config", configSchema, this.log, scope)
                cfg.read()
                const val = cfg.get(key)
                if (val === undefined)
                    throw new Error(`key "${key}" is not set`)
                if (isMap(val))
                    throw new Error(`key "${key}" is not a leaf key`)
                process.stdout.write(`${isScalar(val) ? val.value : val}\n`)
            })

        /*  register CLI sub-command "ase config set"  */
        configCmd
            .command("set")
            .description("set the value at a dotted configuration key")
            .argument("<key>",   "configuration key (dotted path)")
            .argument("<value>", "configuration value")
            .action((key: string, value: string, _opts: unknown, cmd: Command) => {
                const scope = parseScope(cmd.optsWithGlobals().scope as string | undefined)
                const cfg   = new Config("config", configSchema, this.log, scope)
                cfg.read()
                cfg.set(key, value)
                cfg.write()
            })
    }
}

