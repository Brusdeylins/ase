/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  tree-sitter query-driven symbol extraction  */

import fs           from "node:fs/promises"
import path         from "node:path"
import * as wts     from "web-tree-sitter"
import type { Language, ArchSymbol, ArchMember, Modifier, SymbolKind } from "./types.js"

/*  load and cache .scm query text per (language, queriesDir)  */
const QUERY_CACHE = new Map<string, string>()
const loadQuery = async (lang: Language, queriesDir: string): Promise<string> => {
    const key = `${queriesDir}::${lang}`
    let q = QUERY_CACHE.get(key)
    if (q === undefined) {
        const file = path.join(queriesDir, `${lang}.scm`)
        q = await fs.readFile(file, "utf8")
        QUERY_CACHE.set(key, q)
    }
    return q
}

/*  extract first sentence of a leading doc-comment for a node, if present  */
const firstSentence = (raw: string): string | null => {
    /*  strip /** ... *\/ envelope plus line-leading asterisks  */
    const stripped = raw
        .replace(/^\/\*\*?/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trimEnd())
        .join(" ")
        .trim()
    if (stripped.length === 0)
        return null
    const m = stripped.match(/^(.+?[.!?])(\s|$)/)
    return (m !== null ? m[1] : stripped).trim()
}

const docFor = (node: wts.Node): string | null => {
    /*  look for the doc comment on the node itself, then on an enclosing
        export_statement (TS) since `export class Foo` nests the class inside
        an export_statement whose previous sibling is the comment  */
    let target: wts.Node | null = node
    while (target !== null) {
        const prev = target.previousNamedSibling
        if (prev !== null && (prev.type === "comment" || prev.type === "block_comment"))
            return firstSentence(prev.text)
        if (target.parent !== null && target.parent.type === "export_statement")
            target = target.parent
        else
            break
    }
    return null
}

const modifiersOf = (node: wts.Node): Modifier[] => {
    const out: Modifier[] = []
    for (const c of node.children) {
        if (c === null)
            continue
        if (c.type === "public" || c.type === "private" || c.type === "protected")
            out.push(c.type as Modifier)
        if (c.text === "abstract" || c.text === "sealed" || c.text === "final")
            out.push(c.text as Modifier)
    }
    return out
}

const memberKind = (nodeType: string): SymbolKind => {
    if (nodeType.startsWith("method"))
        return "method"
    if (nodeType.startsWith("function"))
        return "function"
    if (nodeType.startsWith("field") || nodeType === "property_signature")
        return "field"
    return "method"
}

export const extractSymbols = async (
    tree: wts.Tree, grammar: wts.Language, lang: Language, file: string, queriesDir: string
): Promise<ArchSymbol[]> => {
    const qSrc    = await loadQuery(lang, queriesDir)
    const query   = new wts.Query(grammar, qSrc)
    const matches = query.matches(tree.rootNode)

    /*  collect type definitions and method/signature definitions from query
        captures; the TS query emits class/interface .def captures and method
        .def captures separately, and we associate methods to their enclosing
        type by walking up the AST  */
    const types:   wts.Node[] = []
    const methods: wts.Node[] = []
    for (const m of matches) {
        for (const c of m.captures) {
            if (c.name === "class.def" || c.name === "interface.def")
                types.push(c.node)
            else if (c.name === "method.def" || c.name === "method.sig.def")
                methods.push(c.node)
        }
    }

    const symbols: ArchSymbol[] = []
    for (const t of types) {
        const nameNode = t.childForFieldName("name")
        const name = nameNode?.text ?? "<anon>"
        const kind: SymbolKind = t.type === "interface_declaration" ? "interface" : "class"
        const members: ArchMember[] = []
        for (const m of methods) {
            /*  attach method to type if it is nested inside the type's body  */
            let ancestor: wts.Node | null = m.parent
            while (ancestor !== null && !ancestor.equals(t))
                ancestor = ancestor.parent
            if (ancestor === null)
                continue
            const mName = m.childForFieldName("name")?.text ?? "<anon>"
            members.push({
                name:      mName,
                kind:      memberKind(m.type),
                signature: m.text.split("\n")[0],
                doc:       docFor(m),
                line:      m.startPosition.row + 1
            })
        }
        symbols.push({
            fqn:        name,
            name,
            kind,
            modifiers:  modifiersOf(t),
            extends:    [],
            implements: [],
            file,
            line:       t.startPosition.row + 1,
            doc:        docFor(t),
            members
        })
    }
    return symbols
}
