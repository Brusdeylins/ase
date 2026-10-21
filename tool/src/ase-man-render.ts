/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { marked }                             from "marked"
import type { Token, Tokens }                 from "marked"
import type { HighlighterCore }               from "shiki/core"

/*  the tones of the rendered spans: of the Markdown text ("text", "bold",
    "italic", "code", "link", and the headings "title", "head", and "sub"), of
    the syntax-highlighted code blocks ("cmt", "str", "num", "opt", "var", "key",
    "cmd", "kw", and "punct"), and of the decorations ("dim" and "bullet")  */
export type Tone = "text" | "bold" | "italic" | "code" | "link" | "title" | "head" | "sub" | "dim" | "bullet" |
    "cmt" | "str" | "num" | "opt" | "var" | "key" | "cmd" | "kw" | "punct"

/*  a span of a rendered line, optionally referencing another page (by the
    index into the references of the page) and optionally marked as a search match  */
export type Span = { text: string, tone: Tone, ref?: number, match?: boolean }
export type Line = Span[]

/*  a rendered page: its lines and its references, each with the id of
    the referenced page and the first line it occurs in  */
export type Rendered = { lines: Line[], refs: { id: string, line: number }[] }

/*  the syntax highlighter of the code blocks (via Shiki, with its JavaScript
    regular expression engine, i.e. without WebAssembly, and with an empty
    theme, as only the TextMate scopes of the tokens are used), loaded on
    demand only once  */
let highlighter: HighlighterCore | null = null
let loading: Promise<void> | null = null
export const codeLoad = (): Promise<void> => {
    if (loading === null) {
        loading = (async () => {
            const [ { createHighlighterCore }, { createJavaScriptRegexEngine }, { bundledLanguages } ] = await Promise.all([
                import("shiki/core"), import("shiki/engine/javascript"), import("shiki/langs")
            ])
            highlighter = await createHighlighterCore({
                themes: [ { name: "ase", type: "dark", settings: [] } ],
                langs:  [ bundledLanguages.shellscript, bundledLanguages.yaml, bundledLanguages.json, bundledLanguages.typescript ],
                engine: createJavaScriptRegexEngine()
            })
        })()
    }
    return loading
}

/*  the highlighted languages of the code blocks, by their fence info  */
const codeLangs: Record<string, string> = {
    sh: "shellscript", bash: "shellscript", shell: "shellscript", shellscript: "shellscript",
    yaml: "yaml", yml: "yaml", json: "json", ts: "typescript", typescript: "typescript"
}

/*  the tones of the code tokens, by the prefixes of their TextMate scopes (first match wins)  */
const codeScopes: [ Tone, string[] ][] = [
    [ "cmt",   [ "comment" ] ],
    [ "str",   [ "string.quoted", "string.template", "string.unquoted.plain", "string.unquoted.block" ] ],
    [ "opt",   [ "constant.other.option" ] ],
    [ "var",   [ "variable.other.normal", "variable.other.special", "variable.other.positional" ] ],
    [ "num",   [ "constant.numeric", "constant.language" ] ],
    [ "key",   [ "entity.name.tag", "support.type.property-name" ] ],
    [ "cmd",   [ "entity.name.command", "entity.name.function", "support.function" ] ],
    [ "kw",    [ "keyword", "storage" ] ],
    [ "punct", [ "punctuation" ] ]
]

/*  append a span to a line, merging it into the last span of equal attributes  */
const append = (line: Line, span: Span): void => {
    const last = line[line.length - 1]
    if (last !== undefined && last.tone === span.tone && last.ref === span.ref && last.match === span.match)
        last.text += span.text
    else
        line.push({ ...span })
}

/*  split the text of a code block into lines of syntax-highlighting spans
    (all as plain text for an unknown language or while the highlighter is
    not loaded yet, see "codeLoad")  */
const codeLines = (text: string, lang: string | undefined): Line[] => {
    const name = codeLangs[(lang ?? "").toLowerCase()]
    if (highlighter === null || name === undefined)
        return text.split(/\r?\n/).map((line) => [ { text: line, tone: "text" } ])
    const { tokens } = highlighter.codeToTokens(text, { lang: name, theme: "ase", includeExplanation: "scopeName" })
    return tokens.map((line) => {
        const out = [] as Line
        for (const part of line.flatMap((token) => token.explanation ?? [ { content: token.content, scopes: [] } ])) {
            const scopes = part.scopes.map((scope) => scope.scopeName)
            const tone   = codeScopes.find(([ , prefixes ]) => scopes.some((scope) =>
                prefixes.some((prefix) => scope === prefix || scope.startsWith(prefix + "."))))?.[0] ?? "text"
            append(out, { text: part.content, tone })
        }
        return out
    })
}

