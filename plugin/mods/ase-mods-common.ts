/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  Claude Code function hooks module ("mod", EARLY ACCESS):
    Common parts, shared by the grill table, the intent help, and the
    synopsis form: the styled characters of the terminal drawing, their
    Markdown conversion, wrapping, and framing, and the geometry of the
    master/detail view in the band above the prompt.  */

import type { Elements, ModelCompleteRequest, ModelForkResult,
    PromptBox, PromptFilled, RenderElement } from "claude-code"

/*  the services of the engine, bound by the hooking infrastructure for the
    modules (as the engine refuses to load a module passing "$" itself): the
    redrawing, the reading of a plugin file, the forked and the plain model
    completion, the waiting, and the reading and filling of the prompt  */
export type Engine = {
    invalidate: () => void,
    read:       (file: string) => Promise<string>,
    fork:       (prompt: string) => Promise<ModelForkResult | null>,
    complete:   (request: ModelCompleteRequest) => Promise<string>,
    sleep:      (ms: number) => Promise<void>,
    prompt:     () => Promise<PromptBox>,
    fill:       (text: string) => Promise<PromptFilled>
}

/*  the colors of a picked (resp. selected or focused) item and of a code span  */
export const PICKED = "red"
export const CODE   = "blue"

/*  the trigger suffix of an intent (resp. of a synopsis form) inside the prompt
    (each further constrained by the pattern of the intent resp. synopsis form)  */
export const TRIGGER = /\?\?$/

/*  the share of the terminal height taken by the band above the prompt, and
    the share of its columns taken by the master view of the intent band  */
export const BAND   = 0.25
export const MASTER = 0.3

/*  the self-drawn rounded frame around the content of the band above the
    prompt: the columns taken by its borders and its left padding, the
    columns before its content, and the rows taken by its edges, and the
    style of its lines (the dimmed default color, which renders as a darker
    grey than the "gray" color)  */
export const FRAME  = { cols: 3, lead: 2, rows: 2 } as const
export const BORDER = { dimColor: true } as const

/*  hold the prompt while the band above the prompt is shown: the text with a
    trailing space and backslash before the cursor and another space after it
    (so, as a move or deletion at either end of the prompt raises no edit, moves
    and deletions in both directions stay possible, and, as RETURN after a
    backslash inserts a newline instead of submitting the prompt, RETURN
    arrives as an edit, too, which keeps the cursor inside the prompt)  */
export const held = (text: string): PromptBox =>
    ({ text: `${text} \\ `, cursor: text.length + 2 })

/*  a single styled character of the terminal drawing  */
export type Char = { ch: string, bold: boolean, color: string | undefined }

