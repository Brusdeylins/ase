/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  Claude Code function hooks module ("mod", EARLY ACCESS):
    Grill table, redrawing the grilling tables of ASE with one answer
    alternative per line (wrapped lines indented) and rendering in red
    the answers picked in the prompt via "nX" short responses and the
    question selected in the prompt via the last standalone "n". In the
    latest table, questions and answers are clickable and insert their
    "n" or "nX" into the prompt.
    Intent help, matching the still unsubmitted prompt, once suffixed with
    "??", as an intent against the help of all ASE skills (like the skill
    "ase-help-intent", but over the session context), and showing the
    proposed commands in the band above the prompt, where a digit picks
    one into the prompt, and "0" or any other key restores the prompt.
    Synopsis form, showing for a bare skill command, once suffixed with
    "??", the SYNOPSIS of its manual page as a form in the band above the
    prompt, where LEFT/RIGHT steps through its options and arguments (and
    shows their descriptions), SPACE toggles them, RETURN edits their
    values (with a drop-down box for fixed values), RETURN at the end takes
    over the composed command into the prompt, and BACKSPACE cancels.  */

import type { Register, RenderElement } from "claude-code"

/*  the marker line above a grilling table (single-round and multi-round,
    optionally labeled with the perspective and/or grounding)  */
const MARKER = /⧉ \*{0,2}ASE\*{0,2}: GRILLING(?: ROUND \d+\/\d+)?(?: \([^)]*\))?:/

/*  a row and the delimiter row of a Markdown table  */
const ROW  = /^ *\|.*\| *$/
const RULE = /^ *\|(?: *:?-+:? *\|)+ *$/

/*  the separator between two answers, the letter of
    an answer, and the number of a question  */
const ANSWER = /,\s+(?=\*{0,2}[A-Z]\*{0,2}\s+▶)/
const LETTER = /^\*{0,2}([A-Z])\*{0,2}\s+▶/
const NUMBER = /^\*{0,2}(\d+)\*{0,2}\s+▶/

/*  a short response "nX" inside the prompt  */
const PICK = /(?<![^\s,])(\d+)([a-zA-Z])(?![^\s,])/g

/*  a standalone question number "n" inside the prompt  */
const SELECT = /(?<![^\s,])(\d+)(?![^\s,])/g

/*  the indent of the wrapped lines of an answer, the colors of a picked answer
    and of a code span, and the size limit of a single "Markdown" element  */
const INDENT = 4
const PICKED = "red"
const CODE   = "blue"
const LIMIT  = 10000

/*  the trigger suffix of an intent inside the prompt, the maximum number of
    command proposals, the help corpus of all skills (relative to the plugin
    directory), and the fallback model without any session to fork  */
const TRIGGER   = /\s*\?\?$/
const PROPOSALS = 8
const CORPUS    = "skills/ase-help-intent/data.md"
const FALLBACK  = "sonnet"

/*  the trigger of a synopsis form inside the prompt (a bare skill command
    suffixed with "??"), the marker of the composed command shown inside
    the prompt while the form is shown, and the color of enabled fields  */
const SYNOPSIS = /^(\/(?:ase:)?(ase-[a-z0-9]+-[a-z0-9]+))\s*\?\?$/
const PREVIEW  = "⧉ "
const ENABLED  = "green"

/*  a single styled character of a table cell  */
type Char = { ch: string, bold: boolean, color: string | undefined }

/*  a grilling table with the Markdown text before and after it  */
type Table = {
    before: string,
    after:  string,
    header: string[],
    rows:   { number: number, question: string, answers: { letter: string, text: string }[] }[]
}

/*  split a Markdown table row into its cells  */
const cells = (line: string): string[] => {
    const result: string[] = []
    const body = line.trim().replace(/^\|/, "").replace(/\|$/, "")
    let cell = ""
    let code = false
    for (let i = 0; i < body.length; i++) {
        const ch = body[i]!
        if (ch === "`")
            code = !code
        if (!code && ch === "\\" && body[i + 1] === "|") {
            cell += "|"
            i++
        }
        else if (!code && ch === "|") {
            result.push(cell.trim())
            cell = ""
        }
        else
            cell += ch
    }
    result.push(cell.trim())
    return result
}

/*  parse the grilling table out of the text of a reply  */
const parse = (text: string): Table | undefined => {
    const lines = text.split("\n")
    const m = lines.findIndex((line) => MARKER.test(line))
    const h = lines.findIndex((line, i) => m !== -1 && i > m && ROW.test(line))
    if (h === -1 || !RULE.test(lines[h + 1] ?? ""))
        return undefined
    const header = cells(lines[h]!).map((cell) => cell.replace(/\*/g, ""))
    if (header.length !== 2 || header[0] !== "QUESTION" || !/^ANSWERS?$/.test(header[1]!))
        return undefined
    let end = h + 2
    while (end < lines.length && ROW.test(lines[end]!))
        end++
    const rows = lines.slice(h + 2, end).map((line) => cells(line))
    if (rows.some((row) => row.length !== 2))
        return undefined
    return {
        before: lines.slice(0, h).join("\n").trim(),
        after:  lines.slice(end).join("\n").replace(/^\n+/, "").trimEnd(),
        header,
        rows:   rows.map((row, i) => ({
            number:   Number(NUMBER.exec(row[0]!)?.[1] ?? i + 1),
            question: row[0]!,
            answers:  row[1]!.split(ANSWER).map((answer) =>
                ({ letter: LETTER.exec(answer)?.[1] ?? "", text: answer }))
        }))
    }
}

