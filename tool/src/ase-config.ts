/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import os                     from "node:os"
import path                   from "node:path"
import fs                     from "node:fs"

import { Command }                        from "commander"
import { parseDocument, isMap, isScalar } from "yaml"

import type { GlobalOpts }                from "./ase.js"

const registerConfigCommand = (program: Command): void => {
    program
        .command("config")
        .description("Manage ASE configuration")
        .argument("[query]", "Configuration query (none, <key>, or <key>=<value>)")
        .action((query: string | undefined, _opts, cmd: Command) => {
            const debug = cmd.optsWithGlobals<GlobalOpts>().debug
            if (debug)
                console.log("DEBUG: config command", { query })

            const filename = path.join(os.homedir(), ".ase.yaml")
            const text = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : ""
            const doc = parseDocument(text)

            if (!query) {
                /*  list all values as flat dotted keys  */
                const list = (node: unknown, prefix: string) => {
                    if (isMap(node))
                        for (const item of node.items) {
                            const key = prefix ? `${prefix}.${item.key}` : String(item.key)
                            if (isMap(item.value))
                                list(item.value, key)
                            else
                                console.log(`${key} = ${isScalar(item.value) ? item.value.value : item.value}`)
                        }
                }
                list(doc.contents, "")
            }
            else if (query.includes("=")) {
                const [ key, ...valueParts ] = query.split("=")
                const value = valueParts.join("=")
                console.log(`Setting configuration: ${key} = ${value}`)
                const segments = key.split(".")
                for (let i = 1; i < segments.length; i++) {
                    const prefix = segments.slice(0, i)
                    const node = doc.getIn(prefix, true)
                    if (!isMap(node))
                        doc.setIn(prefix, doc.createNode({}))
                }
                doc.setIn(segments, value)
                fs.writeFileSync(filename, doc.toString(), "utf8")
            }
            else {
                const value = doc.getIn(query.split("."))
                console.log(value)
            }
        })
}

export default registerConfigCommand

