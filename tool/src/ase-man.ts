/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                 from "node:path"
import fs                   from "node:fs"
import { spawnSync }        from "node:child_process"
import { fileURLToPath }    from "node:url"

import { Command }          from "commander"

import type Log             from "./ase-lib-log.js"
import { writeStdout }      from "./ase-lib-stdio.js"

/*  reusable functionality: resolve the internally shipped manual pages  */
export class Man {
    /*  determine the directory of the manual pages; the build process
        renders "man/*.md" into "dst/man/*.1" (see the "build-man" build
        step), right next to the compiled tool  */
    static dir (): string {
        return path.join(path.dirname(fileURLToPath(import.meta.url)), "man")
    }

    /*  list the names of all shipped manual pages (in natural order)  */
    static list (): string[] {
        let files: string[]
        try {
            files = fs.readdirSync(Man.dir())
        }
        catch (err) {
            throw new Error(`man: no manual pages found in "${Man.dir()}" (tool not completely built?)`, { cause: err })
        }
        return files
            .filter((file) => /^ase(?:-[a-z0-9-]+)?\.\d$/.test(file))
            .map((file) => file.replace(/\.\d$/, ""))
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    }

    /*  resolve the words of a requested manual page to the absolute path of
        its file: the words are joined with dashes, the "ase" prefix is optional,
        and a command path deeper than the shipped pages (e.g. "ase task store
        start") falls back to the page of its nearest parent (e.g. "ase-task-store"),
        as the pages of a group with third-level commands cover them  */
    static resolve (words: string[]): string {
        const name = words.join("-").toLowerCase()
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
            throw new Error(`man: invalid manual page name "${words.join(" ")}"`)
        const parts = name.split("-")
        if (parts[0] !== "ase")
            parts.unshift("ase")
        const pages = new Set(Man.list())
        while (parts.length > 0) {
            const page = parts.join("-")
            if (pages.has(page))
                return path.join(Man.dir(), `${page}.1`)
            parts.pop()
            if (parts.length === 1)
                break
        }
        throw new Error(`man: no manual page found for "${words.join(" ")}" (see "ase man --list")`)
    }
}

/*  CLI command "ase man"  */
export default class ManCommand {
    constructor (private log: Log) {}

    /*  register command  */
    register (program: Command): void {
        program
            .command("man")
            .description("Show an internally shipped manual page with man(1)")
            .argument("[page...]", "manual page name, either as \"ase-<command>[-<sub-command>]\" " +
                "or as the words of the command path (\"ase\" prefix optional, default: \"ase\")")
            .option("-l, --list", "list the names of all shipped manual pages instead", false)
            .option("-p, --path", "print the path of the manual page file instead", false)
            .action(async (words: string[], opts: { list: boolean, path: boolean }) => {
                /*  list all manual pages  */
                if (opts.list) {
                    await writeStdout(Man.list().map((page) => `${page}\n`).join(""))
                    return
                }

                /*  resolve manual page  */
                const file = Man.resolve(words.length > 0 ? words : [ "ase" ])
                if (opts.path) {
                    await writeStdout(`${file}\n`)
                    return
                }

                /*  show manual page with man(1), passing the file by its path,
                    which all common man(1) implementations support  */
                this.log.write("debug", `man: showing manual page "${file}"`)
                const result = spawnSync("man", [ file ], { stdio: "inherit" })
                if (result.error !== undefined) {
                    const message = result.error.message
                    throw new Error(`man: failed to run man(1): ${message} ` +
                        `(the manual page file is "${file}")`, { cause: result.error })
                }
                process.exitCode = result.status ?? 1
            })
    }
}

