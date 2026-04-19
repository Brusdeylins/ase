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

/*  classification taxonomy for "project.type.*"  */
export const projectClassification = {
    boxing:    [ "white",     "grey",      "black"      ],
    actors:    [ "person",                 "team"       ],
    solution:  [ "tool",      "app",       "system"     ],
    kind:      [ "prototype", "mvp",       "product"    ],
    structure: [ "bare",      "libraries", "frameworks" ],
    material:  [ "stucco",                 "prefab"     ],
    focus:     [ "spec",      "code",      "test"       ],
    control:   [ "offload",                "keep"       ]
} as const

/*  schema for ".ase/config.yaml"  */
export const configSchema = v.nullish(v.strictObject({
    project: v.optional(v.strictObject({
        id:   v.optional(v.pipe(v.string(), v.minLength(1))),
        name: v.optional(v.pipe(v.string(), v.minLength(1))),
        type: v.optional(v.strictObject({
            boxing:    v.optional(v.picklist(projectClassification.boxing)),
            actors:    v.optional(v.picklist(projectClassification.actors)),
            solution:  v.optional(v.picklist(projectClassification.solution)),
            kind:      v.optional(v.picklist(projectClassification.kind)),
            structure: v.optional(v.picklist(projectClassification.structure)),
            material:  v.optional(v.picklist(projectClassification.material)),
            focus:     v.optional(v.picklist(projectClassification.focus)),
            control:   v.optional(v.picklist(projectClassification.control))
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
        const found   = this.findUpward(process.cwd(), rel)
        this.filename = found ?? path.join(this.gitToplevel() ?? process.cwd(), rel)
        this.doc      = new Document()
        this.schema   = schema ?? null
    }

    /*  upward-walk on filesystem for a file path relative to a start directory  */
    private findUpward (start: string, rel: string): string | null {
        let dir = start
        for (;;) {
            const candidate = path.join(dir, rel)
            if (fs.existsSync(candidate))
                return candidate
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

    /*  retrieve a value at a dotted key, or the root contents if no key given  */
    get (key?: string): unknown {
        if (key === undefined)
            return this.doc.contents
        return this.doc.getIn(key.split("."))
    }

    /*  set a value at a dotted key, creating intermediate maps as needed  */
    set (key: string, value: unknown): void {
        const segments = key.split(".")
        for (let i = 1; i < segments.length; i++) {
            const prefix = segments.slice(0, i)
            const node = this.doc.getIn(prefix, true)
            if (!isMap(node))
                this.doc.setIn(prefix, this.doc.createNode({}))
        }
        this.doc.setIn(segments, value)
        this.validate("strict")
    }

    /*  delete a value at a dotted key  */
    delete (key: string): void {
        this.doc.deleteIn(key.split("."))
    }
}

/*  register CLI command "ase config"  */
const registerConfigCommand = (program: Command): void => {
    const configCmd = program
        .command("config")
        .description("Manage ASE configuration")
        .action((_opts, cmd: Command) => {
            cmd.help()
        })

    /*  register CLI sub-command "ase config get"  */
    configCmd
        .command("get")
        .description("Print the value at a dotted configuration key")
        .argument("<key>", "Configuration key (dotted path)")
        .action((key: string) => {
            const cfg = new Config("config", configSchema)
            cfg.read()
            const v = cfg.get(key)
            if (isMap(v))
                throw new Error(`key "${key}" is not a leaf key`)
            console.log(isScalar(v) ? v.value : v)
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
            console.log(`${key}: ${value}`)
            cfg.set(key, value)
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
                        else
                            table.push([ k, String(isScalar(item.value) ? item.value.value : item.value) ])
                    }
            }
            list(cfg.get(), "")
            console.log(table.toString())
        })

    /*  register CLI sub-command "ase config init"  */
    configCmd
        .command("init")
        .description("Initialize configuration with preset values (vibe|pro)")
        .argument("<type>", "Preset type (vibe|pro)")
        .action((type: string) => {
            const presets: Record<string, Record<string, string>> = {
                vibe: {
                    "project.id":             "example",
                    "project.name":           "Example Project",
                    "project.type.boxing":    "black",
                    "project.type.actors":    "person",
                    "project.type.solution":  "tool",
                    "project.type.kind":      "prototype",
                    "project.type.structure": "libraries",
                    "project.type.material":  "prefab",
                    "project.type.focus":     "spec",
                    "project.type.control":   "offload"
                },
                pro: {
                    "project.id":             "example",
                    "project.name":           "Example Project",
                    "project.type.boxing":    "white",
                    "project.type.actors":    "team",
                    "project.type.solution":  "system",
                    "project.type.kind":      "product",
                    "project.type.structure": "frameworks",
                    "project.type.material":  "stucco",
                    "project.type.focus":     "code",
                    "project.type.control":   "keep"
                }
            }
            const preset = presets[type]
            if (preset === undefined)
                throw new Error(`unknown preset "${type}" (expected: vibe|pro)`)
            const cfg = new Config("config", configSchema)
            cfg.read()
            for (const [ k, v ] of Object.entries(preset))
                cfg.set(k, v)
            cfg.write()
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
}

export default registerConfigCommand

