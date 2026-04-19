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

import type { GlobalOpts }                          from "./ase.js"

/*  encapsulate read/write access to a project-local ".ase/<name>.yaml" file  */
export class Config {
    public  filename: string
    private doc:      Document

    constructor (name: string) {
        const rel     = path.join(".ase", `${name}.yaml`)
        const found   = this.findUpward(process.cwd(), rel)
        this.filename = found ?? path.join(this.gitToplevel() ?? process.cwd(), rel)
        this.doc      = new Document()
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
    }

    /*  write in-memory configuration back to file  */
    write (): void {
        fs.mkdirSync(path.dirname(this.filename), { recursive: true })
        fs.writeFileSync(this.filename, this.doc.toString({ indent: 4 }), "utf8")
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
    }

    /*  delete a value at a dotted key  */
    delete (key: string): void {
        this.doc.deleteIn(key.split("."))
    }
}

const registerConfigCommand = (program: Command): void => {
    program
        .command("config")
        .description("Manage ASE configuration")
        .argument("[key]",   "Configuration key (dotted path)")
        .argument("[value]", "Configuration value (to set)")
        .action((key: string | undefined, value: string | undefined, _opts, cmd: Command) => {
            const debug = cmd.optsWithGlobals<GlobalOpts>().debug
            if (debug)
                console.log("DEBUG: config command", { key, value })

            const cfg = new Config("config")
            cfg.read()

            if (key === undefined) {
                /*  list all values as flat dotted keys  */
                const list = (node: unknown, prefix: string) => {
                    if (isMap(node))
                        for (const item of node.items) {
                            const k = prefix ? `${prefix}.${item.key}` : String(item.key)
                            if (isMap(item.value))
                                list(item.value, k)
                            else
                                console.log(`${k}: ${isScalar(item.value) ? item.value.value : item.value}`)
                        }
                }
                list(cfg.get(), "")
            }
            else if (value !== undefined) {
                console.log(`${key}: ${value}`)
                cfg.set(key, value)
                cfg.write()
            }
            else {
                const v = cfg.get(key)
                console.log(v)
            }
        })
}

export default registerConfigCommand