/*  the rendering context: the collected references and the check for referable pages  */
type Ctx = { refs: Rendered["refs"], exists: (id: string) => boolean }

/*  register a reference onto a page, if it is referable  */
const refOf = (ctx: Ctx, id: string): number | undefined => {
    if (!ctx.exists(id))
        return undefined
    ctx.refs.push({ id, line: -1 })
    return ctx.refs.length - 1
}

/*  render inline tokens into spans of a base tone, where a code span naming
    a page (a skill by its name, or a command by its name directly followed by
    "(1)") and a link onto the "help.md" of a skill reference this page, and
    a hard line break is a span of a single newline  */
const inline = (tokens: Token[], tone: Tone, ctx: Ctx): Span[] => {
    const out = [] as Span[]
    tokens.forEach((token, i) => {
        const next = tokens[i + 1]
        if (token.type === "strong")
            out.push(...inline((token as Tokens.Strong).tokens, "bold", ctx))
        else if (token.type === "em")
            out.push(...inline((token as Tokens.Em).tokens, "italic", ctx))
        else if (token.type === "del")
            out.push(...inline((token as Tokens.Del).tokens, tone, ctx))
        else if (token.type === "codespan") {
            const text = (token as Tokens.Codespan).text
            const man  = next !== undefined && next.type === "text" && (next as Tokens.Text).text.startsWith("(1)")
            out.push({ text: text.replace(/\n/g, " "), tone: "code", ref: refOf(ctx, man ? `${text}.1` : text) })
        }
        else if (token.type === "link") {
            const link  = token as Tokens.Link
            const spans = inline(link.tokens, "link", ctx)
            const m     = /^(?:\.\.\/)?(ase-[a-z0-9-]+)\/help\.md$/.exec(link.href)
            const ref   = m !== null && !spans.some((span) => span.ref !== undefined) ? refOf(ctx, m[1]) : undefined
            out.push(...spans.map((span) => ({ ...span, ref: span.ref ?? ref })))
        }
        else if (token.type === "text") {
            const text = token as Tokens.Text
            if (text.tokens !== undefined && text.tokens.length > 0)
                out.push(...inline(text.tokens, tone, ctx))
            else
                out.push({ text: text.text.replace(/\n/g, " "), tone })
        }
        else if (token.type === "br")
            out.push({ text: "\n", tone })
        else if (token.type === "escape" || token.type === "html" || token.type === "image")
            out.push({ text: (token as Tokens.Escape).text.replace(/\n/g, " "), tone })
        else
            out.push({ text: token.raw.replace(/\n/g, " "), tone })
    })
    return out
}

/*  word-wrap spans onto lines of a width: the spans are split into words
    (glued across adjacent spans, like a code span directly followed by its
    punctuation), which are laid out with single spaces in between, where a
    span of a single newline breaks the line and an overlong word is broken hard  */
const wrap = (spans: Span[], width: number): Line[] => {
    type Atom = { parts: Span[], len: number, space: boolean }
    const atoms = [] as (Atom | null)[]
    let atom  = null as Atom | null
    let space = false
    for (const span of spans) {
        if (span.text === "\n") {
            atoms.push(null)
            atom  = null
            space = false
            continue
        }
        for (const piece of span.text.split(/(\s+)/)) {
            if (piece === "")
                continue
            if (/^\s+$/.test(piece)) {
                atom  = null
                space = true
                continue
            }
            if (atom === null) {
                atom  = { parts: [], len: 0, space }
                space = false
                atoms.push(atom)
            }
            atom.parts.push({ ...span, text: piece })
            atom.len += piece.length
        }
    }
    const lines = [] as Line[]
    let line = [] as Line
    let col  = 0
    const newline = () => {
        lines.push(line)
        line = []
        col  = 0
    }
    for (const a of atoms) {
        if (a === null) {
            newline()
            continue
        }
        if (col > 0 && col + (a.space ? 1 : 0) + a.len > width)
            newline()
        if (col > 0 && a.space) {
            const prev = line[line.length - 1]
            const same = prev.tone === a.parts[0].tone && prev.ref === a.parts[0].ref
            append(line, same ? { ...prev, text: " " } : { text: " ", tone: "text" })
            col++
        }
        for (const part of a.parts) {
            let text = part.text
            while (col + text.length > width) {
                const n = width - col
                if (n > 0)
                    append(line, { ...part, text: text.slice(0, n) })
                text = text.slice(n)
                newline()
            }
            if (text !== "") {
                append(line, { ...part, text })
                col += text.length
            }
        }
    }
    if (line.length > 0 || lines.length === 0)
        lines.push(line)
    return lines
}

