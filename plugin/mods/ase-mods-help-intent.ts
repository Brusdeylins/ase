/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  Claude Code function hooks module ("mod", EARLY ACCESS):
    Intent help, matching the still unsubmitted prompt, once suffixed with
    a blank and "??", as an intent against the help of all ASE skills (like
    the skill "ase-help-intent", but over the session context), and showing
    the proposed skills in a master/detail view in the band above the
    prompt, where LEFT/RIGHT (or the wheel over the skills) selects a skill,
    UP/DOWN and "b"/"f"/SPACE (or the wheel over the details) scroll its
    details, RETURN picks its command into the prompt, and BACKSPACE or any
    other key restores the prompt as typed.  */

import type { Elements, Frozen, MatchedEvent, PromptBox, PromptEditInput, RenderElement } from "claude-code"
import { type Engine, type Char, PICKED, CODE, BAND, MASTER, FRAME, BORDER,
    held, section, wrap, uniform, flow, frame, scrollbar, position, paging, paint, edge, bar } from "./ase-mods-common.ts"

/*  the trigger of an intent inside the prompt (suffixed with a blank and "??",
    so the doubled question mark of a sentence is no trigger), the skill of
    a proposed command (with or without its "ase:" plugin prefix), the maximum
    number of command proposals, the help corpus of all skills (relative to
    the plugin directory), and the fallback model without any session to fork  */
const INTENT    = /\s+\?\?$/
const SKILL     = /^\/?(?:ase:)?(ase-[a-z0-9]+-[a-z0-9]+)(?![\w-])/
const PROPOSALS = 8
const CORPUS    = "skills/ase-help-intent/data.md"
const FALLBACK  = "sonnet"

/*  the color of the box around (and of the rationale inside) the command and
    rationale of a proposal, and the title placed into the top edge of the frame  */
const BOXED = "blue"
const TITLE = "[ ⧉ ASE: Find Skill Command ]"

/*  the frames of the spinner animating the status message while matching,
    and the milliseconds between two frames  */
const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
const SPIN    = 100

/*  the help of a single skill: its catalog entry and its entire manual page  */
type Help = { catalog: string, manual: string }

/*  a command proposal for an intent  */
type Proposal = { skill: string, command: string, rationale: string }

/*  an intent under matching: the original prompt (without and with the
    trigger), the matching state, the status message, the spinner frame, the command proposals,
    the selected proposal, the first shown proposal of the master view, the
    first shown line of the detail view, the lines of a page of the detail
    view, and the first band column right of the master view  */
type Intent = {
    draft:     string,
    typed:     string,
    state:     "busy" | "done" | "fail",
    message:   string,
    spin:      number,
    proposals: Proposal[],
    select:    number,
    top:       number,
    scroll:    number,
    page:      number,
    split:     number
}

/*  parse the help corpus into the help of each skill, where
    the catalog entry is the NAME, SYNOPSIS, DESCRIPTION, and SCENARIOS only  */
