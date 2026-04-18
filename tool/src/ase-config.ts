/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import os                     from "node:os"
import path                   from "node:path"
import fs                     from "node:fs"

import type { CommandModule } from "yargs"
import { parseDocument, isMap, isScalar } from "yaml"

interface ConfigArgs {
    debug?: boolean
    query?: string
    _:      (string | number)[]
    $0:     string
}

const configCommand: CommandModule<object, ConfigArgs> = {
    command: "config [query]",
    describe: "Manage ASE configuration",
    builder: (yargs) => {
        return yargs
            .positional("query", {
                type:     "string",
                describe: "Configuration query (none, <key>, or <key>=<value>)"
            })
    },
    handler: (argv) => {
        if (argv.debug)
            console.log("DEBUG: config command", argv)
        const query = argv.query

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
    }
}

export default configCommand