/*  extract a section of a manual page (without its heading)  */
export const section = (manual: string, name: string): string =>
    manual.split(/^(?=## {2})/m).find((text) => text.startsWith(`##  ${name}`))?.replace(/^.*\n/, "") ?? ""

/*  convert inline Markdown (bold and code spans) into styled characters  */
export const style = (text: string, color: string | undefined): Char[] => {
    const chars: Char[] = []
    let bold = false
    let code = false
    for (let i = 0; i < text.length; i++) {
        if (!code && text.startsWith("**", i)) {
            bold = !bold
            i++
        }
        else if (text[i] === "`")
            code = !code
        else {
            const ch = String.fromCodePoint(text.codePointAt(i)!)
            chars.push({ ch, bold, color: color ?? (code ? CODE : undefined) })
            i += ch.length - 1
        }
    }
    return chars
}

/*  the width of styled characters in terminal cells  */
export const width = (chars: Char[]): number => {
    let n = 0
    for (const { ch } of chars) {
        const c = ch.codePointAt(0)!
        if ((c >= 0x200B && c <= 0x200D) || c === 0x2060 || c === 0xFEFF ||
            (c >= 0x0300 && c <= 0x036F) || (c >= 0xFE00 && c <= 0xFE0F))
            continue
        const wide =
            (c >= 0x1100  && c <= 0x115F) || (c >= 0x2E80  && c <= 0xA4CF) ||
            (c >= 0xAC00  && c <= 0xD7A3) || (c >= 0xF900  && c <= 0xFAFF) ||
            (c >= 0xFF00  && c <= 0xFF60) || (c >= 0x1F300 && c <= 0x1FAFF) ||
            (c >= 0x20000 && c <= 0x3FFFD)
        n += wide ? 2 : 1
    }
    return n
}

/*  hard-wrap styled characters at word boundaries to the given columns,
    indenting the first line by "lead" and all further lines by "indent"
    (and chopping overlong words)  */
export const wrap = (chars: Char[], columns: number, indent: number, lead = 0): Char[][] => {
    const space: Char = { ch: " ", bold: false, color: undefined }
    const words: Char[][] = [ [] ]
    for (const char of chars) {
        if (char.ch === " ")
            words.push([])
        else
            words.at(-1)!.push(char)
    }
    const lines: Char[][] = []
    let line: Char[] = Array.from({ length: lead }, () => space)
    let start = lead
    let size  = lead
    const flush = () => {
        lines.push(line)
        line  = Array.from({ length: indent }, () => space)
        start = indent
        size  = indent
    }
    for (let word of words.filter((word) => word.length > 0)) {
        while (word.length > 0) {
            const w = width(word)
            if (size > start && size + 1 + w <= columns) {
                line.push(space, ...word)
                size += 1 + w
                word = []
            }
            else if (size > start)
                flush()
            else {
                let n = 1
                while (n < word.length && width(word.slice(0, n + 1)) <= columns - start)
                    n++
                line.push(...word.slice(0, n))
                size += width(word.slice(0, n))
                word = word.slice(n)
                if (word.length > 0)
                    flush()
            }
        }
    }
    lines.push(line)
    return lines
}

/*  a run of equally styled characters  */
type Run = { text: string, bold: boolean, color: string | undefined }

/*  split a line of styled characters into runs of equally styled characters  */
export const split = (chars: Char[]): Run[] => {
    const runs: Run[] = []
    for (let i = 0, j = 0; i < chars.length; i = j) {
        const { bold, color } = chars[i]!
        while (j < chars.length && chars[j]!.bold === bold && chars[j]!.color === color)
            j++
        runs.push({ text: chars.slice(i, j).map((char) => char.ch).join(""), bold, color })
    }
    return runs
}

/*  convert plain text (without any Markdown) into equally styled characters  */
export const uniform = (text: string, bold: boolean, color: string | undefined): Char[] =>
    Array.from(text, (ch) => ({ ch, bold, color }))

/*  strip the single-asterisk emphasis outside the code spans of inline Markdown  */
const strip = (text: string): string =>
    text.split("`").map((part, i) => i % 2 === 0 ? part.replace(/(?<!\*)\*(?!\*)/g, "") : part).join("`")

/*  convert the Markdown blocks of a manual page section (paragraphs, list items,
    and code fences) into lines of styled characters, hard-wrapped to the given
    columns (except for the code lines), with a blank line between the blocks  */
export const flow = (text: string, columns: number): Char[][] => {
    const result: Char[][] = []
    let block: string[] = []
    let fence = false
    const flush = () => {
        if (block.length === 0)
            return
        if (result.length > 0)
            result.push([])
        const body = strip(block.map((line) => line.trim()).join(" "))
        const item = /^(-|\d+\.)\s+/.exec(body)
        if (item !== null) {
            const mark = item[1] === "-" ? "•" : item[1]!
            result.push(...wrap(style(`${mark} ${body.slice(item[0].length)}`, undefined), columns, mark.length + 1))
        }
        else
            result.push(...wrap(style(body, undefined), columns, 0))
        block = []
    }
    for (const line of text.trim().split("\n")) {
        if (line.startsWith("```")) {
            flush()
            if (!fence && result.length > 0)
                result.push([])
            fence = !fence
        }
        else if (fence)
            result.push(uniform(line, false, CODE))
        else if (line.trim() === "")
            flush()
        else {
            if (/^(?:-|\d+\.)\s/.test(line))
                flush()
            block.push(line)
        }
    }
    flush()
    return result
}

/*  surround lines of styled characters with a rounded box of the given total
    columns and border color (padding the lines to the inner columns)  */
export const frame = (lines: Char[][], columns: number, color: string | undefined): Char[][] => {
    const rim = (text: string) => uniform(text, false, color)
    return [
        rim(`╭${"─".repeat(columns - 2)}╮`),
        ...lines.map((line) => [ ...rim("│ "), ...line,
            ...uniform(" ".repeat(Math.max(0, columns - 4 - width(line))), false, undefined), ...rim(" │") ]),
        rim(`╰${"─".repeat(columns - 2)}╯`)
    ]
}

/*  split a horizontal edge of a frame into runs with a title placed after its
    first (resp. before its last) two characters (if it fits), flagged whether
    they are the title  */
const titled = (line: string, title: string, end = false): [ string, boolean ][] => {
    if (title === "" || line.length < title.length + 4)
        return [ [ line, false ] ]
    const k = end ? line.length - 2 - title.length : 2
    return [ [ line.slice(0, k), false ], [ title, true ], [ line.slice(k + title.length), false ] ]
}

/*  the scroll position of a view with the given rows over the given lines
    at the given scroll position, as placed into the bottom edge of a frame  */
export const position = (rows: number, lines: number, scroll: number): string =>
    lines === 0 ? "" : `[ lines ${scroll + 1}-${Math.min(scroll + rows, lines)}/${lines} ]`

/*  the mark of a scrollbar row: the thumb, the track, or nothing  */
type Mark = "thumb" | "track" | "none"

/*  determine the scrollbar of a view with the given rows over the given lines at
    the given scroll position: for each row the thumb, the track, or nothing  */
export const scrollbar = (rows: number, lines: number, scroll: number): Mark[] => {
    if (lines <= rows)
        return Array.from({ length: rows }, () => "none")
    const thumb  = Math.max(1, Math.round(rows * rows / lines))
    const offset = Math.round(scroll / (lines - rows) * (rows - thumb))
    return Array.from({ length: rows }, (_, i) => i >= offset && i < offset + thumb ? "thumb" : "track")
}

/*  determine the rows a scroll event moves a view by: a page of the given size
    for the scroll keys (PAGEUP/PAGEDOWN), resp. its rows for the wheel  */
export const paging = (e: { pointer?: unknown, by: number }, size: number): number =>
    e.pointer === undefined && Math.abs(e.by) > 1 ? Math.sign(e.by) * size : e.by

/*  the text element of the terminal surface  */
export type Text = Elements["terminal"]["Text"]

/*  draw a line of styled characters: its styled runs  */
export const paint = (Text: Text, chars: Char[]): (string | RenderElement)[] =>
    split(chars).map(({ text, bold, color }) =>
        bold || color !== undefined ? Text({ bold, color, children: text }) : text)

/*  draw a horizontal edge of the self-drawn frame (dimmed), with a title at its
    start (with its brackets dimmed, its "ASE" prefix in bold, and the rest dimmed)
    resp. at its end (dimmed)  */
export const edge = (Text: Text, line: string, title = "", end = false): RenderElement =>
    Text({ children: titled(line, title, end).flatMap(([ text, label ]) => {
        const m = /^(\[ )?([^:]*)(:.*?)( \])?$/.exec(text)
        if (!label || m === null)
            return [ Text({ ...BORDER, children: text }) ]
        return [
            ...(m[1] !== undefined ? [ Text({ ...BORDER, children: m[1] }) ] : []),
            Text({ bold: true, children: m[2]! }),
            Text({ dimColor: true, children: m[3]! }),
            ...(m[4] !== undefined ? [ Text({ ...BORDER, children: m[4] }) ] : [])
        ]
    }) })

/*  draw a row of a scrollbar: the thumb, the (dimmed) track, or nothing  */
export const bar = (Text: Text, mark: Mark | undefined): RenderElement =>
    mark === "thumb" ? Text({ children: "█" }) :
        mark === "track" ? Text({ dimColor: true, children: "░" }) : Text({ children: " " })