const helps = (text: string): Map<string, Help> => {
    const result = new Map<string, Help>()
    for (const m of text.matchAll(/<purpose name="([^"]+)">\n([\s\S]*?)<\/purpose>/g)) {
        const manual  = m[2]!.trim()
        const catalog = manual.split(/^(?=## {2})/m)
            .filter((part) => /^## {2}(?:NAME|SYNOPSIS|DESCRIPTION|SCENARIOS)\b/.test(part))
            .join("").trim()
        result.set(m[1]!, { catalog, manual })
    }
    return result
}

/*  extract the text out of a model reply (as the runtime result of a fork
    or completion may deviate from its declared type, like a string, a result
    object, an unanswered reply, or a refusal with a reason instead of null)  */
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

/*  extract the JSON array out of a model reply (trying each opening bracket,
    as any prose before the array may contain brackets, too)  */
const array = (text: string | undefined): unknown[] | undefined => {
    if (text === undefined)
        return undefined
    const j = text.lastIndexOf("]")
    for (let i = text.indexOf("["); i !== -1 && i < j; i = text.indexOf("[", i + 1)) {
        try {
            const value: unknown = JSON.parse(text.slice(i, j + 1))
            if (Array.isArray(value))
                return value
        }
        catch {
            /*  continue with the next opening bracket  */
        }
    }
    return undefined
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
fit primarily by its SCENARIOS and DESCRIPTION, and secondarily by its
NAME and SYNOPSIS -- ordered from best-fitting to worst-fitting, and
keep at most the ${PROPOSALS} best ones. Reply with
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

/*  determine the lines of the detail view of a proposal out of the manual page
    of its skill: the command and rationale of the proposal (inside a box), and
    the name, title, and description of its skill  */
const details = (proposal: Proposal, manual: string, columns: number): Char[][] => {
    const title = section(manual, "NAME").trim().replace(/^`[^`]*`\s+-\s+/, "")
    const boxed = wrap(uniform(`❯ ${proposal.command}`, true, CODE), columns - 4, 2)
    if (proposal.rationale !== "")
        boxed.push(...wrap(uniform(`▷ Rationale: ${proposal.rationale}`, false, BOXED), columns - 4, 2))
    const lines = frame(boxed, columns, BOXED)
    lines.push([], ...wrap(uniform(title !== "" ? `${proposal.skill}: ${title}` : proposal.skill,
        true, undefined), columns, 0))
    const description = section(manual, "DESCRIPTION")
    if (description.trim() !== "")
        lines.push([], ...flow(description, columns))
    return lines
}

/*  the intent help: its state and its operations  */
export const modHelpIntent = () => {
    /*  the help of all skills (loaded on first use) and the currently shown intent  */
    let corpus: Map<string, Help> | undefined
    let intent: Intent | undefined

    /*  determine whether the intent band is shown  */
    const active = () => intent !== undefined

    /*  close the intent band  */
    const reset = () => {
        intent = undefined
    }

    /*  close the intent band (as on a failure) and determine the prompt to
        restore (the prompt as typed), if the band was shown  */
    const cancel = (): string | undefined => {
        const typed = intent?.typed
        reset()
        return typed
    }

    /*  while the intent band is shown, every edit is a key of the band (with the
        prompt held): LEFT/RIGHT select a proposal, UP/DOWN scroll its details by
        a line and "b"/"f"/SPACE by a page (as the engine consumes PAGEUP/PAGEDOWN),
        RETURN (arriving as a typed newline in the held prompt) operates the band
        as at the prompt, a deletion (like BACKSPACE) closes the band and restores
        the prompt as typed without its last character, and any other key closes
        the band and restores the prompt as typed (onto whose end the edit of a
        typed text is still to be applied)  */
    const edit = (e: Frozen<PromptEditInput>): PromptBox | string => {
        const current = intent!
        const { draft, typed, state, proposals } = current
        if (e.inputText === "\n") {
            const text = submit()
            return intent !== undefined ? held(draft) : { text, cursor: text.length }
        }
        const name = e.key?.key ?? ""
        const roll = name === "up" ? -1 : name === "down" ? 1 :
            e.inputText === "b" ? -current.page : e.inputText === "f" || e.inputText === " " ? current.page : 0
        const step = roll !== 0 ? 0 : name === "left" ? -1 : name === "right" ? 1 :
            e.inputText === "" && e.end === e.start ? Math.sign(e.start - e.cursor) : 0
        if (state === "done" && (roll !== 0 || step !== 0)) {
            if (step !== 0) {
                current.select = Math.max(0, Math.min(proposals.length - 1, current.select + step))
                current.scroll = 0
            }
            else
                current.scroll = Math.max(0, current.scroll + roll)
            return held(draft)
        }
        reset()
        if (e.inputText === "" && e.end > e.start)
            return { text: typed.slice(0, -1), cursor: typed.length - 1 }
        if (e.inputText === "")
            return { text: typed, cursor: typed.length }
        return typed
    }

    /*  stash the prompt as the intent, hold the prompt (so the keys of the
        band arrive as edits), and match the intent in the background  */
    const open = (box: PromptBox, engine: Pick<Engine, "invalidate" | "read" | "fork" | "complete" | "sleep">): PromptBox | undefined => {
        const draft = box.text.replace(INTENT, "")
        if (!INTENT.test(box.text) || draft.trim() === "")
            return undefined
        const current: Intent = { draft, typed: box.text, state: "busy",
            message: "matching intent...", spin: 0, proposals: [],
            select: 0, top: 0, scroll: 0, page: 1, split: 0 }
        intent = current

        /*  update the intent, unless it was closed in the meantime  */
        const settle = (state: Intent["state"], message: string, proposals: Proposal[] = []) => {
            if (intent !== current)
                return
            Object.assign(current, { state, message, proposals })
            engine.invalidate()
        }

        /*  ask the model for a stage over the transcript of the session (sharing its
            prompt cache), or, as the fork yields no text on a cold snapshot or an API
            error, without any session context (telling so in the status message)  */
        const ask = async (prompt: string, stage: string): Promise<string | undefined> => {
            settle("busy", `${stage}...`)
            const forked = reply(await engine.fork(prompt))
            if (forked !== undefined)
                return forked
            if (intent !== current)
                return undefined
            settle("busy", `${stage} (without session context)...`)
            return reply(await engine.complete({ model: FALLBACK, prompt, maxTokens: 4096 }))
        }

        /*  match the intent in two stages: select the fitting skills out of
            the catalog, then generate the commands out of their manual pages  */
        const match = async () => {
            const skills  = corpus ??= helps(await engine.read(CORPUS))
            const catalog = [ ...skills ].map(([ name, help ]) =>
                `<skill name="${name}">\n${help.catalog}\n</skill>`).join("\n")
            const names = (array(await ask(selection(draft, catalog), "matching intent")) ?? [])
                .filter((name, i, all): name is string =>
                    typeof name === "string" && skills.has(name) && all.indexOf(name) === i)
                .slice(0, PROPOSALS)
            if (intent !== current)
                return
            if (names.length === 0) {
                settle("fail", "no confident match for the intent -- please refine or clarify it")
                return
            }
            const manuals = names.map((name) =>
                `<skill name="${name}">\n${skills.get(name)!.manual}\n</skill>`).join("\n")
            const proposals = (array(await ask(generation(draft, manuals), `generating commands for ${names.join(", ")}`)) ?? [])
                .flatMap((item): Proposal[] => {
                    const { command, rationale } = (item ?? {}) as { command?: unknown, rationale?: unknown }
                    const text  = typeof command === "string" ? command.trim() : ""
                    const skill = SKILL.exec(text)?.[1]
                    if (skill === undefined || !skills.has(skill))
                        return []
                    return [ {
                        skill,
                        command:   text.replace(SKILL, "/ase:$1").replace(/\s+/g, " "),
                        rationale: typeof rationale === "string" ? rationale.trim().replace(/\s+/g, " ") : ""
                    } ]
                })
                .slice(0, PROPOSALS)

            /*  without any generated command, still propose the bare commands of the selected skills  */
            if (proposals.length === 0)
                settle("done", "pick a command (without generated arguments)",
                    names.map((skill) => ({ skill, command: `/ase:${skill}`, rationale: "" })))
            else
                settle("done", "pick a command", proposals)
        }
        match().catch((err: unknown) => {
            settle("fail", `matching failed: ${err instanceof Error ? err.message : String(err)}`)
        })

        /*  animate the spinner while matching, unless the intent was closed in the meantime  */
        const animate = async () => {
            while (intent === current && current.state === "busy") {
                await engine.sleep(SPIN)
                current.spin = (current.spin + 1) % SPINNER.length
                engine.invalidate()
            }
        }
        animate().catch(() => {
            /*  ignore a stopped animation, as the status message stays readable  */
        })
        return held(draft)
    }

    /*  operate the intent band by the wheel: over the master view step the
        selection, over the detail view scroll it, resp. scroll it by a page
        with the scroll keys (PAGEUP/PAGEDOWN) while the band is focused
        (and tell whether the band took the scrolling)  */
    const scroll = (e: Frozen<MatchedEvent<"ui.scroll", { component: "AbovePrompt" }>>): boolean => {
        if (intent === undefined || intent.state !== "done")
            return false
        if (e.pointer !== undefined && e.pointer.column < intent.split) {
            const select = Math.max(0, Math.min(intent.proposals.length - 1, intent.select + Math.sign(e.by)))
            if (select !== intent.select) {
                intent.select = select
                intent.scroll = 0
            }
        }
        else
            intent.scroll = Math.max(0, intent.scroll + paging(e, intent.page))
        return true
    }

    /*  operate the intent band by RETURN at the prompt: pick the selected
        proposal (closing the band), if any, resp. close a failed band, and
        determine the prompt to refill (the held prompt while the band stays
        shown, but without its space after the cursor, as the refill places
        the cursor at its end)  */
    const submit = (): string => {
        const current  = intent!
        const proposal = current.state === "done" ? current.proposals[current.select] : undefined
        if (proposal !== undefined || current.state === "fail")
            reset()
        return proposal !== undefined ? `${proposal.command} ` :
            intent !== undefined ? held(current.draft).text.trimEnd() : `${current.draft} `
    }

    /*  draw the intent into the band above the prompt (terminal only): a master view
        of the proposed skills and a detail view of the selected one side by side  */
    const render = (e: Frozen<MatchedEvent<"ui.render", { component: "AbovePrompt", surface: "terminal" }>>,
        ui: Elements["terminal"]): RenderElement | undefined => {
        /*  yield to a survey and draw nothing without an intent  */
        if (intent === undefined || e.props.hasSurvey)
            return undefined
        const current = intent
        const { proposals } = current

        /*  resolve the UI elements and determine the inner columns and the rows
            of both views, out of a share of the terminal height (but never more
            than the rows of the band), with the self-drawn frame (both borders and
            the left padding only, so the scrollbar touches the frame) and the
            footer subtracted  */
        const { Box, Text } = ui
        const span   = Math.max(20, e.props.bodyColumns - FRAME.cols)
        const height = Math.min(e.props.maxRows,
            Math.max(FRAME.rows + 2, Math.floor((e.viewport?.rows ?? e.props.maxRows) * BAND)))
        const body   = Math.max(1, height - FRAME.rows - 1)
        const clip   = (text: string, n: number) =>
            text.length > n ? `${text.slice(0, n - 1)}…` : text

        /*  determine the widths of the master view and the detail view in a fixed
            ratio (with a separator column between them, and a gap of two columns
            and a scrollbar column right of the detail view)  */
        const master = Math.floor((span - 3 - 3) * MASTER)
        const detail = span - master - 3 - 3

        /*  determine the lines of the detail view: the command and rationale of the
            selected proposal (inside a box), and the name, title, and description
            of its skill  */
        const proposal = current.state === "done" ? proposals[current.select] : undefined
        const lines    = proposal !== undefined ?
            details(proposal, corpus?.get(proposal.skill)?.manual ?? "", detail) : []

        /*  clamp the scroll positions of both views (keeping the selected proposal
            in the master view), and remember the page size for the scroll keys
            and the end of the master view (after the left frame) for the wheel  */
        current.page   = Math.max(1, body - 1)
        current.split  = FRAME.lead + master
        current.scroll = Math.max(0, Math.min(current.scroll, lines.length - body))
        current.top    = Math.max(0, current.select - body + 1, Math.min(current.top, current.select))

        /*  determine the scrollbar of the detail view  */
        const marks = scrollbar(body, lines.length, current.scroll)

        /*  determine the rows of the status message (as long as no proposals exist):
            a box of half the columns, centered vertically and horizontally  */
        const hint: string[] = []
        if (proposal === undefined) {
            const size  = Math.max(12, Math.floor(span / 2))
            const text  = current.state === "busy" ? `${SPINNER[current.spin]} ${current.message}` : current.message
            const boxed = frame(wrap(uniform(text, false, undefined), size - 4, 0)
                .slice(0, Math.max(1, body - 2)), size, undefined)
            const pad   = " ".repeat(Math.max(0, Math.floor((span - size) / 2)))
            hint.push(...Array.from({ length: Math.max(0, Math.floor((body - boxed.length) / 2)) }, () => " "),
                ...boxed.map((line) => pad + line.map((char) => char.ch).join("")))
        }

        /*  determine a horizontal edge of the self-drawn frame, with the joint of
            the separator between both views (once the proposals exist)  */
        const border = (left: string, joint: string, right: string) =>
            left + (proposal === undefined ? "─".repeat(span + 1) :
                "─".repeat(master + 2) + joint + "─".repeat(detail + 4)) + right

        /*  draw inside the frame the status message resp. the rows of both views
            (the master view with the selected proposal in red, the separator
            joining the frame, and the detail view with its scrollbar), into the
            bottom edge the scroll position of the detail view, and below the frame
            the key hints (the intent itself stays visible in the prompt)  */
        const rows: RenderElement[] = [ edge(Text, border("╭", "┬", "╮"), TITLE) ]
        for (let i = 0; i < body; i++) {
            const k = current.top + i
            const p = proposal !== undefined ? proposals[k] : undefined
            rows.push(Box({ flexDirection: "row", children: [
                Text({ ...BORDER, children: "│ " }),
                ...(proposal === undefined ? [
                    Box({ width: span, flexShrink: 0, children:
                        Text({ dimColor: true, wrap: "truncate-end", children: hint[i] ?? " " }) })
                ] : [
                    Box({ width: master, flexShrink: 0, children: p !== undefined ?
                        Text({ color: k === current.select ? PICKED : undefined, children: clip(p.skill, master) }) :
                        Text({ children: " " }) }),
                    Text({ ...BORDER, children: " │ " }),
                    Box({ width: detail, flexShrink: 0, children:
                        Text({ wrap: "truncate-end", children: paint(Text, lines[current.scroll + i] ?? []) }) }),
                    Text({ children: "  " }),
                    bar(Text, marks[i])
                ]),
                Text({ ...BORDER, children: "│" })
            ] }))
        }
        rows.push(edge(Text, border("╰", "┴", "╯"), position(body, lines.length, current.scroll), true))
        return Box({ flexDirection: "column", width: "100%", children: [
            ...rows,
            Box({ paddingLeft: 1, children: Text({ dimColor: true, wrap: "truncate-end", children:
                current.state === "done" ? "⌫: cancel · ⏎: pick · ←/→: select · b/f/SPACE: scroll" :
                    "⌫/any key: cancel" }) })
        ] })
    }

    return { active, reset, cancel, edit, open, scroll, submit, render }
}