/*  render block tokens into lines of a width, separated by empty lines
    (unless tight, as within the items of a tight list), where list items,
    code blocks, and block quotes are all indented by four columns  */
const blocks = (tokens: Token[], width: number, ctx: Ctx, tight = false): Line[] => {
    const out = [] as Line[]
    const add = (lines: Line[]) => {
        if (lines.length === 0)
            return
        if (out.length > 0 && !tight)
            out.push([])
        out.push(...lines)
    }
    for (const token of tokens) {
        if (token.type === "space" || token.type === "def")
            continue
        else if (token.type === "heading") {
            const head = token as Tokens.Heading
            add(wrap(inline(head.tokens, head.depth === 1 ? "title" : head.depth === 2 ? "head" : "sub", ctx), width))
        }
        else if (token.type === "paragraph" || token.type === "text") {
            const para = token as Tokens.Paragraph
            add(wrap(para.tokens !== undefined ? inline(para.tokens, "text", ctx) : [ { text: para.text, tone: "text" } ], width))
        }
        else if (token.type === "list") {
            const list  = token as Tokens.List
            const lines = [] as Line[]
            list.items.forEach((item, k) => {
                const bullet = list.ordered ? `${(list.start === "" ? 1 : list.start) + k}. `.padEnd(4) : "●   "
                const body   = blocks(item.tokens, Math.max(10, width - bullet.length), ctx, !item.loose)
                if (list.loose && k > 0)
                    lines.push([])
                if (body.length === 0)
                    body.push([])
                body.forEach((line, n) => {
                    lines.push([ { text: n === 0 ? bullet : " ".repeat(bullet.length), tone: "bullet" }, ...line ])
                })
            })
            add(lines)
        }
        else if (token.type === "code") {
            const code = token as Tokens.Code
            add(codeLines(code.text, code.lang).map((line) => [ { text: "    ", tone: "text" }, ...line ]))
        }
        else if (token.type === "blockquote")
            add(blocks((token as Tokens.Blockquote).tokens, Math.max(10, width - 4), ctx)
                .map((line) => [ { text: "  │ ", tone: "dim" }, ...line ]))
        else if (token.type === "hr")
            add([ [ { text: "─".repeat(width), tone: "dim" } ] ])
        else
            add(token.raw.replace(/\n+$/, "").split("\n").map((line) => [ { text: line, tone: "dim" } ]))
    }
    return out
}

/*  render the Markdown source of a page (with the id "self") into lines of
    a width, where references onto the page itself are omitted  */
export const renderPage = (md: string, width: number, self: string, exists: (id: string) => boolean): Rendered => {
    const ctx: Ctx = { refs: [], exists: (id) => id !== self && exists(id) }
    const lines    = blocks(marked.lexer(md.replace(/\t/g, "    ")), Math.max(10, width), ctx)
    lines.forEach((line, n) => {
        for (const span of line)
            if (span.ref !== undefined && ctx.refs[span.ref].line < 0)
                ctx.refs[span.ref].line = n
    })
    return { lines, refs: ctx.refs }
}

/*  mark the matches of a (global) regular expression within a line  */
export const markMatches = (line: Line, re: RegExp): Line => {
    const text  = line.map((span) => span.text).join("")
    const marks = new Array<boolean>(text.length).fill(false)
    let found = false
    for (const m of text.matchAll(re)) {
        if (m[0].length === 0)
            continue
        marks.fill(true, m.index, m.index + m[0].length)
        found = true
    }
    if (!found)
        return line
    const out = [] as Line
    let pos = 0
    for (const span of line) {
        for (let i = 0; i < span.text.length; i++)
            append(out, { ...span, text: span.text[i], match: marks[pos + i] })
        pos += span.text.length
    }
    return out
}

