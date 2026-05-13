/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  web-tree-sitter parser with WASM grammar loader and content-hash cache  */

import fs                  from "node:fs/promises"
import crypto              from "node:crypto"
import path                from "node:path"
import * as wts            from "web-tree-sitter"
import type { Language }   from "./types.js"

let inited = false
const initOnce = async (): Promise<void> => {
    if (inited)
        return
    await wts.Parser.init()
    inited = true
}

export class Parser {
    private readonly cache    = new Map<string, wts.Tree>()
    private readonly grammars = new Map<Language, wts.Language>()
    private readonly wasmDir:   string

    constructor (wasmDir: string) {
        this.wasmDir = wasmDir
    }

    async getGrammar (lang: Language): Promise<wts.Language> {
        await initOnce()
        let g = this.grammars.get(lang)
        if (g === undefined) {
            const file = path.join(this.wasmDir, `${lang}.wasm`)
            g = await wts.Language.load(file)
            this.grammars.set(lang, g)
        }
        return g
    }

    async parse (file: string, lang: Language): Promise<wts.Tree> {
        await initOnce()
        const src  = await fs.readFile(file, "utf8")
        const hash = crypto.createHash("sha256").update(src).digest("hex")
        const key  = `${lang}:${hash}`
        const hit  = this.cache.get(key)
        if (hit !== undefined)
            return hit
        const parser = new wts.Parser()
        parser.setLanguage(await this.getGrammar(lang))
        const tree = parser.parse(src)
        if (tree === null)
            throw new Error(`tree-sitter: failed to parse ${file} as ${lang}`)
        this.cache.set(key, tree)
        return tree
    }
}