/*  the help of a single skill: its catalog entry and its entire manual page  */
type Help = { catalog: string, manual: string }

/*  a command proposal for an intent  */
type Proposal = { command: string, rationale: string }

/*  an intent under matching: the original prompt, the matching state, the
    status message, the command proposals, and the sequence number  */
type Intent = {
    draft:     string,
    state:     "busy" | "done" | "fail",
    message:   string,
    proposals: Proposal[],
    seq:       number
}

/*  parse the help corpus into the help of each skill, where
    the catalog entry is the NAME, SYNOPSIS, and SCENARIOS only  */
const helps = (text: string): Map<string, Help> => {
    const result = new Map<string, Help>()
    for (const m of text.matchAll(/<purpose name="([^"]+)">\n([\s\S]*?)<\/purpose>/g)) {
        const manual  = m[2]!.trim()
        const catalog = manual.split(/^(?=## {2})/m)
            .filter((section) => /^## {2}(?:NAME|SYNOPSIS|SCENARIOS)\b/.test(section))
            .join("").trim()
        result.set(m[1]!, { catalog, manual })
    }
    return result
}

/*  extract the text of a model reply: a plain string or an answered result
    (covering the result shapes of both older and newer Claude Code versions)  */
const reply = (result: unknown): string | undefined => {
    if (typeof result === "string")
        return result
    if (typeof result === "object" && result !== null) {
        const r = result as { isAnswered?: boolean, text?: unknown }
        if (r.isAnswered !== false && typeof r.text === "string")
            return r.text
    }
    return undefined
}

/*  extract the JSON array out of a model reply  */
const array = (text: string | undefined): unknown[] | undefined => {
    const i = text?.indexOf("[") ?? -1
    const j = text?.lastIndexOf("]") ?? -1
    if (text === undefined || i === -1 || j < i)
        return undefined
    try {
        const value: unknown = JSON.parse(text.slice(i, j + 1))
        return Array.isArray(value) ? value : undefined
    }
    catch {
        return undefined
    }
}

/*  the prompt for selecting the fitting skills out of the catalog  */
const selection = (draft: string, catalog: string) => `
Do *not* call any tools and do *not* perform the following intent!
Instead, only *match* the following free-text intent, interpreted in the
context of this session, against the following catalog of ASE skills:

<intent>
${draft}
</intent>

<catalog>
${catalog}
</catalog>

Select *every* skill which adequately fits the intent -- judging the
fit primarily by its SCENARIOS -- ordered from best-fitting to
worst-fitting, and keep at most the ${PROPOSALS} best ones. Reply with
a JSON array of the skill names only (like \`[ "ase-code-lint" ]\`),
resp. with an empty JSON array if no skill fits, and nothing else.
`

/*  the prompt for generating the commands out of the manual pages  */
const generation = (draft: string, manuals: string) => `
Do *not* call any tools and do *not* perform the following intent!
Instead, only *generate* commands which realize the following free-text
intent, interpreted in the context of this session, out of the
following manual pages of ASE skills:

<intent>
${draft}
</intent>

<manuals>
${manuals}
</manuals>

For each skill, in the given order, generate a concrete command which
realizes the intent, with the option flags and positional arguments
derived from its SYNOPSIS, OPTIONS, and ARGUMENTS, and their concrete
values taken from the intent and the context of this session. Reply with
a JSON array of objects \`{ "command": "/ase:<skill> <arguments>",
"rationale": "<justification>" }\`, where the justification is a *very
brief*, single-sentence explanation of why the skill and its arguments
match the intent, and nothing else.
`

/*  a field of a synopsis form: an option (a flag or with a value) or an argument,
    with its placeholder, fixed values, value suffix, description, and state  */
type Field = {
    kind:     "option" | "argument",
    name:     string,
    label:    string,
    choices:  string[],
    list:     boolean,
    valued:   boolean,
    suffix:   string,
    required: boolean,
    help:     string,
    enabled:  boolean,
    value:    string
}

/*  a synopsis form: the skill command, its fields, the focused field (the
    apply position after the last field), and the state of an edited field  */
type Form = {
    command: string,
    fields:  Field[],
    pos:     number,
    edit:    boolean,
    buffer:  string,
    caret:   number,
    choice:  number,
    picked:  Set<string>
}

/*  a key pressed in a synopsis form: its name, its typed text, its cursor
    step (-1 left, +1 right), and its deletion (-1 backward, +1 forward)  */
type Key = { name: string, text: string, step: number, erase: number }

/*  extract a section of a manual page (without its heading)  */
const section = (manual: string, name: string): string =>
    manual.split(/^(?=## {2})/m).find((text) => text.startsWith(`##  ${name}`))?.replace(/^.*\n/, "") ?? ""

/*  extract the descriptions of the (usually bulleted) items of a manual page
    section, keyed by every match of a global pattern in the head line of each item  */
const descriptions = (text: string, key: RegExp): Map<string, string> => {
    const result = new Map<string, string>()
    for (const item of text.split(/^(?=(?:- {3})?[`*[])/m).filter((item) => /^(?:- {3})?[`*[]/.test(item))) {
        const [ head, ...body ] = item.split("\n")
        const help = `${head!.replace(/^- {3}/, "").replace(/:$/, "")}\n\n` +
            body.map((line) => line.replace(/^ {4}/, "")).join("\n").trim()
        for (const m of head!.matchAll(key))
            if (!result.has(m[1]!))
                result.set(m[1]!, help)
    }
    return result
}

/*  split an argument line of a synopsis into its top-level units  */
const units = (line: string): string[] => {
    const result: string[] = []
    let unit  = ""
    let depth = 0
    for (const ch of line) {
        if (ch === " " && depth === 0) {
            if (unit !== "")
                result.push(unit)
            unit = ""
        }
        else {
            depth += ch === "[" ? 1 : ch === "]" ? -1 : 0
            unit  += ch
        }
    }
    if (unit !== "")
        result.push(unit)
    return result
}

/*  parse the SYNOPSIS of a manual page into the fields of a synopsis form, where
    the fields of all synopsis variants are merged (those of further variants and
    of alternative groups as optional ones) and the "--help" option is skipped  */
const synopsis = (manual: string): Field[] => {
    const opthelp = descriptions(section(manual, "OPTIONS"), /`(--[\w-]+)`/g)
    const arghelp = descriptions(section(manual, "ARGUMENTS"), /\*([^*]+)\*/g)
    const result: Field[] = []
    let variants = 0
    for (const line of section(manual, "SYNOPSIS").split("\n").map((line) => line.trim())) {
        const name = /^`ase-[a-z0-9]+-[a-z0-9]+`$/.test(line)
        variants += name ? 1 : 0
        if (line === "" || name)
            continue
        const group = /^\(.*\)$/.test(line)
        const parts = group ? line.slice(1, -1).split(" | ") : line.includes("`--") ? [ line ] : units(line)
        for (const part of parts) {
            const required = !group && variants <= 1 && !part.startsWith("[")
            const inner    = part.replace(/^\[(.*)\]$/, "$1")
            const long     = /`(--[\w-]+)/.exec(inner)?.[1]
            if (long !== undefined) {
                if (long === "--help" || result.some((field) => field.name === long))
                    continue
                const rest    = inner.replace(/`-{1,2}[\w-]+(?:=[^`]*)?`/g, "").replace(/^[\s|]+/, "")
                const preset  = /`-{1,2}[\w-]+=([^`]+)`/.exec(inner)?.[1]
                const choices = [ ...rest.matchAll(/`([\w.-]+)`/g) ].map((m) => m[1]!)
                const label   = choices.length > 0 ? choices.join("|") :
                    (rest.replace(/[`*]/g, "").replace(/^[\s=]+/, "").trim() || (preset ?? ""))
                result.push({ kind: "option", name: long, label, choices, list: rest.includes("..."),
                    valued: label !== "", suffix: "", required, help: opthelp.get(long) ?? "",
                    enabled: required, value: "" })
            }
            else {
                const label = inner.replace(/[`*]/g, "")
                if (result.some((field) => field.name === label))
                    continue
                const names = [ ...new Set([ ...inner.matchAll(/\*([^*]+)\*/g) ].map((m) => m[1]!)) ]
                result.push({ kind: "argument", name: label, label, choices: [], list: inner.includes("..."),
                    valued: true, suffix: /^\*[^*]+\*`:`$/.test(inner) ? ":" : "", required,
                    help: names.flatMap((name) => arghelp.get(name) ?? []).join("\n\n"),
                    enabled: required, value: "" })
            }
        }
    }
    return result
}

/*  compose the command of a synopsis form out of its enabled fields
    (double-quoting option values with whitespace or quotes)  */
const compose = (form: Form): string => {
    const words = [ form.command ]
    for (const field of form.fields.filter((field) => field.enabled)) {
        const value = field.value !== "" && !field.value.endsWith(field.suffix) ? field.value + field.suffix : field.value
        if (field.kind === "option")
            words.push(value === "" ? field.name : `${field.name} ` +
                (/[\s"'\\]/.test(value) ? `"${value.replace(/(["\\])/g, "\\$1")}"` : value))
        else if (value !== "")
            words.push(value)
    }
    return words.join(" ")
}

/*  operate a synopsis form by a key: outside a field, step through the fields
    (LEFT/RIGHT), toggle the focused one (SPACE), enter its editing or toggle
    a flag (RETURN), apply the form (RETURN at the end), or cancel the form
    (BACKSPACE); inside a field, choose a fixed value (LEFT/RIGHT/UP/DOWN or
    its initial letter) and pick it for a list (SPACE), resp. edit the text,
    and leave the field with (RETURN) or, for fixed values, without (BACKSPACE)
    taking over the value  */
const operate = (form: Form, key: Key): "apply" | "cancel" | undefined => {
    const field = form.fields[form.pos]
    if (key.name === "return") {
        if (field === undefined)
            return "apply"
        if (form.edit) {
            field.value = field.choices.length === 0 ? form.buffer.trim() :
                field.list && form.picked.size > 0 ? field.choices.filter((choice) => form.picked.has(choice)).join(",") :
                field.choices[form.choice]!
            field.enabled = field.required || field.value !== ""
            form.edit     = false
        }
        else if (field.valued) {
            form.edit   = true
            form.buffer = field.value
            form.caret  = field.value.length
            form.choice = Math.max(0, field.choices.indexOf(field.value))
            form.picked = new Set(field.value.split(",").filter((value) => field.choices.includes(value)))
        }
        else
            field.enabled = !field.enabled
    }
    else if (!form.edit || field === undefined) {
        if (key.step !== 0)
            form.pos = Math.max(0, Math.min(form.fields.length, form.pos + key.step))
        else if (key.text === " " && field !== undefined)
            field.enabled = !field.enabled
        else if (key.erase < 0)
            return "cancel"
    }
    else if (field.choices.length > 0) {
        const n = field.choices.length
        if (key.step !== 0 || key.name === "up" || key.name === "down")
            form.choice = (form.choice + n + (key.step < 0 || key.name === "up" ? -1 : 1)) % n
        else if (key.text === " " && field.list) {
            const choice = field.choices[form.choice]!
            if (!form.picked.delete(choice))
                form.picked.add(choice)
        }
        else if (key.erase < 0)
            form.edit = false
        else if (key.text.length === 1) {
            const k = field.choices.findIndex((choice) => choice.toLowerCase().startsWith(key.text.toLowerCase()))
            if (k !== -1)
                form.choice = k
        }
    }
    else {
        const { buffer, caret } = form
        if (key.step !== 0)
            form.caret = Math.max(0, Math.min(buffer.length, caret + key.step))
        else if (key.erase < 0 && caret > 0) {
            form.buffer = buffer.slice(0, caret - 1) + buffer.slice(caret)
            form.caret  = caret - 1
        }
        else if (key.erase > 0)
            form.buffer = buffer.slice(0, caret) + buffer.slice(caret + 1)
        else if (key.text !== "") {
            const text  = key.text.replace(/\s+/g, " ")
            form.buffer = buffer.slice(0, caret) + text + buffer.slice(caret)
            form.caret  = caret + text.length
        }
    }
    return undefined
}

/*  determine the picked answer letter of each question out of a prompt (last pick wins)  */
const pick = (text: string): Map<number, string> =>
    new Map([ ...text.matchAll(PICK) ].map((m) => [ Number(m[1]!), m[2]!.toUpperCase() ]))

/*  determine the selected question number out of a prompt (last standalone number wins)  */
const select = (text: string): number | undefined => {
    const m = [ ...text.matchAll(SELECT) ].at(-1)
    return m !== undefined ? Number(m[1]!) : undefined
}

/*  the standalone tokens of question "n" inside the prompt: its bare
    number "n" (letter "") or its short responses "nX" (letter "[a-zA-Z]")  */
const token = (number: number, letter: string): RegExp =>
    new RegExp(`(?<![^\\s,])${number}${letter}(?![^\\s,])`, "g")

/*  insert the number "n" of a clicked question or the short response "nX" of a
    clicked answer into a prompt. Answer: an existing "nY" is replaced in place
    (and a bare "n" removed), else a bare "n" is replaced in place, else "nX" is
    appended. Question: an existing bare "n" is kept, else the last bare number
    of another question (the selected one) is replaced in place, else "n" is
    appended.  */
const insert = (text: string, number: number, letter?: string): string => {
    const bare  = token(number, "")
    const picks = token(number, "[a-zA-Z]")
    if (letter !== undefined && text.search(picks) !== -1)
        return text.replace(picks, `${number}${letter}`)
            .replace(new RegExp(`\\s*${bare.source}`, "g"), "").trimStart()
    if (text.search(bare) !== -1)
        return letter !== undefined ? text.replace(bare, `${number}${letter}`) : text
    const last = letter === undefined ? [ ...text.matchAll(SELECT) ].at(-1) : undefined
    if (last !== undefined)
        return text.slice(0, last.index) + String(number) + text.slice(last.index + last[0].length)
    const head = text.trimEnd()
    return `${head}${head !== "" ? " " : ""}${number}${letter ?? ""}`
}

/*  convert inline Markdown (bold and code spans) into styled characters  */
const style = (text: string, color: string | undefined): Char[] => {
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
const width = (chars: Char[]): number => {
    let n = 0
    for (const { ch } of chars) {
        const c = ch.codePointAt(0)!
        if (c === 0x200B || c === 0x2060 || (c >= 0x0300 && c <= 0x036F) || (c >= 0xFE00 && c <= 0xFE0F))
            continue
        const wide =
            (c >= 0x1100  && c <= 0x115F) || (c >= 0x2E80  && c <= 0xA4CF) ||
            (c >= 0xAC00  && c <= 0xD7A3) || (c >= 0xF900  && c <= 0xFAFF) ||
            (c >= 0xFF00  && c <= 0xFF60) || (c >= 0x1F300 && c <= 0x1FAFF)
        n += wide ? 2 : 1
    }
    return n
}

/*  hard-wrap styled characters at word boundaries to the given columns,
    indenting the first line by "lead" and all further lines by "indent"
    (and chopping overlong words)  */
const wrap = (chars: Char[], columns: number, indent: number, lead = 0): Char[][] => {
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

/*  function hook registration entry point  */
export const register: Register = (on, options) => {
    /*  allow the rendering to be disabled without disabling the plugin  */
    if (options.enabled === false)
        return

    /*  the last known width of the terminal, the already seen tables, the
        latest (still unanswered) table, the picks and the selected question of the
        still unsubmitted prompt, and the frozen picks of the already answered tables  */
    let columns  = 80
    const seen   = new Set<string>()
    let latest: string | undefined
    let picks    = new Map<number, string>()
    let selected: number | undefined
    const frozen = new Map<string, Map<number, string>>()

    /*  the help of all skills (loaded on first use), the currently
        shown intent, and the sequence number of the last intent  */
    let corpus: Map<string, Help> | undefined
    let intent: Intent | undefined
    let seq = 0

    /*  the synopsis fields of the skills (loaded on first use, undefined
        for a skill without a manual page) and the currently shown form  */
    const synopses = new Map<string, Field[] | undefined>()
    let form: Form | undefined

    /*  handle the still unsubmitted prompt of the user  */
    on("prompt.edit", async ($, e, next) => {
        /*  track the picks inside the edited prompt  */
        const track = <T extends { text: string }>(box: T): T => {
            const now = pick(box.text)
            const sel = select(box.text)
            if (JSON.stringify([ ...now ]) !== JSON.stringify([ ...picks ]) || sel !== selected) {
                picks    = now
                selected = sel
                $.ui.invalidate("ui.render")
            }
            return box
        }

        /*  while the intent band is shown: a digit of a proposal picks it, another
            digit is ignored, and "0" or any other key closes the band and restores
            the prompt (with a typed text applied to its end)  */
        if (intent !== undefined) {
            const { draft, state, proposals } = intent
            const n = /^\d$/.test(e.inputText) ? Number(e.inputText) : 0
            if (n > 0 && (state !== "done" || n > proposals.length))
                return { text: e.text, cursor: e.cursor }
            intent = undefined
            $.ui.invalidate("ui.render")
            if (n > 0) {
                const command = `${proposals[n - 1]!.command} `
                return track({ text: command, cursor: command.length })
            }
            if (e.inputText === "" || e.inputText === "0")
                return track({ text: draft, cursor: draft.length })
            return track(await next({ ...e, text: draft, cursor: draft.length, start: draft.length, end: draft.length }))
        }

        /*  while the synopsis form is shown, every edit is a key of the form, where
            cursor moves and deletions are told by their splice (as a move at either
            end of the prompt raises none), and the prompt shows the composed command
            with the cursor kept inside it (so moves in both directions stay possible)  */
        if (form !== undefined) {
            const current = form
            const name    = e.inputText === "\n" ? "return" : e.key?.key ?? ""
            const erased  = e.inputText === "" && e.end > e.start
            const result  = operate(current, {
                name,
                text:  e.inputText === "\n" ? "" : e.inputText,
                step:  name === "left" ? -1 : name === "right" ? 1 :
                    e.inputText === "" && !erased ? Math.sign(e.start - e.cursor) : 0,
                erase: erased ? (e.start < e.cursor ? -1 : 1) : 0
            })
            $.ui.invalidate("ui.render")
            if (result !== undefined) {
                form = undefined
                const text = result === "apply" ? `${compose(current)} ` : `${current.command} `
                return track({ text, cursor: text.length })
            }
            return { text: `${PREVIEW}${compose(current)}`, cursor: PREVIEW.length - 1 }
        }

        /*  act on the typed trigger suffix at the end of the prompt only  */
        const box = await next(e)
        if (e.inputText !== "?" || box.cursor !== box.text.length || !TRIGGER.test(box.text))
            return track(box)

        /*  for a bare skill command with a manual page, show its synopsis form  */
        const command = SYNOPSIS.exec(box.text)
        if (command !== null) {
            const skill = command[2]!
            if (!synopses.has(skill)) {
                const manual = await $.fs.read(`${$.plugin.root}/skills/${skill}/help.md`).catch(() => undefined)
                synopses.set(skill, manual !== undefined ? synopsis(manual) : undefined)
            }
            const fields = synopses.get(skill)
            if (fields !== undefined) {
                form = { command: command[1]!, fields: fields.map((field) => ({ ...field })),
                    pos: 0, edit: false, buffer: "", caret: 0, choice: 0, picked: new Set() }
                $.ui.invalidate("ui.render")
                return { text: `${PREVIEW}${compose(form)}`, cursor: PREVIEW.length - 1 }
            }
        }
        const draft = box.text.replace(TRIGGER, "")
        if (draft.trim() === "")
            return track(box)

        /*  stash the prompt as the intent, clear the prompt (so a bare digit
            presses a band button), and match the intent in the background  */
        const current: Intent = { draft, state: "busy", message: "matching intent...", proposals: [], seq: ++seq }
        intent = current
        $.ui.invalidate("ui.render")

        /*  update the intent, unless it was closed in the meantime  */
        const settle = (state: Intent["state"], message: string, proposals: Proposal[] = []) => {
            if (intent !== current)
                return
            Object.assign(current, { state, message, proposals })
            $.ui.invalidate("ui.render")
        }

        /*  ask the model over the transcript of the session (sharing its prompt
            cache), or without any session context if there is nothing to fork yet  */
        const ask = async (prompt: string): Promise<string | undefined> => {
            const forked = await $.model.fork({ prompt }) as unknown
            const cold   = forked === null || (forked as { reason?: string }).reason === "nothing-to-fork"
            return reply(cold ? await $.model.complete({ model: FALLBACK, prompt, maxTokens: 4096 }) : forked)
        }

        /*  match the intent in two stages: select the fitting skills out of
            the catalog, then generate the commands out of their manual pages  */
        const match = async () => {
            const skills  = corpus ??= helps(await $.fs.read(`${$.plugin.root}/${CORPUS}`))
            const catalog = [ ...skills ].map(([ name, help ]) =>
                `<skill name="${name}">\n${help.catalog}\n</skill>`).join("\n")
            const names = (array(await ask(selection(draft, catalog))) ?? [])
                .filter((name): name is string => typeof name === "string" && skills.has(name))
                .slice(0, PROPOSALS)
            if (intent !== current)
                return
            if (names.length === 0) {
                settle("fail", "no confident match for the intent -- please refine or clarify it")
                return
            }
            settle("busy", `generating commands for ${names.join(", ")}...`)
            const manuals = names.map((name) =>
                `<skill name="${name}">\n${skills.get(name)!.manual}\n</skill>`).join("\n")
            const proposals = (array(await ask(generation(draft, manuals))) ?? [])
                .flatMap((item): Proposal[] => {
                    const { command, rationale } = (item ?? {}) as { command?: unknown, rationale?: unknown }
                    if (typeof command !== "string" || !/^\/?ase:ase-[a-z]+-[a-z]+\b/.test(command.trim()))
                        return []
                    return [ {
                        command:   command.trim().replace(/^ase:/, "/ase:").replace(/\s+/g, " "),
                        rationale: typeof rationale === "string" ? rationale.trim().replace(/\s+/g, " ") : ""
                    } ]
                })
                .slice(0, PROPOSALS)
            if (proposals.length === 0)
                settle("fail", "no commands generated for the intent -- please refine or clarify it")
            else
                settle("done", "pick a command", proposals)
        }
        match().catch((err: unknown) => {
            settle("fail", `matching failed: ${err instanceof Error ? err.message : String(err)}`)
        })
        return track({ text: "", cursor: 0 })
    })

    /*  operate the synopsis form by RETURN, resp. freeze the picks in the latest
        table and close the intent band once the prompt is submitted  */
    on("prompt.submit", ($, e, next) => {
        /*  while the synopsis form is shown, RETURN at the prompt is a key of the
            form, entering nothing and refilling the prompt (once immediately and
            once again after the prompt was possibly cleared by the submission)  */
        if (form !== undefined && e.origin.kind === "composer") {
            const current = form
            const result  = operate(current, { name: "return", text: "", step: 0, erase: 0 })
            if (result !== undefined)
                form = undefined
            $.ui.invalidate("ui.render")
            const text = result !== undefined ? `${compose(current)} ` : `${PREVIEW}${compose(current)}`
            const fill = () => $.prompt.fill({ text }).then((box) => {
                if (form === undefined) {
                    picks    = pick(box.text)
                    selected = select(box.text)
                    $.ui.invalidate("ui.render")
                }
            })
            fill().then(() => $.clock.sleep(100)).then(fill).catch(() => {
                /*  ignore a prompt which is no longer accessible  */
            })
            return { text: e.text }
        }

        if (latest !== undefined)
            frozen.set(latest, pick(e.text))
        latest   = undefined
        picks    = new Map()
        selected = undefined
        intent   = undefined
        $.ui.invalidate("ui.render")
        return next(e)
    }).catch(($, e, next) =>
        /*  never let a failed RETURN of the synopsis form enter its composed command  */
        next.called || form === undefined ? next(e) : { drop: "synopsis form failed" })

    /*  redraw the replies which contain a grilling table (terminal only)  */
    on("ui.render", { component: "AssistantMessage", surface: "terminal" }, async ($, e, next) => {
        /*  act on grilling tables only, which fit into the terminal
            (gutter, grid lines, cell paddings, and a spare column subtracted)  */
        columns = e.viewport?.columns ?? columns
        const table = parse(e.props.text)
        const avail = columns - 2 - 7 - 1
        if (table === undefined || avail < 40 || table.before.length > LIMIT || table.after.length > LIMIT)
            return next(e)

        /*  let the chain beneath run, although its drawing is replaced by us
            (but this at least silences a warning in the debug output of Claude Code)  */
        await next(e)

        /*  determine the picks: frozen ones or, for the latest table, the live ones  */
        if (!seen.has(e.requestId)) {
            seen.add(e.requestId)
            latest = e.requestId
        }
        const chosen = frozen.get(e.requestId) ?? (e.requestId === latest ? picks : undefined)
        const marked = e.requestId === latest ? selected : undefined

        /*  style the cells and determine the column widths, right-aligning the
            question numbers to the widest one (so the wrapped lines of all
            questions share the same indent)  */
        const head   = table.header.map((cell) => style(`**${cell}**`, undefined))
        const digits = Math.max(...table.rows.map((row) => String(row.number).length))
        const rows   = table.rows.map((row) => {
            const numbered = NUMBER.test(row.question)
            return {
                lead:     numbered ? digits - String(row.number).length : 0,
                indent:   numbered ? digits + 3 : 0,
                question: style(row.question, marked === row.number ? PICKED : undefined),
                answers:  row.answers.map((answer) =>
                    style(answer.text, chosen?.get(row.number) === answer.letter ? PICKED : undefined))
            }
        })
        const w1nat = Math.max(width(head[0]!), ...rows.map((row) => row.lead + width(row.question)))
        const w2nat = Math.max(width(head[1]!), ...rows.flatMap((row) => row.answers.map((answer) => width(answer))))
        let   w1    = Math.min(w1nat, Math.floor(avail * 0.4))
        const w2    = Math.min(w2nat, avail - w1)
        w1          = Math.min(w1nat, avail - w2)

        /*  resolve the UI elements  */
        const { Box, Text, Button, Markdown } = $.ui.resolve(e)

        /*  split a line of a cell into runs of equally styled characters  */
        const split = (chars: Char[]): { text: string, bold: boolean, color: string | undefined }[] => {
            const runs: { text: string, bold: boolean, color: string | undefined }[] = []
            for (let i = 0, j = 0; i < chars.length; i = j) {
                const { bold, color } = chars[i]!
                while (j < chars.length && chars[j]!.bold === bold && chars[j]!.color === color)
                    j++
                runs.push({ text: chars.slice(i, j).map((char) => char.ch).join(""), bold, color })
            }
            return runs
        }

        /*  draw a line of a cell: its styled runs, padded to the column width  */
        const paint = (chars: Char[], span: number): (string | RenderElement)[] => [
            ...split(chars).map(({ text, bold, color }) =>
                bold || color !== undefined ? Text({ bold, color, children: text }) : text),
            " ".repeat(Math.max(0, span - width(chars)))
        ]

        /*  insert the number of a clicked question or the short response of a clicked
            answer into the prompt and refresh the picks and the selection from it  */
        const press = (number: number, letter?: string) => () => {
            $.prompt.read()
                .then(({ text }) => $.prompt.fill({ text: insert(text, number, letter) }))
                .then((box) => {
                    picks    = pick(box.text)
                    selected = select(box.text)
                    $.ui.invalidate("ui.render")
                })
                .catch(() => {
                    /*  ignore a prompt which is no longer accessible  */
                })
        }

        /*  draw a line of a cell: in the latest table as the styled text inside a
            hover-scoping box, which while any line of its group (all lines of the
            same question or answer) is hovered reveals a row of clickable plain
            buttons (one per styled run, inversed in the default colors and carrying
            the run's bold style, but not its color, as its hover style, because the
            engine leaves the space cells uncolored) on top of it; otherwise as
            styled text only  */
        const draw = (chars: Char[], span: number, group: string, line: number,
            onPress: () => void): RenderElement[] => {
            const w = width(chars)
            if (e.requestId !== latest || w === 0)
                return [ Text({ children: paint(chars, span) }) ]
            const buttons = split(chars).map(({ text, bold }, r) =>
                Button({ key: `${group}/${line}/${r}`, label: text, plain: true, onPress,
                    hover: { scope: group, inverse: true, bold } }))
            return [
                Box({ key: `${group}/${line}`, hover: { scope: group }, children: [
                    Text({ children: paint(chars, w) }),
                    Box({ position: "absolute", top: 0, left: 0, display: "none",
                        hover: { scope: group, display: "flex" }, flexDirection: "row", children: buttons })
                ] }),
                Text({ children: " ".repeat(Math.max(0, span - w)) })
            ]
        }

        /*  draw the table as a grid: a rule between all rows and one answer per line  */
        const rule = (l: string, m: string, r: string) =>
            Text({ wrap: "truncate-end", children: l + "─".repeat(w1 + 2) + m + "─".repeat(w2 + 2) + r })
        const grid: RenderElement[] = [ rule("┌", "┬", "┐") ]
        grid.push(Text({ wrap: "truncate-end", children:
            [ "│ ", ...paint(head[0]!, w1), " │ ", ...paint(head[1]!, w2), " │" ] }))
        grid.push(rule("├", "┼", "┤"))
        rows.forEach((row, k) => {
            const number = table.rows[k]!.number
            const q = wrap(row.question, w1, row.indent, row.lead).map((line, i) =>
                draw(line, w1, `q${number}`, i, press(number)))
            const a = row.answers.flatMap((answer, j) => {
                const letter = table.rows[k]!.answers[j]!.letter
                return wrap(answer, w2, INDENT).map((line, i) =>
                    draw(line, w2, `a${number}${letter}`, i, press(number, letter)))
            })
            for (let i = 0; i < Math.max(q.length, a.length); i++)
                grid.push(Box({ flexDirection: "row", children: [
                    Text({ children: "│ " }),
                    ...(q[i] ?? [ Text({ children: " ".repeat(w1) }) ]),
                    Text({ children: " │ " }),
                    ...(a[i] ?? [ Text({ children: " ".repeat(w2) }) ]),
                    Text({ children: " │" })
                ] }))
            grid.push(k < rows.length - 1 ? rule("├", "┼", "┤") : rule("└", "┴", "┘"))
        })

        /*  mimic the reply row of the engine: blank row above and bullet gutter  */
        return Box({ flexDirection: "row", marginTop: 1, width: "100%", children: [
            Box({ flexShrink: 0, minWidth: 2, children: Text({ children: e.props.isFirstOfReply ? "⏺" : " " }) }),
            Box({ flexDirection: "column", flexGrow: 1, flexShrink: 1, children: [
                ...(table.before !== "" ? [ Markdown({ text: table.before }) ] : []),
                Box({ flexDirection: "column", marginTop: table.before !== "" ? 1 : 0, children: grid }),
                ...(table.after !== "" ? [ Box({ marginTop: 1, children: Markdown({ text: table.after }) }) ] : [])
            ] })
        ] })
    })

    /*  draw the intent and its command proposals into the band above the prompt (terminal only)  */
    on("ui.render", { component: "AbovePrompt", surface: "terminal" }, async ($, e, next) => {
        /*  yield to a survey and draw nothing without an intent  */
        if (intent === undefined || e.props.hasSurvey)
            return next(e)
        await next(e)
        const current = intent

        /*  resolve the UI elements and determine the available
            columns and the number of proposals fitting into the rows
            (as a scrolling band would no longer arm the hotkeys)  */
        const { Box, Text, Button } = $.ui.resolve(e)
        const span = Math.max(20, e.props.bodyColumns - 4)
        const fit  = Math.max(0, Math.min(current.proposals.length, e.props.maxRows - 2))
        const clip = (text: string, n: number) =>
            text.length > n ? `${text.slice(0, n - 1)}…` : text

        /*  close the band and fill the prompt with a picked command resp. the original prompt  */
        const close = (text: string) => {
            if (intent !== current)
                return
            intent = undefined
            $.ui.invalidate("ui.render")
            $.prompt.fill({ text }).catch(() => {
                /*  ignore a prompt which is no longer accessible  */
            })
        }

        /*  draw the intent, the status message or the proposals, and the cancel button  */
        const rows: RenderElement[] = [
            Text({ wrap: "truncate-end", children: [
                Text({ bold: true, children: "⧉ ASE: INTENT: " }),
                clip(current.draft.replace(/\s+/g, " "), span - 14)
            ] })
        ]
        if (current.state !== "done")
            rows.push(Text({ dimColor: true, wrap: "truncate-end", children: `  ${current.message}` }))
        current.proposals.slice(0, fit).forEach((proposal, i) => {
            rows.push(Box({ flexDirection: "row", children: [
                Text({ children: "  " }),
                Button({ key: `intent/${current.seq}/${i}`, label: clip(proposal.command, span - 3),
                    hotkey: String(i + 1), plain: true, onPress: () => close(`${proposal.command} `) }),
                Box({ flexShrink: 1, children: Text({ dimColor: true, wrap: "truncate-end",
                    children: proposal.rationale !== "" ? `  ▷ ${proposal.rationale}` : "" }) })
            ] }))
        })
        rows.push(Box({ flexDirection: "row", children: [
            Text({ children: "  " }),
            Button({ key: `intent/${current.seq}/cancel`, label: "cancel (restore prompt)",
                hotkey: "0", plain: true, onPress: () => close(current.draft) })
        ] }))
        return Box({ flexDirection: "column", width: "100%", children: rows })
    })

    /*  draw the synopsis form into the band above the prompt (terminal only)  */
    on("ui.render", { component: "AbovePrompt", surface: "terminal" }, async ($, e, next) => {
        /*  yield to a survey and draw nothing without a synopsis form  */
        if (form === undefined || e.props.hasSurvey)
            return next(e)
        await next(e)
        const current = form
        const focused = current.fields[current.pos]
        const editing = focused !== undefined && current.edit

        /*  resolve the UI elements and determine the available columns  */
        const { Box, Text, Markdown } = $.ui.resolve(e)
        const span = Math.max(20, e.props.bodyColumns - 1)

        /*  draw the input box of a field: its text with the caret while being
            edited, its chosen fixed value(s) while being chosen, its value, or
            its dimmed placeholder (inversed while focused outside a field)  */
        const input = (field: Field, focus: boolean): RenderElement => {
            const { buffer, caret, choice, picked } = current
            if (focus && editing && field.choices.length === 0)
                return Text({ underline: true, children: [
                    buffer.slice(0, caret),
                    Text({ inverse: true, children: buffer[caret] ?? " " }),
                    buffer.slice(caret + 1)
                ].filter((child) => child !== "") })
            const value = !(focus && editing) ? field.value :
                field.list && picked.size > 0 ? field.choices.filter((value) => picked.has(value)).join(",") :
                field.choices[choice]!
            const mark = focus && !editing
            return value !== "" ?
                Text({ underline: true, inverse: mark, children: value }) :
                Text({ underline: true, italic: true, dimColor: true, inverse: mark, children: field.label })
        }

        /*  draw a field: optional ones in brackets, enabled ones highlighted,
            options by their name and, if valued, their input box  */
        const draw = (field: Field, i: number): RenderElement => {
            const focus = current.pos === i
            const look  = { bold: field.enabled, color: field.enabled ? ENABLED : undefined, dimColor: !field.enabled }
            const children: RenderElement[] = []
            if (!field.required)
                children.push(Text({ dimColor: true, children: "[" }))
            if (field.kind === "option")
                children.push(Text({ ...look, inverse: focus && !editing, children: field.name }))
            if (field.kind === "option" && field.valued)
                children.push(Text({ children: " " }))
            if (field.valued)
                children.push(input(field, focus))
            if (!field.required)
                children.push(Text({ dimColor: true, children: "]" }))
            return Text({ children })
        }

        /*  draw the synopsis (the command, its fields, and the apply position)
            and below it a rule, the drop-down box of a field with fixed values
            while being edited, the description of the focused field (resp. the
            composed command at the apply position), and the key hints  */
        const rows: RenderElement[] = [
            Box({ flexDirection: "row", flexWrap: "wrap", columnGap: 1, width: span, children: [
                Text({ bold: true, children: current.command }),
                ...current.fields.map((field, i) => draw(field, i)),
                Text({ bold: true, inverse: focused === undefined, children: " ⏎ " })
            ] }),
            Text({ dimColor: true, children: "─".repeat(span) })
        ]
        if (editing && focused.choices.length > 0)
            rows.push(Box({ flexDirection: "column", alignSelf: "flex-start", borderStyle: "round",
                borderDimColor: true, paddingX: 1, children: focused.choices.map((choice, k) =>
                    Text({ inverse: k === current.choice, children: focused.list ?
                        `${current.picked.has(choice) ? "☑" : "☐"} ${choice}` : choice })) }))
        const help = focused === undefined ?
            `Take over the composed command into the prompt:\n\n\`${compose(current)}\`` :
            focused.help !== "" ? focused.help : `*${focused.label}*`
        rows.push(Markdown({ text: help.slice(0, LIMIT) }))
        rows.push(Text({ dimColor: true, wrap: "truncate-end", children:
            !editing ? "←/→ step · SPACE toggle · ⏎ edit/apply · ⌫ cancel" :
            focused.choices.length > 0 ? `←/→ choose${focused.list ? " · SPACE pick" : ""} · ⏎ accept · ⌫ abort` :
            "type the value · ←/→ move · ⏎ accept" }))
        return Box({ flexDirection: "column", width: "100%", children: rows })
    })
}

