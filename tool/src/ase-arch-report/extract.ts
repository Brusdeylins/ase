/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
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
    /*  reject section dividers: comments dominated by `=`/`-`/`*` runs
        like `/* ============ Contract Details ============ *\/` are
        commonly used as visual section markers above unrelated symbols
        and must not be mistaken for doc comments  */
    if (/={4,}|-{4,}|\*{4,}/.test(stripped))
        return null
    const m = stripped.match(/^(.+?[.!?])(\s|$)/)
    return (m !== null ? m[1] : stripped).trim()
}

/*  a comment counts as a doc-comment only if it is a block_comment
    (`/* ... *\/` or `/** ... *\/`) or the TS `comment` super-type.  Line
    comments (`//`) are deliberately excluded because in C-family
    grammars they are routinely used as section delimiters
    (`// ==== METADATA ====`) directly above an unrelated symbol, which
    would otherwise be mistaken for documentation.  */
const isDocCommentNode = (n: wts.Node): boolean =>
    n.type === "comment" || n.type === "block_comment"

/*  walk backwards from a node through anonymous tokens (punctuation,
    whitespace placeholders) and stop at the first comment OR the first
    other named node.  Using `previousSibling` instead of
    `previousNamedSibling` makes the lookup robust against grammars
    where doc comments are emitted as anonymous "extras" tokens rather
    than named siblings.  */
const findLeadingComment = (node: wts.Node): wts.Node | null => {
    let cur: wts.Node | null = node.previousSibling
    while (cur !== null) {
        if (isDocCommentNode(cur))
            return cur
        /*  any other named node breaks the doc-comment chain  */
        if (cur.isNamed)
            return null
        cur = cur.previousSibling
    }
    return null
}

const docFor = (node: wts.Node): string | null => {
    /*  look for the doc comment on the node itself, then on an enclosing
        export_statement (TS) since `export class Foo` nests the class inside
        an export_statement whose previous sibling is the comment  */
    let target: wts.Node | null = node
    while (target !== null) {
        const c = findLeadingComment(target)
        if (c !== null)
            return firstSentence(c.text)
        if (target.parent !== null && target.parent.type === "export_statement")
            target = target.parent
        else
            break
    }
    return null
}

