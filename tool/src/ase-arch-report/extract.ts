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

/*  cache compiled tree-sitter Query objects per (queriesDir, lang).  Building
    a Query is expensive (WASM-backed) and Query objects allocate native heap
    that must be reclaimed via `.delete()` — so we keep them for process
    lifetime and reuse across files.  */
const COMPILED_QUERY_CACHE = new Map<string, wts.Query>()
const compileQuery = async (lang: Language, queriesDir: string, grammar: wts.Language): Promise<wts.Query> => {
    const key = `${queriesDir}::${lang}`
    let q = COMPILED_QUERY_CACHE.get(key)
    if (q === undefined) {
        const file = path.join(queriesDir, `${lang}.scm`)
        const src  = await fs.readFile(file, "utf8")
        q = new wts.Query(grammar, src)
        COMPILED_QUERY_CACHE.set(key, q)
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
        .map((l) => l.replace(/^\s*(\*|\/\/)\s?/, "").trimEnd())
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
        if (c.type === "accessibility_modifier") {
            const t = c.text
            if (t === "public" || t === "private" || t === "protected")
                out.push(t as Modifier)
        }
        if (c.type === "abstract" || c.text === "abstract")
            out.push("abstract")
        if (c.text === "sealed" || c.text === "final")
            out.push(c.text as Modifier)
    }
    if (node.type === "abstract_class_declaration")
        out.push("abstract")
    return out
}

const collectHeritage = (typeNode: wts.Node): { extends: string[]; implements: string[] } => {
    const ext: string[] = []
    const imp: string[] = []
    const scan = (n: wts.Node): void => {
        for (const c of n.children) {
            if (c === null)
                continue
            if (c.type === "extends_clause") {
                /*  class extends X[, Y]  */
                for (const id of c.children)
                    if (id !== null && (id.type === "identifier" || id.type === "type_identifier"))
                        ext.push(id.text)
                /*  TS also nests names under generic_type/type_arguments  */
                for (const id of c.descendantsOfType("type_identifier"))
                    if (id !== null && !ext.includes(id.text))
                        ext.push(id.text)
            }
            else if (c.type === "implements_clause") {
                for (const id of c.descendantsOfType("type_identifier"))
                    if (id !== null && !imp.includes(id.text))
                        imp.push(id.text)
            }
            else if (c.type === "extends_type_clause") {
                /*  interface extends X, Y  */
                for (const id of c.descendantsOfType("type_identifier"))
                    if (id !== null && !ext.includes(id.text))
                        ext.push(id.text)
            }
            else if (c.type === "class_heritage" || c.type === "class_body" || c.type === "interface_body")
                scan(c)
        }
    }
    scan(typeNode)
    /*  return tuple as separate lists, types-namespace separator chosen ;
        TS interfaces only use 'extends'.  */
    return { extends: ext, implements: imp }
}

const sanitizeMemberText = (raw: string): string => {
    let s = raw
    /*  strip leading annotation(s) FIRST so annotation arguments like
        @SuppressWarnings({"unchecked"}) don't fool the body-trimming '{'
        heuristic below.  Supports @Foo, @Foo(args) — including '{' and '}'
        inside the args — repeated for Java, Kotlin, Python decorators,
        and TS legacy decorators.  */
    while (true) {
        const next = s.replace(/^\s*@[A-Za-z_][\w.]*(\([^)]*\))?\s*/s, "")
        if (next === s)
            break
        s = next
    }
    /*  drop method body (Java/TS/Kotlin etc.): everything from the first '{'
        at top level onward — interface methods end with ';' instead.  */
    const brace = s.indexOf("{")
    if (brace >= 0)
        s = s.slice(0, brace)
    /*  drop everything from a trailing ';' onward  */
    s = s.replace(/;\s*$/, "")
    /*  collapse all whitespace (including embedded newlines from multi-line
        parameter lists) into single spaces  */
    s = s.replace(/\s+/g, " ").trim()
    return s
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
    const query   = await compileQuery(lang, queriesDir, grammar)
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
                signature: sanitizeMemberText(m.text),
                doc:       docFor(m),
                line:      m.startPosition.row + 1
            })
        }
        const heritage = collectHeritage(t)
        symbols.push({
            fqn:        name,
            name,
            kind,
            modifiers:  modifiersOf(t),
            extends:    heritage.extends,
            implements: heritage.implements,
            file,
            line:       t.startPosition.row + 1,
            doc:        docFor(t),
            members
        })
    }
    return symbols
}
