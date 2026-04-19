/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path                   from "node:path"
import fs                     from "node:fs"

import { Command }                                  from "commander"
import { Document, parseDocument, isMap, isScalar } from "yaml"
import { execaSync }                                from "execa"
import * as v                                       from "valibot"
import Table                                        from "cli-table3"

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

/*  encapsulate read/write access to a project-local ".ase/<name>.yaml" file  */
export class Config {
    public  filename: string
    private doc:      Document
    private schema:   v.GenericSchema | null

    constructor (name: string, schema?: v.GenericSchema) {
        const rel     = path.join(".ase", `${name}.yaml`)
        const cwd     = process.cwd()
        const top     = this.gitToplevel()
        const found   = top !== null ?
            this.findUpward(cwd, top, rel) :
            (fs.existsSync(path.join(cwd, rel)) ? path.join(cwd, rel) : null)
        this.filename = found ?? path.join(top ?? cwd, rel)
        this.doc      = new Document()
        this.schema   = schema ?? null
    }

    /*  upward-walk on filesystem for a file path relative to a start directory,
        bounded above (inclusive) by a stop directory  */
    private findUpward (start: string, stop: string, rel: string): string | null {
        let dir = start
        for (;;) {
            const candidate = path.join(dir, rel)
            if (fs.existsSync(candidate))
                return candidate
            if (dir === stop)
                return null
            const parent = path.dirname(dir)
            if (parent === dir)
                return null
            dir = parent
        }
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
    read (): void {
        const text = fs.existsSync(this.filename) ? fs.readFileSync(this.filename, "utf8") : ""
        this.doc   = parseDocument(text)
        this.validate("lenient")
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
                process.stderr.write(`ase: warning: invalid entry in ${this.filename}: ${dotPath ? `${dotPath}: ` : ""}${i.message}\n`)
                if (segs.length > 0) {
                    this.doc.deleteIn(segs)
                    progressed = true
                }
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
            const node = next.getIn(prefix, true)
            if (!isMap(node))
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
        this.doc.deleteIn(this.resolveKey(key).split("."))
    }
}

/*  register CLI command "ase config"  */
const registerConfigCommand = (program: Command): void => {
    const configCmd = program
        .command("config")
        .description("Manage ASE configuration")
        .action((_opts, cmd: Command) => {
            cmd.outputHelp()
            process.exit(1)
        })

    /*  register CLI sub-command "ase config init"  */
    configCmd
        .command("init")
        .description("Initialize configuration with preset values (vibe|pro|industry)")
        .argument("<type>", "Preset type (vibe|pro|industry)")
        .action((type: string) => {
            const preset = projectClassificationPresets[type]
            if (preset === undefined)
                throw new Error(`unknown preset "${type}" (expected: vibe|pro|industry)`)
            const cfg = new Config("config", configSchema)
            cfg.read()
            for (const [ k, val ] of Object.entries(preset))
                cfg.set(k, val)
            cfg.write()
        })

    /*  register CLI sub-command "ase config list"  */
    configCmd
        .command("list")
        .description("List all configured values as flat dotted keys")
        .action(() => {
            const cfg = new Config("config", configSchema)
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
        .description("Edit configuration file with $EDITOR")
        .action(() => {
            const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi"
            const cfg    = new Config("config", configSchema)
            fs.mkdirSync(path.dirname(cfg.filename), { recursive: true })
            if (!fs.existsSync(cfg.filename))
                fs.writeFileSync(cfg.filename, "", "utf8")
            execaSync(editor, [ cfg.filename ], { stdio: "inherit" })
            cfg.read()
        })

    /*  register CLI sub-command "ase config get"  */
    configCmd
        .command("get")
        .description("Print the value at a dotted configuration key")
        .argument("<key>", "Configuration key (dotted path)")
        .action((key: string) => {
            const cfg = new Config("config", configSchema)
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
        .description("Set the value at a dotted configuration key")
        .argument("<key>",   "Configuration key (dotted path)")
        .argument("<value>", "Configuration value")
        .action((key: string, value: string) => {
            const cfg = new Config("config", configSchema)
            cfg.read()
            process.stdout.write(`${key}: ${value}\n`)
            cfg.set(key, value)
            cfg.write()
        })
}

export default registerConfigCommand