const modifiersOf = (node: wts.Node): Modifier[] => {
    const out: Modifier[] = []
    /*  scan a node for modifier tokens.  Both flat layouts (TypeScript:
        modifier tokens appear as direct children of the declaration) and
        nested layouts (Java/Kotlin: modifiers live under a `modifiers`
        wrapper child) are handled by recursing into a `modifiers`
        wrapper exactly one level deep.  */
    const scan = (n: wts.Node): void => {
        for (const c of n.children) {
            if (c === null)
                continue
            if (c.type === "modifiers") {
                scan(c)
                continue
            }
            if (c.type === "accessibility_modifier") {
                const t = c.text
                if (t === "public" || t === "private" || t === "protected")
                    out.push(t as Modifier)
            }
            if (c.type === "public" || c.type === "private" || c.type === "protected")
                out.push(c.type as Modifier)
            if (c.type === "abstract" || c.text === "abstract")
                out.push("abstract")
            if (c.text === "sealed" || c.text === "final")
                out.push(c.text as Modifier)
        }
    }
    scan(node)
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
            if (c.type === "extends_clause" || c.type === "superclass") {
                /*  TS/Kotlin: `extends_clause` (`extends X[, Y]`)
                    Java:      `superclass`     (`extends X`, single)  */
                for (const id of c.children)
                    if (id !== null && (id.type === "identifier" || id.type === "type_identifier"))
                        ext.push(id.text)
                /*  TS also nests names under generic_type/type_arguments  */
                for (const id of c.descendantsOfType("type_identifier"))
                    if (id !== null && !ext.includes(id.text))
                        ext.push(id.text)
            }
            else if (c.type === "implements_clause" || c.type === "super_interfaces") {
                /*  TS: `implements_clause`; Java: `super_interfaces` wrapping
                    an `interface_type_list` of `type_identifier` children.  */
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

/*  languages that have a package-private (default) visibility level
    where members lacking an explicit access modifier are NOT part of
    the public API.  In TypeScript/JavaScript/Python a method without
    a modifier is conceptually public, so the absence of a modifier
    must NOT hide the member there.  */
const HAS_PACKAGE_PRIVATE_DEFAULT: Record<Language, boolean> = {
    java:       true,
    kotlin:     true,
    csharp:     true,
    go:         false,
    rust:       false,
    c:          false,
    cpp:        false,
    typescript: false,
    javascript: false,
    python:     false
}

/*  determine whether a member (method/field) should appear in the
    architecture report.  Policy: show only the *public* and *protected*
    API.  Members with `private` are always hidden.  Members lacking an
    explicit visibility modifier are kept on interfaces unconditionally
    (interface methods are implicitly public in all supported languages)
    and on classes only if the language has no package-private default
    (TypeScript/JavaScript/Python class methods are public by default;
    Java/Kotlin/C# class members default to package-private and are
    therefore hidden).  */
const memberIsVisible = (typeKind: SymbolKind, lang: Language, modifiers: Modifier[]): boolean => {
    if (modifiers.includes("private"))
        return false
    if (modifiers.includes("public") || modifiers.includes("protected"))
        return true
    if (typeKind === "interface")
        return true
    return !HAS_PACKAGE_PRIVATE_DEFAULT[lang]
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

/*  Python: detect whether a `class_definition` derives from an
    Abstract Base Class (`ABC`, `ABCMeta` via metaclass argument) or
    declares itself as a `Protocol` from `typing`.  Approximate but
    covers the three idiomatic forms architects use to express
    intentional abstractness in Python.  */
const PYTHON_ABSTRACT_BASES = new Set([ "ABC", "ABCMeta", "Protocol" ])
const pythonIsAbstractClass = (node: wts.Node): boolean => {
    for (const id of node.descendantsOfType("identifier"))
        if (id !== null && PYTHON_ABSTRACT_BASES.has(id.text))
            return true
    return false
}

/*  C++: a class is abstract when at least one of its member
    function declarations is *pure-virtual* — syntactically the
    declarator is followed by `= 0` (optionally separated by `override`
    or `final` annotations).  The tree-sitter cpp grammar exposes the
    pure marker as a `(number_literal)` child immediately after the
    `function_declarator`; an alternative spelling captures it via
    the text suffix `= 0` of the declaration node.  We check both.  */
const cppIsAbstractClass = (node: wts.Node): boolean => {
    for (const decl of node.descendantsOfType("function_definition"))
        if (decl !== null && /=\s*0\s*;?\s*$/.test(decl.text))
            return true
    for (const decl of node.descendantsOfType("field_declaration"))
        if (decl !== null && /=\s*0\s*;?\s*$/.test(decl.text))
            return true
    return false
}

/*  Reduce per-language flavours of "abstract" to a single boolean.
    Interfaces (Java/TS/C#) and traits (Rust) are abstract by
    definition; an `abstract` or `sealed` modifier on a class node
    flags the class as abstract too (Kotlin `sealed` is treated as
    abstract because it cannot be instantiated directly).  Python
    relies on ABC/Protocol base-class detection, C++ on pure-virtual
    method presence.  Languages without a native abstract concept
    (JavaScript, C) always return false so the downstream Martin
    Abstractness metric reports an honest zero rather than guessing.  */
const computeIsAbstract = (
    node: wts.Node, kind: SymbolKind, lang: Language, modifiers: Modifier[]
): boolean => {
    if (kind === "interface")
        return true
    if (modifiers.includes("abstract"))
        return true
    if (lang === "kotlin" && modifiers.includes("sealed"))
        return true
    if (lang === "python" && pythonIsAbstractClass(node))
        return true
    if (lang === "cpp" && cppIsAbstractClass(node))
        return true
    return false
}

/*  Map the tree-sitter node type of a type-declaration capture to
    its SymbolKind.  `interface_declaration` (Java/TS/C#) and
    `trait_item` (Rust) are interfaces; `enum_declaration` (Java/TS/
    C#), `enum_item` (Rust), and `enum_specifier` (C/C++) are enums;
    `record_declaration` (Java/C#) keeps `class` since records behave
    structurally like classes for the API surface; `struct_*` is
    flagged as `class` in this version (per types.ts current usage
    set), and a dedicated `struct` kind is introduced in a later
    commit when consumers can distinguish.  Anything else falls back
    to `class`, the most generic OO container.  */
const symbolKindOf = (node: wts.Node): SymbolKind => {
    if (node.type === "interface_declaration" || node.type === "trait_item")
        return "interface"
    if (node.type === "enum_declaration" || node.type === "enum_item" || node.type === "enum_specifier")
        return "enum"
    return "class"
}

/*  Resolve a symbol's display name.  The preferred path is
    `childForFieldName("name")` (works for Java/TS/Python/Go/Rust),
    but several grammars do not expose a `name` field on the
    declaration node — Kotlin returns null for every declaration,
    and C nests the function name inside a `function_declarator`.
    Fall back to the first descendant whose type is one of the
    common identifier kinds so those languages render real names
    instead of the historical `<anon>` placeholder.  */
const IDENTIFIER_KINDS = new Set([
    "identifier", "type_identifier", "field_identifier",
    "simple_identifier", "property_identifier"
])
const nameOf = (node: wts.Node): string => {
    const fieldName = node.childForFieldName("name")
    if (fieldName !== null)
        return fieldName.text
    for (const kind of IDENTIFIER_KINDS)
        for (const d of node.descendantsOfType(kind))
            if (d !== null)
                return d.text
    return "<anon>"
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
            if (c.name === "class.def" || c.name === "interface.def" || c.name === "enum.def")
                types.push(c.node)
            else if (c.name === "method.def" || c.name === "method.sig.def")
                methods.push(c.node)
        }
    }

    const symbols: ArchSymbol[] = []
    for (const t of types) {
        const tModifiers = modifiersOf(t)
        /*  drop nested private types entirely  */
        if (tModifiers.includes("private"))
            continue
        const name = nameOf(t)
        const kind: SymbolKind = symbolKindOf(t)
        const members: ArchMember[] = []
        /*  collect type_identifier references that appear anywhere
            inside the type's body — method parameter types, return
            types, field types, generic type arguments, etc.  These
            become the *candidate* references list per symbol; the
            renderer filters them down to in-cluster, non-self,
            non-heritage targets when emitting `..>` edges.  */
        const referencesSet = new Set<string>()
        for (const m of methods) {
            /*  attach method to type if it is nested inside the type's body  */
            let ancestor: wts.Node | null = m.parent
            while (ancestor !== null && !ancestor.equals(t))
                ancestor = ancestor.parent
            if (ancestor === null)
                continue
            const mModifiers = modifiersOf(m)
            if (!memberIsVisible(kind, lang, mModifiers))
                continue
            const mName = nameOf(m)
            members.push({
                name:      mName,
                kind:      memberKind(m.type),
                modifiers: mModifiers,
                signature: sanitizeMemberText(m.text),
                doc:       docFor(m),
                line:      m.startPosition.row + 1
            })
            for (const ref of m.descendantsOfType("type_identifier"))
                if (ref !== null && ref.text !== name)
                    referencesSet.add(ref.text)
        }
        /*  also pick up field-level type_identifiers from anywhere
            in the type body that did not come through the method
            scan above (covers Java field declarations and TS class
            properties that the query did not capture as methods)  */
        for (const ref of t.descendantsOfType("type_identifier"))
            if (ref !== null && ref.text !== name)
                referencesSet.add(ref.text)
        members.sort((a, b) => a.name.localeCompare(b.name))
        const heritage = collectHeritage(t)
        symbols.push({
            fqn:        name,
            name,
            kind,
            modifiers:  tModifiers,
            isAbstract: computeIsAbstract(t, kind, lang, tModifiers),
            extends:    heritage.extends,
            implements: heritage.implements,
            references: [ ...referencesSet ].sort(),
            file,
            line:       t.startPosition.row + 1,
            loc:        t.endPosition.row - t.startPosition.row + 1,
            doc:        docFor(t),
            members
        })
    }
    /*  Per-file dedupe by symbol name.  Rust pairs `struct_item` (the
        type definition, no members) with one or more `impl_item`
        blocks (with the same name, carrying the methods) — each gets
        captured as its own class.def, producing duplicate ArchSymbols.
        Merge same-name siblings within a file so the report shows one
        symbol with the union of members and the earliest definition
        line; preserves the struct's heritage info from the type-def,
        absorbs the methods from the impl-blocks.  */
    const byName = new Map<string, ArchSymbol>()
    for (const s of symbols) {
        const existing = byName.get(s.name)
        if (existing === undefined)
            byName.set(s.name, s)
        else {
            const seenNames = new Set(existing.members.map((m) => m.name))
            for (const m of s.members)
                if (!seenNames.has(m.name)) {
                    existing.members.push(m)
                    seenNames.add(m.name)
                }
            existing.members.sort((a, b) => a.name.localeCompare(b.name))
            for (const r of s.references)
                if (!existing.references.includes(r))
                    existing.references.push(r)
            existing.references.sort()
            if (existing.line > s.line)
                existing.line = s.line
        }
    }
    return [ ...byName.values() ]
}

/*  per-language tree-sitter node types that represent an import-like
    construct: Java `import com.foo.Bar;`, TS/JS `import … from "…"`,
    Python `import …` / `from … import …`, Go `import "…"`, Rust
    `use …`, Kotlin `import …`, C# `using …`, C/C++ `#include "…"`.
    Empty array for languages where no import construct exists or is
    not yet wired through (none currently).  */
const IMPORT_NODE_TYPES: Record<Language, string[]> = {
    java:       [ "import_declaration" ],
    kotlin:     [ "import_header" ],
    typescript: [ "import_statement" ],
    javascript: [ "import_statement" ],
    python:     [ "import_statement", "import_from_statement" ],
    go:         [ "import_spec" ],
    rust:       [ "use_declaration" ],
    csharp:     [ "using_directive" ],
    c:          [ "preproc_include" ],
    cpp:        [ "preproc_include" ]
}

/*  Pick the most-informative descendant text for an import node:
    the longest matching path-shaped child (scoped_identifier,
    dotted_name, qualified_name, scoped_use_list, identifier).  For
    string-based imports (TS/JS/Go/C/C++) fall back to the string
    literal stripped of its surrounding quotes / angle brackets.  */
const IMPORT_PATH_NODE_TYPES = [
    "scoped_identifier", "dotted_name", "qualified_name",
    "scoped_use_list",   "string_literal",
    "interpreted_string_literal",
    "system_lib_string", "string"
]
const stripStringDelims = (s: string): string =>
    s.replace(/^[`"'<]/, "").replace(/[`"'>]$/, "")

const extractImportPath = (node: wts.Node): string | null => {
    for (const kind of IMPORT_PATH_NODE_TYPES)
        for (const d of node.descendantsOfType(kind))
            if (d !== null && d.text.length > 0)
                return stripStringDelims(d.text)
    /*  identifier fallback (e.g. Kotlin `import_header` whose child
        is plain `identifier` chain)  */
    for (const d of node.descendantsOfType("identifier"))
        if (d !== null)
            return d.text
    return null
}

export const extractImports = (tree: wts.Tree, lang: Language): string[] => {
    const result = new Set<string>()
    for (const nodeType of IMPORT_NODE_TYPES[lang] ?? [])
        for (const node of tree.rootNode.descendantsOfType(nodeType))
            if (node !== null) {
                const p = extractImportPath(node)
                if (p !== null && p.length > 0)
                    result.add(p)
            }
    return [ ...result ].sort()
}
