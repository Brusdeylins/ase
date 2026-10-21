/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                 from "node:path"
import fs                   from "node:fs"
import { fileURLToPath }    from "node:url"

import { Command }          from "commander"

import type Log             from "./ase-lib-log.js"
import { writeStdout }      from "./ase-lib-stdio.js"

/*  the width of the manual pages printed as plain text  */
const WIDTH = 80

/*  reusable functionality: resolve the internally shipped manual pages  */
export class Man {
    /*  determine the directory of the manual pages; the build process
        copies "man/*.md" into "dst/man/*.md" (see the "build-man" build
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
            .filter((file) => /^ase(?:-[a-z0-9-]+)?\.md$/.test(file))
            .map((file) => file.replace(/\.md$/, ""))
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    }

    /*  resolve the words of a requested manual page to its name: the words
        are joined with dashes, the "ase" prefix is optional, and a command path
        deeper than the shipped pages (e.g. "ase task store start") falls back to
        the page of its nearest parent (e.g. "ase-task-store"), as the pages of a
        group with third-level commands cover them  */
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
                return page
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
            .description("Browse all manual pages interactively, or print a manual page as plain text")
            .argument("[page...]", "manual page name, either as \"ase-<command>[-<sub-command>]\" " +
                "or as the words of the command path (\"ase\" prefix optional), selected in the " +
                "interactive browser on a terminal (or searched for, if no manual page fits exactly), " +
                "else printed as plain text (default: \"ase\")")
            .option("-l, --list", "list the names of all shipped manual pages instead", false)
            .action(async (words: string[], opts: { list: boolean }) => {
                /*  list all manual pages  */
                if (opts.list) {
                    await writeStdout(Man.list().map((page) => `${page}\n`).join(""))
                    return
                }

                /*  browse all manual pages interactively (only on a terminal), with
                    the given manual page selected resp. searched for (if any)  */
                if (process.stdin.isTTY && process.stdout.isTTY) {
                    const { runManTUI } = await import("./ase-man-tui.js")
                    await runManTUI(this.log, words)
                    return
                }

                /*  resolve manual page, where a skill or command fitting exactly
                    is preferred over the fallback onto the nearest parent command  */
                const { loadCatalog, findPage } = await import("./ase-man-catalog.js")
                const { renderPage }            = await import("./ase-man-render.js")
                const catalog = loadCatalog()
                const request = words.length > 0 ? words : [ "ase" ]
                const page    = findPage(catalog, request) ?? catalog.pages.get(`${Man.resolve(request)}.1`)
                if (page === undefined)
                    throw new Error(`man: no manual page found for "${request.join(" ")}" (see "ase man --list")`)

                /*  print manual page as plain text  */
                this.log.write("debug", `man: printing manual page "${page.id}"`)
                const { lines } = renderPage(page.md, WIDTH, page.id, (id) => catalog.pages.has(id))
                await writeStdout(lines.map((line) => line.map((span) => span.text).join("").trimEnd() + "\n").join(""))
            })
    }
}

