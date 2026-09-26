/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                                     from "node:fs"
import os                                     from "node:os"
import path                                   from "node:path"

import React                                  from "react"
import { execa }                              from "execa"
import { render, Box, Text, useApp, useInput, useWindowSize, measureElement } from "ink"
import type { BoxProps, DOMElement }          from "ink"

import type Log                               from "./ase-lib-log.js"
import { Task }                               from "./ase-task.js"
import {
    buildBoard, splitHeight, toneOf, watchTasks, BoardState, byCreation, cardLabel, clampLines, glueId, glueTitle,
    attachmentTabs, isPreflightDiff, diffTones
}                                             from "./ase-task-board-core.js"
import type { Board, Card, GroupSpec, LaneSpec, Surface, SurfaceList } from "./ase-task-board-core.js"
import * as TaskFormat                        from "./ase-task-format.js"
import { filterBoard }                        from "./ase-task-board-filter.js"
import { layoutGraph, drawGraphText }         from "./ase-task-board-graph.js"
import type { GraphLayout }                   from "./ase-task-board-graph.js"
import { Config, configSchema, tuiColorDefaults } from "./ase-config.js"

/*  shorthand for creating React elements without JSX  */
const h = React.createElement

/*  the color palette of the terminal board, with the four roles dim,
    normal, accent, and signal (undefined is the terminal foreground color),
    configurable through the "board.tui.color.<role>" configuration keys  */
type Palette = { dim?: string, normal?: string, accent?: string, signal?: string }
let palette: Palette = {}
const loadPalette = (log: Log): Palette => {
    const cfg = new Config("config", configSchema, log)
    cfg.read()
    const color = (role: keyof Palette): string | undefined => {
        const value = cfg.get(`board.tui.color.${role}`)
        const name  = typeof value === "string" ? value : tuiColorDefaults[role]
        return name === "default" ? undefined : name
    }
    return { dim: color("dim"), normal: color("normal"), accent: color("accent"), signal: color("signal") }
}

/*  layout constants: minimum group width, collapsed group width, gap  */
const GROUP_MIN  = 26
const GROUP_COLL = 5
const GROUP_GAP  = 1

/*  the dashed border of the "CANCELLED" lane  */
const dashed: BoxProps["borderStyle"] = {
    topLeft: "╭", top: "╌", topRight: "╮", right: "╎",
    bottomRight: "╯", bottom: "╌", bottomLeft: "╰", left: "╎"
}

/*  the heavy variant of the dashed border, for marking a move target  */
const dashedBold: BoxProps["borderStyle"] = {
    topLeft: "┏", top: "╍", topRight: "┓", right: "╏",
    bottomRight: "┛", bottom: "╍", bottomLeft: "┗", left: "╏"
}

/*  the selection: group, lane, and card id ("" for a lane without card focus)  */
type Sel = { g: number, l: number, id: string }

/*  the navigable items of a group: one per card, or one per lane
    which is minimized, empty, or within a collapsed group  */
const groupItems = (board: Board, g: number, surface: Surface): Sel[] => {
    const out  = [] as Sel[]
    const coll = surface.collapsed.includes(board.groups[g].title)
    board.groups[g].lanes.forEach((lane, l) => {
        const cards = board.lanes.get(lane.status) ?? []
        if (coll || surface.minimized.includes(lane.status) || cards.length === 0)
            out.push({ g, l, id: "" })
        else
            cards.forEach((c) => out.push({ g, l, id: c.id }))
    })
    return out
}

/*  re-locate a selection on a (possibly changed) board: a selected card
    is followed into its current lane, otherwise the lane is kept  */
const relocate = (board: Board, sel: Sel, surface: Surface): Sel => {
    if (sel.id !== "") {
        const card = board.cards.get(sel.id)
        if (card !== undefined)
            for (let g = 0; g < board.groups.length; g++) {
                const l = board.groups[g].lanes.findIndex((lane) => lane.status === card.status)
                if (l >= 0)
                    return surface.minimized.includes(card.status) || surface.collapsed.includes(board.groups[g].title) ?
                        { g, l, id: "" } : { g, l, id: card.id }
            }
    }
    const g     = Math.min(sel.g, board.groups.length - 1)
    const items = groupItems(board, g, surface)
    return items.find((it) => it.l === sel.l) ?? items[0]
}

/*  compute the visible group range starting at a first group, with the
    width of each visible group (collapsed groups stay narrow, expanded
    groups share the remaining width but never drop below the minimum)  */
const fitGroups = (groups: GroupSpec[], collapsed: string[], first: number, width: number) => {
    const widths = [] as number[]
    let   used   = 0
    for (let g = first; g < groups.length; g++) {
        const w   = collapsed.includes(groups[g].title) ? GROUP_COLL : GROUP_MIN
        const gap = widths.length > 0 ? GROUP_GAP : 0
        if (widths.length > 0 && used + gap + w > width)
            break
        widths.push(w)
        used += gap + w
    }
    const expanded = widths.map((w, i) => w === GROUP_COLL && collapsed.includes(groups[first + i].title) ? -1 : i)
        .filter((i) => i >= 0)
    if (expanded.length > 0) {
        const extra = Math.max(0, width - used)
        const each  = Math.floor(extra / expanded.length)
        expanded.forEach((i) => { widths[i] += each })
        widths[expanded[0]] += extra - each * expanded.length
    }
    return { first, last: first + widths.length - 1, widths }
}

/*  a text line with a per-character mask of its inline style
    (bit 0: bold, bit 1: italic, bit 2: code, bit 3: accent, bit 4: signal)  */
type Line = { text: string, mask: number[] }
const BOLD   = 1
const ITALIC = 2
const CODE   = 4
const ACCENT = 8
const SIGNAL = 16

/*  strip the Markdown inline markers of a line ("`" for code, "**" and
    "__" for bold, "*" for italic), recording the style of the marked text  */
const emphasis = (line: string): Line => {
    const out  = { text: "", mask: [] as number[] }
    const add  = (text: string, style: number) => {
        out.text += text
        out.mask.push(...new Array<number>(text.length).fill(style))
    }
    let last = 0
    for (const m of line.matchAll(/`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:[^*]*?[^*\s])?)\*/g)) {
        add(line.slice(last, m.index), 0)
        add(m[1] ?? m[2] ?? m[3] ?? m[4], m[1] !== undefined ? CODE : m[4] !== undefined ? ITALIC : BOLD)
        last = m.index + m[0].length
    }
    add(line.slice(last), 0)
    return out
}

/*  wrap a text line to a width, keeping its leading indentation  */
const wrap = (line: Line, width: number): Line[] => {
    if (line.text.length <= width)
        return [ line ]
    const indent = /^\s*(?:[-*]\s+(?:\[.\]\s+)?)?/.exec(line.text)![0].length
    const pad    = " ".repeat(Math.min(indent, Math.floor(width / 2)))
    const out    = [] as Line[]
    let   rest   = line
    while (rest.text.length > width) {
        let cut = rest.text.lastIndexOf(" ", width)
        if (cut <= pad.length)
            cut = width
        out.push({ text: rest.text.slice(0, cut), mask: rest.mask.slice(0, cut) })
        const tail = rest.text.slice(cut)
        const skip = tail.length - tail.trimStart().length
        rest = {
            text: pad + tail.slice(skip),
            mask: [ ...new Array<number>(pad.length).fill(0), ...rest.mask.slice(cut + skip) ]
        }
    }
    out.push(rest)
    return out
}

/*  make a text safe for the terminal: expand tabs and strip control characters  */
const sanitize = (text: string): string =>
    text.replace(/\t/g, "    ").replace(/\p{Cc}/gu, "")

/*  mark the checkbox of a plan line in the read dialog: checkboxes of items
    which are done, in progress, or open are accented, while checkboxes of
    items which are questioned, delegated, or dropped are signaled  */
const checkbox = (line: Line): Line => {
    const m = /^(\s*[-*]\s+)\[([x /?>-])\]/.exec(line.text)
    if (m !== null) {
        const style = /[x/ ]/.test(m[2]) ? ACCENT : SIGNAL
        for (let k = m[1].length; k < m[1].length + 3; k++)
            line.mask[k] |= style
    }
    return line
}

/*  the attachments of a task plan and the parts of a task plan, as fetched
    exclusively through the task interface (null if no longer existing, an
    error if loading failed, undefined while still loading)  */
type Attachment = Awaited<ReturnType<typeof Task.attachments>>[number]
type PlanParts  = { keys: Map<string, string>, body: string, atts: Attachment[] } | null | Error | undefined

/*  a line of the read dialog  */
type DialogLine = { text: string, color?: string, bold?: boolean, mask?: number[] }

/*  the key/value header lines of the read dialog, separated from the
    content by a line, so that the content starts after a blank line  */
const headerLines = (keys: [ string, string ][], width: number): DialogLine[] => {
    const out = keys.map(([ key, val ]): DialogLine => ({ text: `${(key + ":").padEnd(10)}${sanitize(val)}`, color: palette.dim }))
    if (out.length > 0)
        out.push({ text: "─".repeat(width), color: palette.dim }, { text: "" })
    return out
}

/*  the lines of a Markdown text (without its leading blank lines) for the read dialog  */
const markdownLines = (text: string, width: number): DialogLine[] => {
    const out = [] as DialogLine[]
    for (const line of text.replace(/^(?:[ \t]*\r?\n)+/, "").split(/\r?\n/).map(sanitize)) {
        const bold  = /^#/.test(line)
        const color = /^#{1,4}(?!#)/.test(line) ? palette.accent : palette.normal
        for (const part of wrap(checkbox(emphasis(line.replace(/^#+\s*/, ""))), width))
            out.push({ text: part.text, color, bold, mask: part.mask })
    }
    return out
}

/*  the lines of a task plan for the read dialog  */
const planLines = (parts: PlanParts, id: string, width: number): DialogLine[] => {
    if (parts === undefined)
        return [ { text: "loading...", color: palette.dim } ]
    if (parts === null)
        return [ { text: `task "${id}" no longer exists`, color: palette.signal } ]
    if (parts instanceof Error)
        return [ { text: `loading task "${id}" failed: ${parts.message}`, color: palette.signal } ]
    return [
        ...headerLines([ ...parts.keys ].filter(([ key ]) => key !== "Type"), width),
        ...markdownLines(parts.body, width)
    ]
}

/*  the lines of a task plan attachment for the read dialog: its embedded
    data or its (lazily loaded) file content, rendered as Markdown for a
    Markdown type, as a placeholder if binary, and else verbatim  */
const attachmentLines = (att: Attachment, content: Buffer | Error | undefined, width: number): DialogLine[] => {
    const out = headerLines(([
        [ "Type", att.type ], [ "Desc", att.desc ], [ "Created", att.created ?? "" ], [ "Modified", att.modified ?? "" ]
    ] as [ string, string ][]).filter(([ , val ]) => val !== ""), width)
    let text = att.data
    if (text === undefined) {
        if (content === undefined)
            return [ ...out, { text: "loading...", color: palette.dim } ]
        if (content instanceof Error)
            return [ ...out, { text: `loading attachment failed: ${content.message}`, color: palette.signal } ]
        try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(content)
        }
        catch (_err: unknown) {
            text = "\0"
        }
        if (text.includes("\0"))
            return [ ...out, { text: `(binary content: ${sanitize(att.type)}, ${content.length} bytes)`, color: palette.dim } ]
    }
    if (/^text\/markdown\b/i.test(att.type.trim()))
        return [ ...out, ...markdownLines(text, width) ]

    /*  a preflight diff is colored per line: its file headers up to and
        including the hunk headers dimmed, inserted lines accented, removed
        lines signaled, and context lines in the default color  */
    const lines = text.replace(/^(?:[ \t]*\r?\n)+/, "").split(/\r?\n/).map(sanitize)
    const tones = isPreflightDiff(att.type) ? diffTones(lines) : null
    const tint  = { head: palette.dim, add: palette.accent, del: palette.signal, ctx: palette.normal }
    lines.forEach((line, i) => {
        const color = tones !== null ? tint[tones[i]] : palette.accent
        for (const part of wrap({ text: line, mask: new Array<number>(line.length).fill(0) }, width))
            out.push({ text: part.text, color, mask: part.mask })
    })
    return out
}

/*  the tab labels of the read dialog: the task content, followed by its attachments  */
const dialogTabs = (parts: PlanParts): string[] =>
    attachmentTabs(parts !== undefined && parts !== null && !(parts instanceof Error) ? parts.atts : [])

/*  the first visible tab of the tab bar, starting at a previous first
    tab, but moved so that the selected tab fits into the width  */
const tabFirst = (tabs: string[], first: number, tab: number, width: number): number => {
    let f = Math.min(first, tab)
    const span = (from: number) => tabs.slice(from, tab + 1).reduce((n, label) => n + label.length + 3, -1)
    while (f < tab && span(f) > width)
        f++
    return f
}

/*  the layout of the tab bar within its inner width: the visible tabs
    after the first column and separated by a space (with their column
    offsets), a left scroll arrow in the first column while scrolled, a right
    scroll arrow in the last column where further tabs exist, and a too
    wide single tab cut  */
const tabLayout = (tabs: string[], first: number, tab: number, innerW: number) => {
    const f     = tabFirst(tabs, first, tab, innerW - 2)
    const lead  = 1
    const width = innerW - 2
    const items = [] as { index: number, x: number, text: string }[]
    let   used  = 0
    let   last  = f
    for (; last < tabs.length; last++) {
        const gap  = last > f ? 1 : 0
        let   text = ` ${tabs[last]} `
        if (used + gap + text.length > width) {
            if (last > f)
                break
            text = text.slice(0, Math.max(0, width - 1)) + "…"
        }
        items.push({ index: last, x: lead + used + gap, text })
        used += gap + text.length
    }
    return { lead, width, used, items, less: f > 0, more: last < tabs.length }
}

/*  the number of non-content rows of the read dialog (borders, two
    header lines, the tab bar, four separators, and the footer)  */
const DIALOG_CHROME = 10

/*  the column offset of the " X " close button of the read dialog from its right edge  */
const DIALOG_CLOSE  = 5

/*  the parameters of the read dialog  */
type DialogArgs = {
    card: Card | undefined, group: string | undefined, id: string, pred: string[], succ: string[],
    tint: (id: string) => string | undefined, tabs: string[], tab: number, first: number, scroll: number,
    lines: DialogLine[], columns: number, rows: number, notice: string | null
}

/*  render the read dialog: full height, horizontally centered, with a
    vertical scroll bar in its right border  */
const renderDialog = ({ card, group, id, pred, succ, tint, tabs, tab, first, scroll, lines, columns, rows, notice }: DialogArgs) => {
    const width  = Math.min(columns - 2, 100)
    const left   = Math.floor((columns - width) / 2)
    const bodyW  = width - 5
    const viewH  = rows - DIALOG_CHROME
    const maxS   = Math.max(0, lines.length - viewH)
    const s      = Math.min(scroll, maxS)
    const thumbH = Math.max(1, Math.round(viewH * Math.min(1, viewH / Math.max(1, lines.length))))
    const thumbY = maxS === 0 ? 0 : Math.round((viewH - thumbH) * s / maxS)
    const frame  = { position: "absolute", top: 0, left, width, height: rows, borderStyle: "round", borderColor: palette.dim } as const

    /*  without a background fill, every inner cell has to be written
        explicitly (with spaces) to hide the dimmed board underneath  */
    const innerW = width - 2

    /*  the header width, without its outer spaces and the " X " close button  */
    const titleW = Math.max(0, innerW - 2 - 4)

    /*  the header: task id and title on the left (with the title cut as
        needed), lane group and status on the right (dropped if even the id
        would not fit otherwise)  */
    const title  = card !== undefined ? cardLabel(card).replace(/^(\S+) ▶ /, "$1 ") : id
    let   right  = card !== undefined ? `${group !== undefined ? `${group} ▷ ` : ""}${card.status}` : ""
    if (id.length + 3 + right.length > titleW)
        right = ""
    else if (right !== "")
        right = " " + right
    const lane   = right !== "" && card !== undefined ? card.status : ""

    /*  the id is rendered inverse with one extra space on each side  */
    const leftW  = Math.max(0, titleW - right.length - 2)
    const head   = title.length > leftW ? title.slice(0, Math.max(0, leftW - 1)) + "…" : title.padEnd(leftW)
    const pos    = `lines ${s + 1}–${Math.min(lines.length, s + viewH)} of ${lines.length} `

    /*  the dependencies: predecessors on the left, successors on the right
        (padded in between to the full width, or cut at the end if too long),
        with each id rendered inverse with one extra space on each side  */
    const refs   = (ids: string[]) => ids.length === 0 ?
        [ { text: "—", color: palette.dim, inverse: false } ] :
        ids.flatMap((ref, i) => [
            ...(i > 0 ? [ { text: " ", color: palette.dim, inverse: false } ] : []),
            { text: ` ${ref} `, color: tint(ref), inverse: true }
        ])
    const fill   = { text: "", color: palette.dim, inverse: false }
    const segs   = [
        { text: " predecessors: ", color: palette.dim, inverse: false },
        ...refs(pred),
        fill,
        { text: "successors: ", color: palette.dim, inverse: false },
        ...refs(succ),
        { text: " ", color: palette.dim, inverse: false }
    ]
    const used   = segs.reduce((n, seg) => n + seg.text.length, 0)
    fill.text    = " ".repeat(Math.max(1, innerW - used))
    let   room   = innerW
    for (const seg of segs) {
        if (seg.text.length > room)
            seg.text = room > 0 ? seg.text.slice(0, room - 1) + "…" : ""
        room -= seg.text.length
    }
    if (room > 0)
        segs[segs.length - 1].text += " ".repeat(room)

    /*  the tab bar: all tabs inverse, the selected one in signal color, the others in accent color  */
    const lay    = tabLayout(tabs, first, tab, innerW)
    const tabBar = [
        { text: lay.less ? "◁" : " ", color: palette.dim, bold: false, inverse: false },
        ...lay.items.flatMap((item, k) => [
            ...(k > 0 ? [ { text: " ", color: undefined, bold: false, inverse: false } ] : []),
            { text: item.text, color: item.index === tab ? palette.signal : palette.accent, bold: item.index === tab, inverse: true }
        ]),
        { text: " ".repeat(Math.max(0, lay.width - lay.used)) + (lay.more ? "▷" : " "), color: palette.dim, bold: false, inverse: false }
    ]

    /*  the horizontal separator, extended over the side borders to join them with T-glyphs  */
    const separator = (key: string) => h(Box, { key, marginLeft: -1, width, flexShrink: 0 },
        h(Text, { color: palette.dim }, "├" + "─".repeat(innerW) + "┤"))

    /*  the key hints, or instead the status notice of an edit, truncated to the free width  */
    const free   = Math.max(0, innerW - pos.length - 1)
    const keys   = notice !== null ?
        (" " + sanitize(notice)).slice(0, free) :
        " ←/→: tab · ↑/↓/⇈/⇊: scroll · e: edit · M: toggle mouse · ⏎/ESC: close"

    return h(Box, { key: "dialog", ...frame, flexDirection: "column" },
        h(Text, {},
            " ",
            h(Text, { color: tint(id), bold: true, inverse: true }, ` ${head.slice(0, id.length)} `),
            h(Text, { color: tint(id) }, head.slice(id.length)),
            h(Text, { color: palette.dim }, right.slice(0, right.length - lane.length)),
            h(Text, { color: palette.dim, bold: true }, lane),
            " ",
            h(Text, { color: palette.dim, inverse: true }, " X "),
            " "),
        separator("sep-title"),
        h(Text, {}, ...segs.map((seg, k) => h(Text, { key: k, color: seg.color, inverse: seg.inverse }, seg.text))),
        separator("sep-head"),
        h(Text, { wrap: "truncate" }, ...tabBar.map((seg, k) =>
            h(Text, { key: k, color: seg.color, bold: seg.bold, inverse: seg.inverse }, seg.text))),
        separator("sep-tabs"),
        ...Array.from({ length: viewH }, (_, i) => {
            const line = lines[s + i]
            const bar  = lines.length <= viewH ? " " : (i >= thumbY && i < thumbY + thumbH ? "█" : "░")

            /*  split the padded line into runs of equal inline style  */
            const text = " " + (line?.text ?? "").padEnd(bodyW)
            const mask = [ 0, ...(line?.mask ?? []) ]
            const runs = [] as { text: string, style: number }[]
            for (let k = 0; k < text.length; k++) {
                const style = mask[k] ?? 0
                if (runs.length > 0 && runs[runs.length - 1].style === style)
                    runs[runs.length - 1].text += text[k]
                else
                    runs.push({ text: text[k], style })
            }
            return h(Box, { key: i },
                ...runs.map((run, k) => h(Text, {
                    key: k, wrap: "truncate",
                    color: (run.style & (CODE | ACCENT)) !== 0 ? palette.accent : (run.style & SIGNAL) !== 0 ? palette.signal : line?.color,
                    bold: (line?.bold ?? false) || (run.style & BOLD) !== 0, italic: (run.style & ITALIC) !== 0
                }, run.text)),
                h(Text, { color: palette.signal }, ` ${bar}`))
        }),
        separator("sep-foot"),
        h(Box, {},
            h(Text, { color: notice !== null ? palette.signal : palette.dim, wrap: "truncate" }, keys),
            h(Text, { color: palette.dim, wrap: "truncate" }, pos.padStart(Math.max(0, innerW - keys.length)))))
}

/*  the rendering context of the lane view, with the currently carried
    task (if any) and the lane states it can be moved to, the groups
    whose lanes show a scroll arrow on their left or right border (or -1),
    and the registration of the rendered card boxes for the mouse hit-testing  */
type ViewCtx = {
    board: Board, surface: Surface, sel: Sel, dim: boolean, carry: Carry | null, titles: boolean, scroll: Scroll,
    cardRef: (id: string) => (el: DOMElement | null) => void
    laneRef: (g: number, l: number) => (el: DOMElement | null) => void
}
type Carry   = { id: string, from: string, targets: Set<string> }
type Scroll  = { left: number, right: number }

/*  the scroll arrows of a lane box, attached outside to the vertical middle
    of its side borders (in the side padding of the board), placed either
    within the bordered box itself (whose offsets start inside the border)
    or within an unbordered wrapper around it  */
const scrollArrows = ({ scroll, dim }: ViewCtx, g: number, height: number, wrapper = false) => {
    const off = wrapper ? -1 : -2
    const top = Math.max(0, Math.floor((height - 2) / 2)) + (wrapper ? 1 : 0)
    return [
        ...(scroll.left  === g ? [ h(Box, { key: "scroll-left",  position: "absolute", left:  off, top },
            h(Text, { color: palette.dim, bold: true, dimColor: dim }, "◁")) ] : []),
        ...(scroll.right === g ? [ h(Box, { key: "scroll-right", position: "absolute", right: off, top },
            h(Text, { color: palette.dim, bold: true, dimColor: dim }, "▷")) ] : [])
    ]
}

/*  render one lane of the lane view  */
const renderLane = (ctx: ViewCtx, lane: LaneSpec, g: number, l: number, width: number, height: number) => {
    const { board, surface, sel, dim, carry, titles } = ctx
    const cards   = board.lanes.get(lane.status) ?? []
    const color   = lane.active ? palette.accent : lane.kind === "terminal" ? palette.dim : palette.normal
    const target  = carry?.targets.has(lane.status) ?? false
    const min     = surface.minimized.includes(lane.status)

    /*  a signal-colored border marks the selected lane, and a heavy border marks
        the selected lane or, while moving a task, the target lanes instead  */
    const picked  = sel.g === g && sel.l === l
    const heavy   = carry !== null ? target : picked
    const style: BoxProps["borderStyle"] = lane.dashed ? (heavy ? dashedBold : dashed) : (heavy ? "bold" : "round")
    const frame   = { key: lane.status, borderStyle: style, borderColor: picked ? palette.signal : color, borderDimColor: dim }
    const head    = h(Box, { key: "head", justifyContent: "space-between", paddingX: 1 },
        h(Text, { color, bold: true, dimColor: dim, wrap: "truncate" },
            `${min ? "▶" : "▼"} ${lane.status}`),
        h(Text, { color, dimColor: dim }, String(cards.length)))
    if (min)
        return h(Box, { ...frame, ref: ctx.laneRef(g, l), width, height: 3, flexDirection: "column" }, head, ...scrollArrows(ctx, g, 3))

    /*  the label lines of a card: the task id (with its markers) and title,
        cut onto a single line, or if titles are shown, wrapped onto at most
        three lines (with an ellipsis if cut), padded by one column on each side,
        with a placeholder column glued in front of the task id to reserve
        the extra column of its inverse rendering, and the arrow in front of
        the title replaced by a placeholder column glued to the title  */
    const textW = Math.max(3, width - 4)
    const label = (c: Card): string[] => {
        const marks = board.cyclic.has(c.id) ? " ⟲" : ""
        const text  = glueId + c.id + marks + cardLabel(c).slice(c.id.length).replace(/^ ▶ /, ` ${glueTitle}`)
        return clampLines(text, textW - 2, titles ? 3 : 1).map((line) => ` ${line}`)
    }

    /*  while moving a task onto a reachable target lane, the carried task is
        shown on top of the selected target lane, while a dim ghost of it
        stays at its original position until the drop happens  */
    const moved   = carry !== null && carry.targets.has(board.groups[sel.g]?.lanes[sel.l]?.status ?? "")
    const carried = moved && picked ? board.cards.get(carry.id) : undefined
    const list    = carried !== undefined ? [ carried, ...cards ] : cards

    /*  determine the visible cards by their actual heights, keeping the
        selected card (or the carried task instead) visible and, if not all
        cards fit, reserving one line for the indicator of the hidden cards  */
    const labels  = list.map((c) => label(c))
    const heights = labels.map((lines) => lines.length + 2)
    const sum     = (a: number, b: number) => heights.slice(a, b).reduce((n, x) => n + x, 0)
    const room    = height - 3
    const idx     = carried !== undefined ? 0 : list.findIndex((c) => c.id === sel.id)
    let   start   = 0
    let   end     = list.length
    if (sum(0, list.length) > room) {
        end = 0
        while (end < list.length && sum(0, end + 1) <= room - 1)
            end++
        if (idx >= end) {
            start = idx
            end   = idx + 1
            while (start > 0 && sum(start - 1, end) <= room - 1)
                start--
        }
    }
    const shown = list.slice(start, end)
    const rest  = list.length - end
    const items = shown.map((c, i) => {
        const moving  = carried !== undefined && start + i === 0
        const phantom = moved && !moving && c.id === carry?.id
        const held    = carry?.id === c.id && !phantom
        const on      = (c.id === sel.id || moving) && !dim && !phantom
        const tone    = toneOf(board, c)
        const tint    = phantom ? palette.dim : on ? palette.signal : tone === "active" ? palette.accent : tone === "done" ? palette.dim : palette.normal
        const lines   = labels[start + i]

        /*  the task id at the start of the first line (behind the margin and
            the placeholder) is always bold and inverse, with one column of
            spacing on each side, directly followed by the rest of the label  */
        const to      = 2 + c.id.length
        const box     = {
            key: moving ? "moving" : c.id, ...(moving ? {} : { ref: ctx.cardRef(c.id) }),
            borderStyle: phantom ? dashed : held ? "double" : "single", borderColor: tint, borderDimColor: dim,
            height: lines.length + 2, flexDirection: "column"
        } as const
        return h(Box, box,
            ...lines.map((line, k) => h(Text, { key: k, color: tint, dimColor: dim, wrap: "truncate" },
                ...(k === 0 ? [ line.slice(0, 1), h(Text, { key: "id", bold: true, inverse: true }, ` ${line.slice(2, to)} `),
                    line.slice(to + 1).replace(new RegExp(`^${glueTitle}`), " ").replace(glueTitle, "") ] : [ line.replace(glueTitle, "") ]))),

            /*  a carried task shows the move icon in the top left of its border  */
            ...(held ? [ h(Box, { key: "held", position: "absolute", top: -1, left: 0 },
                h(Text, { color: tint, bold: true, dimColor: dim }, "⇅")) ] : []))
    })

    /*  the centered indicator of the hidden cards, pushed to the bottom of the lane by a growing spacer  */
    if (start > 0 || rest > 0)
        items.push(h(Box, { key: "spacer", flexGrow: 1 }),
            h(Box, { key: "more", justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim },
                    [ ...(start > 0 ? [ `△ ${start}` ] : []), ...(rest > 0 ? [ `▽ ${rest}` ] : []) ].join(" "))))
    return h(Box, { ...frame, ref: ctx.laneRef(g, l), width, height, flexDirection: "column" }, head, ...items, ...scrollArrows(ctx, g, height))
}

/*  render one group column of the lane view  */
const renderGroup = (ctx: ViewCtx, group: GroupSpec, g: number, width: number, height: number, last: boolean) => {
    const { board, surface, sel, dim } = ctx
    const gap = last ? 0 : GROUP_GAP
    if (surface.collapsed.includes(group.title)) {
        /*  render each lane of the collapsed group as a narrow column with
            its vertically written status and number of cards  */
        const heights = splitHeight(height - 1, group.lanes.map((l) => l.weight), 3)
        const label   = "▶"
        const rest    = Math.max(0, width - label.length)
        const left    = Math.floor(rest / 2)
        return h(Box, { key: group.title, flexDirection: "column", width, marginRight: gap },
            h(Text, { color: sel.g === g ? palette.signal : palette.normal, dimColor: dim, bold: sel.g === g, inverse: true, wrap: "truncate" },
                " ".repeat(left) + label + " ".repeat(rest - left)),
            ...group.lanes.map((lane, l) => {
                const count = board.lanes.get(lane.status)?.length ?? 0
                const picked = sel.g === g && sel.l === l
                const color  = lane.active ? palette.accent : lane.kind === "terminal" ? palette.dim : palette.normal
                const title  = [ ...lane.status.toUpperCase() ]

                /*  the selection marks only the border (signal-colored and bold), not the text  */
                const frame  = {
                    borderStyle: lane.dashed ? (picked ? dashedBold : dashed) : (picked ? "bold" : "round"),
                    borderColor: picked ? palette.signal : color, borderDimColor: dim,
                    height: heights[l], flexDirection: "column", alignItems: "center", overflow: "hidden"
                } as const

                /*  the characters must not shrink, so a too long label is cut  */
                const char   = (key: string, ch: string, bold: boolean) =>
                    h(Box, { key, flexShrink: 0 }, h(Text, { color, bold, dimColor: dim }, ch))

                /*  the unbordered wrapper allows the scroll arrows to escape the clipping,
                    the growing title pushes the count to the bottom and is cut first  */
                return h(Box, { key: lane.status, ref: ctx.laneRef(g, l), height: heights[l], flexDirection: "column" },
                    h(Box, frame,
                        char("arrow", "▶", false),
                        h(Box, { flexDirection: "column", alignItems: "center", flexGrow: 1, flexShrink: 1, overflow: "hidden" },
                            ...title.map((ch, i) => char(`t${i}`, ch, true))),
                        h(Box, { flexDirection: "column", alignItems: "center", flexShrink: 0 },
                            ...[ ...String(count) ].map((ch, i) => char(`c${i}`, ch, false)))),
                    ...scrollArrows(ctx, g, heights[l], true))
            }))
    }
    const min     = group.lanes.map((l) => surface.minimized.includes(l.status))
    const free    = height - 1 - min.filter((m) => m).length * 3
    const heights = splitHeight(free, group.lanes.map((l, i) => min[i] ? 0 : l.weight), 3)
    const label   = ` ▼ ${group.title} `
    const rest    = Math.max(0, width - label.length)
    const left    = Math.floor(rest / 2)
    return h(Box, { key: group.title, flexDirection: "column", width, marginRight: gap },
        h(Text, { color: sel.g === g ? palette.signal : palette.normal, dimColor: dim, bold: sel.g === g, inverse: true, wrap: "truncate" },
            " ".repeat(left) + label + " ".repeat(rest - left)),
        ...group.lanes.map((lane, l) => renderLane(ctx, lane, g, l, width, heights[l])))
}

/*  switch the mouse click reporting of the terminal (xterm, SGR encoding) on or off  */
const mouseReporting = (on: boolean): void => {
    process.stdout.write(on ? "\x1b[?1000h\x1b[?1006h" : "\x1b[?1006l\x1b[?1000l")
}

/*  the root component of the terminal board  */
const App = ({ log, graph, initial }: { log: Log, graph: boolean, initial: Board }) => {
    const { exit, suspendTerminal } = useApp()
    const { columns, rows } = useWindowSize()
    const [ all,     setBoard   ] = React.useState<Board>(initial)
    const [ surface, setSurface ] = React.useState<Surface>(() => BoardState.load().tui)
    const [ view,    setView    ] = React.useState<"lanes" | "graph">(graph ? "graph" : "lanes")
    const [ filter,  setFilter  ] = React.useState("")
    const [ typing,  setTyping  ] = React.useState(false)

    /*  the shown board: all tasks reduced onto the ones matching the filter
        query (plus, in the graph view, their direct dependencies as context)  */
    const board = React.useMemo(() => filterBoard(all, filter, view === "graph"), [ all, filter, view ])
    const [ sel,     setSel     ] = React.useState<Sel>(() => relocate(board, { g: 0, l: 0, id: "" }, surface))
    const [ dialog,  setDialog  ] = React.useState<{ id: string, tab: number, first: number, scrolls: Record<number, number> } | null>(null)
    const [ plan,    setPlan    ] = React.useState<{ id: string, parts: PlanParts } | null>(null)
    const [ files,   setFiles   ] = React.useState<Map<string, Buffer | Error>>(new Map())
    const [ first,   setFirst   ] = React.useState(0)
    const [ scroll,  setScroll  ] = React.useState({ x: 0, y: 0 })
    const [ layout,  setLayout  ] = React.useState<{ board: Board, graph: GraphLayout, titles: boolean } | null>(null)
    const [ notice,  setNotice  ] = React.useState<string | null>(null)
    const [ carry,   setCarry   ] = React.useState<Carry | null>(null)
    const [ cycle,   setCycle   ] = React.useState<TaskFormat.TaskLifecycle | null>(null)
    const editing = React.useRef(false)
    const drafts  = React.useRef(new Map<string, string>())

    /*  the rendered card and lane boxes of the lane view, for the mouse hit-testing  */
    const cardBoxes = React.useRef(new Map<string, DOMElement>())
    const laneBoxes = React.useRef(new Map<string, DOMElement>())
    const register  = (map: Map<string, DOMElement>, key: string) => (el: DOMElement | null) => {
        if (el !== null)
            map.set(key, el)
        else
            map.delete(key)
    }
    const cardRef   = (id: string) => register(cardBoxes.current, id)
    const laneRef   = (g: number, l: number) => register(laneBoxes.current, `${g}:${l}`)

    /*  the rendered view value and filter field of the header, for the mouse hit-testing  */
    const headBoxes = React.useRef(new Map<string, DOMElement>())
    const headRef   = (key: "view" | "filter" | "clear") => register(headBoxes.current, key)

    /*  find the registered box under a (0-based) mouse position  */
    const boxAt = (map: Map<string, DOMElement>, mx: number, my: number): string | undefined => {
        for (const [ key, el ] of map) {
            const m = measureElement(el)
            if (mx >= m.x && mx < m.x + m.width && my >= m.y && my < m.y + m.height)
                return key
        }
        return undefined
    }

    /*  the rendered graph viewport content, for the mouse hit-testing  */
    const graphView = React.useRef<DOMElement | null>(null)

    /*  report mouse clicks while the board runs and mouse support is enabled
        (disabling it gives the regular text selection of the terminal back)  */
    const [ mouse, setMouse ] = React.useState(true)
    const mouseOn = React.useRef(true)
    const opening = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => {
        mouseOn.current = mouse
        mouseReporting(mouse)
        return () => {
            mouseReporting(false)
        }
    }, [ mouse ])
    React.useEffect(() => {
        return () => {
            if (opening.current !== null)
                clearTimeout(opening.current)
        }
    }, [])

    /*  fetch the task lifecycle model (for checking the moves of tasks)
        whenever the board and hence possibly its lifecycle mode changes  */
    React.useEffect(() => {
        let live = true
        Task.lifecycle(log).then((lifecycle) => {
            if (live)
                setCycle(lifecycle)
        }).catch((err: unknown) => {
            log.write("warning", `board: loading lifecycle failed: ${err instanceof Error ? err.message : String(err)}`)
        })
        return () => {
            live = false
        }
    }, [ log, all ])

    /*  auto-clear a status notice after 5 seconds  */
    React.useEffect(() => {
        if (notice === null)
            return
        const timer = setTimeout(() => {
            setNotice(null)
        }, 5 * 1000)
        return () => {
            clearTimeout(timer)
        }
    }, [ notice ])

    /*  drop a carried task if it vanished or changed its status in the meantime  */
    React.useEffect(() => {
        if (carry !== null && all.cards.get(carry.id)?.status !== carry.from) {
            setCarry(null)
            setNotice(`moving task "${carry.id}" cancelled: task changed in the meantime`)
        }
    }, [ all, carry ])

    /*  remember the box of every graph node for the spatial navigation and the scrolling  */
    const places = React.useMemo(() => {
        const map = new Map<string, { r: number, c: number, top: number, bottom: number, bl: number, br: number }>()
        if (layout !== null)
            for (const n of layout.graph.nodes.values())
                map.set(n.id, { r: n.y + Math.floor(n.h / 2), c: n.x + Math.floor(n.w / 2), top: n.y, bottom: n.y + n.h - 1, bl: n.x, br: n.x + n.w - 1 })
        return map
    }, [ layout ])

    /*  follow changes of the task storage and of the lifecycle mode  */
    React.useEffect(() => {
        const refresh = async () => {
            setBoard(await buildBoard(log))
        }
        const stop = watchTasks(log, refresh)
        return () => {
            stop().catch(() => {})
        }
    }, [ log ])

    /*  fetch the plan (with its attachments) of the read dialog whenever it is opened or the board changes  */
    const dialogId  = dialog?.id
    const dialogTab = dialog?.tab ?? 0
    React.useEffect(() => {
        if (dialogId === undefined)
            return
        let live = true
        Promise.all([ Task.parts(log, dialogId), Task.attachments(log, dialogId) ]).then(([ parts, atts ]) => {
            if (live)
                setPlan({ id: dialogId, parts: parts === null ? null : { ...parts, atts } })
        }).catch((err: unknown) => {
            log.write("warning", `board: loading plan failed: ${err instanceof Error ? err.message : String(err)}`)
            if (live)
                setPlan({ id: dialogId, parts: err instanceof Error ? err : new Error(String(err)) })
        })
        return () => {
            live = false
        }
    }, [ log, all, dialogId ])

    /*  fetch the file content of the attachment of the selected tab, whenever the tab is selected or the plan changes  */
    React.useEffect(() => {
        const parts = plan !== null && plan.id === dialogId ? plan.parts : undefined
        if (parts === undefined || parts === null || parts instanceof Error || dialogTab === 0 || parts.atts[dialogTab - 1]?.file === undefined)
            return
        const id  = plan!.id
        const key = `${id}:${dialogTab}`
        let live = true
        Task.attachmentContent(log, id, dialogTab - 1).then((content) =>
            content?.content ?? new Error("no such attachment content")
        ).catch((err: unknown) =>
            err instanceof Error ? err : new Error(String(err))
        ).then((content) => {
            if (live)
                setFiles((files) => new Map(files).set(key, content))
        })
        return () => {
            live = false
        }
    }, [ log, plan, dialogId, dialogTab ])

    /*  lay out the dependency graph whenever it is shown, the board changes,
        the showing of task titles is toggled, or the window width changes
        (as every task box gets a fixed quarter of the graph viewport width)  */
    const graphTitles = surface.titles
    const graphNodeW  = Math.max(12, Math.floor((columns - 6) / 4))
    React.useEffect(() => {
        if (view !== "graph")
            return
        let live = true
        layoutGraph(board, "cell", graphTitles, graphNodeW).then((g) => {
            if (live)
                setLayout({ board, graph: g, titles: graphTitles })
        }).catch((err: unknown) => {
            log.write("warning", `board: graph layout failed: ${err instanceof Error ? err.message : String(err)}`)
        })
        return () => {
            live = false
        }
    }, [ log, board, view, graphTitles, graphNodeW ])

    /*  toggle a minimized lane or a collapsed group of the TUI surface  */
    const toggle = (list: SurfaceList, entry: string): void => {
        BoardState.toggle("tui", list, entry).then((state) => {
            setSurface(state.tui)
        }).catch((err: unknown) => {
            log.write("warning", `board: toggling ${list} failed: ${err instanceof Error ? err.message : String(err)}`)
        })
    }

    /*  edit a task with $EDITOR on a temporary file, handing the terminal
        over to the editor; a draft which failed to save is kept and
        offered again on the next edit of the same task  */
    const edit = async (id: string): Promise<void> => {
        const orig = await Task.load(log, id)
        if (orig === "") {
            setNotice(`task "${id}" no longer exists`)
            return
        }
        const dir  = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ase-task-"))
        const file = path.join(dir, `${id}.md`)
        try {
            await fs.promises.writeFile(file, drafts.current.get(id) ?? orig, "utf8")

            /*  run $EDITOR through the shell (to support values with arguments or
                quoting), passing the file via the environment to avoid quoting it  */
            const editor = (process.env.EDITOR ?? "").trim() || "vi"
            const ref    = process.platform === "win32" ? "\"%ASE_TASK_FILE%\"" : "\"$ASE_TASK_FILE\""
            await suspendTerminal(async () => {
                mouseReporting(false)
                try {
                    await execa(`${editor} ${ref}`, { shell: true, stdio: "inherit", env: { ASE_TASK_FILE: file } })
                }
                finally {
                    mouseReporting(mouseOn.current)
                }
            })
            const text = await fs.promises.readFile(file, "utf8")
            if (text === orig) {
                drafts.current.delete(id)
                setNotice(`task "${id}" unchanged`)
                return
            }

            /*  refuse to overwrite changes made meanwhile by others (e.g. an agent or
                the web board), keeping the edit as a draft for the next edit  */
            const curr = await Task.load(log, id)
            if (curr === "") {
                drafts.current.delete(id)
                setNotice(`task "${id}" was deleted meanwhile (edit discarded)`)
                return
            }
            else if (curr !== orig) {
                drafts.current.set(id, text)
                setNotice(`task "${id}" was changed meanwhile (press "e" to re-edit and overwrite)`)
                return
            }
            try {
                await Task.save(log, id, text)
                drafts.current.delete(id)
                setNotice(`task "${id}" saved`)
            }
            catch (err: unknown) {
                drafts.current.set(id, text)
                const msg = err instanceof Error ? err.message : String(err)
                setNotice(`saving task "${id}" failed: ${msg} (press "e" to re-edit)`)
            }
        }
        finally {
            await fs.promises.rm(dir, { recursive: true, force: true })
        }
    }

    /*  keep the selection valid on every board, surface, or view change
        (the graph view shows all nodes, so it ignores minimized lanes and collapsed groups)  */
    React.useEffect(() => {
        setSel((s) => relocate(board, s, view === "graph" ? { ...surface, minimized: [], collapsed: [] } : surface))
    }, [ board, surface, view ])

    const headH  = 2
    const footH  = 4
    const boardH = rows - headH - footH
    const innerW = columns - 2

    /*  the tabs of the read dialog, the lines of its selected tab (clamped to
        the existing tabs), and the maximum scroll offset of these lines  */
    const dialogW     = Math.min(columns - 2, 100)
    const dialogParts = dialog !== null && plan?.id === dialog.id ? plan.parts : undefined
    const tabLabels   = dialogTabs(dialogParts)
    const dialogSel   = Math.min(dialogTab, tabLabels.length - 1)
    const dialogAtt   = dialogSel > 0 && dialogParts !== undefined && dialogParts !== null && !(dialogParts instanceof Error) ?
        dialogParts.atts[dialogSel - 1] : undefined
    const dialogLines = dialog === null ? [] : dialogAtt !== undefined ?
        attachmentLines(dialogAtt, files.get(`${dialog.id}:${dialogSel}`), Math.max(1, dialogW - 5)) :
        planLines(dialogParts, dialog.id, Math.max(1, dialogW - 5))
    const dialogMax   = Math.max(0, dialogLines.length - (rows - DIALOG_CHROME))

    /*  scroll the selected tab of the read dialog  */
    const dialogScroll = (delta: number) => {
        if (dialog === null)
            return
        const scroll = Math.max(0, Math.min(dialogMax, (dialog.scrolls[dialogSel] ?? 0) + delta))
        setDialog({ ...dialog, scrolls: { ...dialog.scrolls, [dialogSel]: scroll } })
    }

    /*  determine the visible groups, following the selection
        (storing the derived state during rendering is idempotent)  */
    let fit = fitGroups(board.groups, surface.collapsed, Math.min(first, board.groups.length - 1), innerW)
    while (sel.g < fit.first)
        fit = fitGroups(board.groups, surface.collapsed, fit.first - 1, innerW)
    while (sel.g > fit.last && fit.first < board.groups.length - 1)
        fit = fitGroups(board.groups, surface.collapsed, fit.first + 1, innerW)
    if (fit.first !== first)
        setFirst(fit.first)

    /*  scroll the graph viewport so the box of the selected node stays visible  */
    const viewH = boardH - 2
    const viewW = innerW - 4
    let   { x, y } = scroll
    const box = view === "graph" ? places.get(sel.id) : undefined
    if (box !== undefined) {
        if (box.top < y)                   y = box.top
        if (box.bottom > y + viewH - 1)    y = box.bottom - viewH + 1
        if (box.bl < x)                    x = Math.max(0, box.bl - 2)
        if (box.br > x + viewW - 1)        x = box.br - viewW + 3
    }
    if (x !== scroll.x || y !== scroll.y)
        setScroll({ x, y })

    /*  the graph navigation order: by level, then by creation time  */
    const nodes = [ ...board.cards.values() ].sort((a, b) =>
        board.levels.get(a.id)! - board.levels.get(b.id)! || byCreation(a, b))

    /*  handle a mouse press (0-based column/row, button 0: left press,
        64/65: wheel up/down): a click opens the clicked task, while a
        click onto its " X " closes an open task view, and the wheel scrolls it  */
    const onMouse = (btn: number, mx: number, my: number): void => {
        if (dialog !== null) {
            /*  a click onto the tab bar (the sixth dialog row) selects the clicked
                tab, or the previous/next tab on a scroll arrow, but never closes  */
            const barX   = Math.floor((columns - dialogW) / 2) + 1
            const closeX = barX - 1 + dialogW - DIALOG_CLOSE
            if (btn === 0 && my === 1 && mx >= closeX && mx < closeX + 3)
                setDialog(null)
            else if (btn === 0 && my === 5 && mx >= barX && mx < barX + dialogW - 2) {
                const lay  = tabLayout(tabLabels, dialog.first, dialogSel, dialogW - 2)
                const x    = mx - barX
                const item = lay.items.find((it) => x >= it.x && x < it.x + it.text.length)
                let   tab  = dialogSel
                if (item !== undefined)
                    tab = item.index
                else if (x === 0 && lay.less)
                    tab = dialogSel - 1
                else if (x === dialogW - 3 && lay.more)
                    tab = dialogSel + 1
                if (tab !== dialogSel)
                    setDialog({ ...dialog, tab, first: tabFirst(tabLabels, dialog.first, tab, dialogW - 4) })
            }
            else if (btn === 64 || btn === 65)
                dialogScroll(btn === 64 ? -3 : 3)
            return
        }

        /*  a click onto the view value of the header switches the view, a click
            onto the filter field starts typing into it (unless a task is moved),
            a click onto its clear button clears it, and any other click ends
            typing (keeping the filter query)  */
        const head = btn === 0 ? boxAt(headBoxes.current, mx, my) : undefined
        if (typing && head !== "filter")
            setTyping(false)
        if (head === "clear") {
            setFilter("")
            return
        }
        if (head === "view") {
            setCarry(null)
            setView(view === "lanes" ? "graph" : "lanes")
            return
        }
        if (head === "filter") {
            if (carry === null)
                setTyping(true)
            return
        }
        if ((btn === 64 || btn === 65) && view === "lanes") {
            /*  the wheel over a lane scrolls it, by stepping the selection
                through its cards (entering the lane at its first card)  */
            const at = boxAt(laneBoxes.current, mx, my)
            if (at === undefined)
                return
            const [ g, l ] = at.split(":").map(Number)
            const lane = board.groups[g].lanes[l]
            const list = board.lanes.get(lane.status) ?? []
            if (list.length === 0 || surface.minimized.includes(lane.status) || surface.collapsed.includes(board.groups[g].title))
                return
            const idx  = sel.g === g && sel.l === l ? list.findIndex((c) => c.id === sel.id) : -1
            const next = idx < 0 ? 0 : Math.max(0, Math.min(list.length - 1, idx + (btn === 64 ? -1 : 1)))
            setSel({ g, l, id: list[next].id })
            return
        }
        if (btn !== 0)
            return

        /*  a click onto a lane outside its cards (and while moving a task,
            anywhere onto a lane) just selects the lane, like PgUp/PgDn  */
        const card = view === "lanes" && carry === null ? boxAt(cardBoxes.current, mx, my) : undefined
        if (view === "lanes" && card === undefined) {
            const at = boxAt(laneBoxes.current, mx, my)
            if (at !== undefined) {
                const [ g, l ] = at.split(":").map(Number)
                const next = groupItems(board, g, surface).find((it) => it.l === l)
                if (next !== undefined && !(sel.g === g && sel.l === l))
                    setSel(next)
            }
            return
        }
        if (carry !== null)
            return
        let hit: string | undefined
        if (view === "lanes")
            hit = card
        else if (layout !== null && graphView.current !== null) {
            /*  map the click into the graph grid via the measured viewport origin  */
            const m  = measureElement(graphView.current)
            const gx = mx - m.x + scroll.x
            const gy = my - m.y + scroll.y
            for (const n of layout.graph.nodes.values())
                if (gx >= n.x && gx < n.x + n.w && gy >= n.y && gy < n.y + n.h)
                    hit = n.id
        }
        if (hit !== undefined && board.cards.has(hit)) {
            /*  first visibly select the clicked task, then shortly afterwards open its view  */
            const id = hit
            setSel(relocate(board, { g: sel.g, l: sel.l, id },
                view === "graph" ? { ...surface, minimized: [], collapsed: [] } : surface))
            if (opening.current !== null)
                clearTimeout(opening.current)
            opening.current = setTimeout(() => {
                opening.current = null
                setDialog({ id, tab: 0, first: 0, scrolls: {} })
            }, 150)
        }
    }

    /*  handle the keyboard and the mouse  */
    useInput((input, key) => {
        /*  ignore key releases (reported under the kitty keyboard protocol),
            as otherwise every toggling key would toggle twice  */
        if (key.eventType === "release")
            return

        /*  handle a mouse report (1-based column/row, "M" for press, "m" for release)  */
        const report = /^\[<(\d+);(\d+);(\d+)([Mm])$/.exec(input)
        if (report !== null) {
            if (report[4] === "M")
                onMouse(Number(report[1]), Number(report[2]) - 1, Number(report[3]) - 1)
            return
        }
        if (notice !== null)
            setNotice(null)

        /*  while typing into the filter field, all keys edit the filter query
            (applied live), until ENTER keeps it or ESC clears it  */
        if (typing && dialog === null) {
            if (key.return)
                setTyping(false)
            else if (key.escape) {
                setFilter("")
                setTyping(false)
            }
            else if (key.backspace || key.delete)
                setFilter((f) => f.slice(0, -1))
            else if (!key.ctrl && !key.meta && !/\p{Cc}/u.test(input))
                setFilter((f) => f + input)
            return
        }

        /*  toggle the mouse support in every view (under the kitty keyboard
            protocol, Shift+m arrives as "m" with the shift modifier)  */
        if (input === "M" || (input === "m" && key.shift)) {
            setMouse(!mouse)
            setNotice(mouse ? "mouse support disabled: regular text selection available" : "mouse support enabled")
            return
        }
        const startEdit = (id: string) => {
            if (editing.current)
                return
            editing.current = true
            setNotice(null)
            edit(id).catch((err: unknown) => {
                setNotice(`editing task "${id}" failed: ${err instanceof Error ? err.message : String(err)}`)
            }).finally(() => {
                editing.current = false
            })
        }
        if (dialog !== null) {
            const page = Math.max(1, rows - DIALOG_CHROME - 2)
            if (key.escape || key.return)
                setDialog(null)
            else if (input === "e")
                startEdit(dialog.id)
            else if (key.leftArrow || key.rightArrow) {
                const tab = Math.max(0, Math.min(tabLabels.length - 1, dialogSel + (key.leftArrow ? -1 : 1)))
                setDialog({ ...dialog, tab, first: tabFirst(tabLabels, dialog.first, tab, dialogW - 4) })
            }
            else if (key.upArrow)
                dialogScroll(-1)
            else if (key.downArrow)
                dialogScroll(1)
            else if (key.pageUp)
                dialogScroll(-page)
            else if (key.pageDown)
                dialogScroll(page)
            return
        }
        if (input === "q") {
            exit()
            return
        }
        if (input === "/") {
            if (carry === null)
                setTyping(true)
            return
        }
        if (input === "g" || input === "l") {
            if (input === "g")
                setCarry(null)
            setView(input === "g" ? "graph" : "lanes")
            return
        }
        if (key.return && sel.id !== "") {
            setDialog({ id: sel.id, tab: 0, first: 0, scrolls: {} })
            return
        }
        if (input === "e") {
            if (sel.id !== "")
                startEdit(sel.id)
            return
        }
        if (input === "t") {
            BoardState.toggleTitles("tui").then((state) => {
                setSurface(state.tui)
            }).catch((err: unknown) => {
                log.write("warning", `board: toggling titles failed: ${err instanceof Error ? err.message : String(err)}`)
            })
            return
        }
        if (view === "graph") {
            /*  move spatially to the nearest node in the direction of the
                arrow, as the nodes are placed on the screen, preferring nodes
                in the same row (left/right) or column (up/down)  */
            if (!(key.leftArrow || key.rightArrow || key.upArrow || key.downArrow))
                return
            const cur = places.get(sel.id)
            let   next: Card | undefined = cur === undefined ? nodes[0] : undefined
            if (cur !== undefined) {
                let best = Infinity
                for (const [ id, p ] of places) {
                    const dr = p.r - cur.r
                    const dc = p.c - cur.c
                    const ok = key.rightArrow ? dc > 0 : key.leftArrow ? dc < 0 : key.downArrow ? dr > 0 : dr < 0
                    if (id === sel.id || !ok)
                        continue
                    const score = key.leftArrow || key.rightArrow ?
                        Math.abs(dc) + Math.abs(dr) * 4 : Math.abs(dr) + Math.abs(dc) / 4
                    if (score < best) {
                        best = score
                        next = board.cards.get(id)
                    }
                }
            }
            if (next !== undefined)
                setSel(relocate(board, { g: sel.g, l: sel.l, id: next.id }, { ...surface, minimized: [], collapsed: [] }))
            return
        }
        if (key.escape && carry !== null) {
            /*  cancel the move and return the selection to the task at its original position  */
            setCarry(null)
            setSel(relocate(board, { g: sel.g, l: sel.l, id: carry.id }, surface))
            setNotice(`moving task "${carry.id}" cancelled`)
            return
        }
        if (input === " ") {
            /*  pick up the selected task, determining all lanes whose state
                is directly or indirectly reachable from its current state  */
            if (carry === null) {
                const card = board.cards.get(sel.id)
                if (card === undefined)
                    return
                if (cycle === null) {
                    setNotice("task lifecycle model not yet loaded")
                    return
                }
                const targets = new Set(board.groups.flatMap((g) => g.lanes.map((l) => l.status))
                    .filter((s) => s !== card.status && TaskFormat.checkStatus(cycle, card.actual, s) === ""))
                setCarry({ id: card.id, from: card.status, targets })
                return
            }

            /*  drop the carried task onto the selected lane, if reachable  */
            if (surface.collapsed.includes(board.groups[sel.g].title))
                return
            const to = board.groups[sel.g].lanes[sel.l].status
            if (to === carry.from) {
                setCarry(null)
                setNotice(`moving task "${carry.id}" cancelled`)
                return
            }
            if (!carry.targets.has(to)) {
                setNotice(`task "${carry.id}" cannot move from ${carry.from} to ${to}: not reachable in the lifecycle model`)
                return
            }
            const { id } = carry
            setCarry(null)
            Task.setStatus(log, id, to).then((result) => {
                setSel({ g: sel.g, l: sel.l, id })
                setNotice(`task "${id}" moved from ${result.from} to ${result.to}`)
            }).catch((err: unknown) => {
                setNotice(`moving task "${id}" failed: ${err instanceof Error ? err.message : String(err)}`)
            })
            return
        }
        if (input === "m" && !key.shift) {
            if (surface.collapsed.includes(board.groups[sel.g].title))
                return
            const lane = board.groups[sel.g].lanes[sel.l]
            toggle("minimized", lane.status)
            return
        }
        if (input === "c") {
            toggle("collapsed", board.groups[sel.g].title)
            return
        }
        if (key.leftArrow || key.rightArrow) {
            const g = Math.max(0, Math.min(board.groups.length - 1, sel.g + (key.leftArrow ? -1 : 1)))
            if (g !== sel.g) {
                const items = groupItems(board, g, surface)
                setSel(items.find((it) => it.l === sel.l) ?? items[0])
            }
            return
        }
        if ((key.upArrow || key.downArrow) && carry === null) {
            /*  within a collapsed group, the items are the lanes themselves  */
            const items = groupItems(board, sel.g, surface)
            const idx   = items.findIndex((it) => it.l === sel.l && it.id === sel.id)
            const next  = items[Math.max(0, Math.min(items.length - 1, idx + (key.upArrow ? -1 : 1)))]
            if (next !== undefined)
                setSel(next)
            return
        }
        if (key.pageUp || key.pageDown || key.upArrow || key.downArrow) {
            /*  jump directly to the first item of the upper or lower lane of the group
                (while moving a task, also on up/down, as only the target lane matters)  */
            const up   = key.pageUp || key.upArrow
            const l    = Math.max(0, Math.min(board.groups[sel.g].lanes.length - 1, sel.l + (up ? -1 : 1)))
            const next = groupItems(board, sel.g, surface).find((it) => it.l === l)
            if (next !== undefined && l !== sel.l)
                setSel(next)
            return
        }
        if (key.tab) {
            /*  step through the lanes of the expanded groups row by row: first
                left/right through the groups, then wrap into the next/previous
                row of lanes (and at the very end/start around the board)  */
            const rows  = Math.max(...board.groups.map((g) => g.lanes.length))
            const lanes = [] as { g: number, l: number }[]
            for (let l = 0; l < rows; l++)
                board.groups.forEach((group, g) => {
                    if (l < group.lanes.length && !surface.collapsed.includes(group.title))
                        lanes.push({ g, l })
                })
            if (lanes.length === 0)
                return
            const idx    = lanes.findIndex((p) => p.g === sel.g && p.l === sel.l)
            const target = idx < 0 ? lanes[key.shift ? lanes.length - 1 : 0] :
                lanes[(idx + (key.shift ? lanes.length - 1 : 1)) % lanes.length]
            const next   = groupItems(board, target.g, surface).find((it) => it.l === target.l)
            if (next !== undefined)
                setSel(next)
        }
    })

    /*  refuse to draw into a too small window  */
    if (columns < 40 || rows < 16)
        return h(Box, { width: columns, height: rows, justifyContent: "center", alignItems: "center" },
            h(Text, { color: palette.signal }, `window too small (${columns}×${rows}) — needs at least 40×16`))

    const dim = dialog !== null

    /*  the status line of the footer, right before the key hints  */
    const status = h(Box, { key: "status", paddingX: 1, justifyContent: "center" },
        h(Text, { color: palette.signal, dimColor: dim, wrap: "truncate" },
            notice !== null ? sanitize(notice) :
                carry !== null ? `moving task "${carry.id}" from ${carry.from}: select a bold lane, SPACE drops, ESC cancels` :
                    typing ? "filtering tasks by fuzzy matched keywords (SPACE: and, COMMA: or): ⏎ keeps, ESC clears" : " "))

    /*  render the lane view  */
    const renderLanes = () => {
        const total  = board.groups.length
        const shown  = fit.last - fit.first + 1
        const arrows = shown < total
        const info   = `groups ${fit.first + 1}–${fit.last + 1} of ${total} · ${arrows ? "←/→ scrolls" : "all visible"}`

        /*  the scroll bar consumes the entire width remaining besides the info  */
        const track  = Math.max(1, columns - 2 - info.length - 3)
        const on     = Math.max(1, Math.round(track * shown / total))
        const off    = Math.round(track * fit.first / total)
        const minned = surface.minimized.includes(board.groups[sel.g]?.lanes[sel.l]?.status ?? "")
        const folded = surface.collapsed.includes(board.groups[sel.g]?.title ?? "")
        const edges  = { left: fit.first > 0 ? fit.first : -1, right: fit.last < total - 1 ? fit.last : -1 }
        return [
            h(Box, { key: "board", height: boardH, paddingX: 1 },
                ...board.groups.slice(fit.first, fit.last + 1).map((g, i) => renderGroup({ board, surface, sel, dim, carry, titles: surface.titles, scroll: edges, cardRef, laneRef }, g, fit.first + i, fit.widths[i], boardH, i === fit.widths.length - 1))),
            h(Box, { key: "bar", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" },
                    (arrows ? "░".repeat(off) + "█".repeat(on) + "░".repeat(Math.max(0, track - off - on)) + " · " : "") + info)),
            status,
            h(Box, { key: "keys1", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" },
                    "↑/↓/←/→: select task · ⇈/⇊/⇤/⇥: select lane · ⏎: view task · e: edit task · SPACE: move task")),
            h(Box, { key: "keys2", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" },
                    `m: ${minned ? "maximize" : "minimize"} lane · c: ${folded ? "expand" : "collapse"} group · ` +
                    `t: ${surface.titles ? "collapse" : "expand"} titles · M: ${mouse ? "disable" : "enable"} mouse · ` +
                    "/: filter · g: switch to graph · q: quit"))
        ]
    }

    /*  render the graph view  */
    const renderGraph = () => {
        const card = sel.id !== "" ? board.cards.get(sel.id) : undefined
        if (layout === null)
            return [ h(Box, { key: "graph", height: boardH, marginX: 1, paddingX: 1, borderStyle: "round", borderColor: palette.dim },
                h(Text, { color: palette.dim }, board.cards.size === 0 ? "(no tasks)" : "laying out …")),
            h(Text, { key: "info" }, " "), status, h(Text, { key: "keys1" }, " "), h(Text, { key: "keys2" }, " ") ]

        /*  draw the ELK layout  */
        const { lines, tones } = drawGraphText(layout.board, layout.graph, sel.id, layout.titles)
        const styles: Record<string, { color?: string, bold?: boolean, inverse?: boolean }> = {
            sel: { color: palette.signal, bold: true }, done: { color: palette.dim }, active: { color: palette.accent },
            "sel-frame": { color: palette.signal }, "done-frame": { color: palette.dim }, "active-frame": { color: palette.accent },
            "sel-title": { color: palette.signal }, "done-title": { color: palette.dim }, "active-title": { color: palette.accent },
            "sel-id": { color: palette.signal, bold: true, inverse: true }, "done-id": { color: palette.dim, bold: true, inverse: true }, "active-id": { color: palette.accent, bold: true, inverse: true },
            idle: { color: palette.normal }, "idle-frame": { color: palette.normal }, "idle-title": { color: palette.normal }, "idle-id": { color: palette.normal, bold: true, inverse: true },
            "edge": { color: palette.dim }, "edge-sel": { color: palette.signal }
        }
        const visible = lines.slice(y, y + viewH).map((l, i) => {
            const segs = [] as { text: string, tone: string }[]
            for (let k = x; k < Math.min(l.length, x + viewW); k++) {
                const tone = tones[y + i][k]
                if (segs.length > 0 && segs[segs.length - 1].tone === tone)
                    segs[segs.length - 1].text += l[k]
                else
                    segs.push({ text: l[k], tone })
            }
            return segs
        })
        const edges   = [ ...board.pred.values() ].reduce((n, ps) => n + ps.length, 0)
        const roots   = [ ...board.cards.keys() ].filter((id) => (board.pred.get(id) ?? []).length === 0).length
        return [
            h(Box, { key: "graph", height: boardH, marginX: 1 },
                h(Box, { flexGrow: 1, flexDirection: "column", paddingX: 1, borderStyle: "round", borderColor: palette.dim, borderDimColor: dim },
                    h(Box, { ref: graphView, flexDirection: "column" },
                        ...visible.map((segs, i) => h(Box, { key: i },
                            ...(segs.length === 0 ? [ h(Text, { key: 0 }, " ") ] : segs.map((seg, k) =>
                                h(Text, { key: k, dimColor: dim, ...(styles[seg.tone] ?? {}) }, seg.text))))))),

                /*  overlay the graph statistics onto the top-right corner of the border  */
                h(Box, { position: "absolute", top: 0, right: 2 },
                    h(Text, { color: palette.dim, dimColor: dim },
                        ` ${board.cards.size} nodes, ${edges} edges, ${roots} roots${board.cyclic.size > 0 ? ", CYCLES" : ""} `))),
            h(Box, { key: "info", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" }, card === undefined ? " " :
                    `${card.id} · ${card.status} · predecessors: ` +
                    `${(board.pred.get(card.id) ?? []).join(", ") || "—"} · successors: ` +
                    `${(board.succ.get(card.id) ?? []).join(", ") || "—"} (computed)`)),
            status,
            h(Box, { key: "keys1", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" },
                    "↑/↓/←/→: select task · ⏎: view task · e: edit task")),
            h(Box, { key: "keys2", paddingX: 1, justifyContent: "center" },
                h(Text, { color: palette.dim, dimColor: dim, wrap: "truncate" },
                    `t: ${graphTitles ? "collapse" : "expand"} titles · M: ${mouse ? "disable" : "enable"} mouse · ` +
                    "/: filter · l: switch to lanes · q: quit"))
        ]
    }

    /*  the counted tasks (without the context tasks of a filtered graph), and
        the (inversely rendered) filter field of the header: the tail of the
        filter query (with the cursor while typing), padded to a fixed width,
        followed by its clear button (shown with a filter query only)  */
    const tasks = [ ...board.cards.values() ].filter((c) => !board.context.has(c.id))
    const field = (sanitize(filter) + (typing ? "▏" : "")).slice(-14).padEnd(14)

    /*  render the whole screen  */
    return h(Box, { width: columns, height: rows, flexDirection: "column" },
        /*  the header, with the view value and the filter field in boxes of
            their own, so that they are measurable for the mouse hit-testing  */
        h(Box, { justifyContent: "center", paddingX: 1 },
            h(Text, { color: palette.normal, dimColor: dim, wrap: "truncate" },
                "⧉ ASE: ",
                h(Text, { bold: true }, "Task Board"),
                " · project: ",
                h(Text, { bold: true }, path.basename(Task.projectRoot())),
                " · mode: ",
                h(Text, { bold: true }, board.mode),
                " · tasks: ",
                h(Text, { bold: true }, `${tasks.filter((c) => toneOf(board, c) !== "done").length}/${tasks.length}`),
                " · view: "),
            h(Box, { ref: headRef("view"), flexShrink: 0 },
                h(Text, { color: palette.normal, dimColor: dim, bold: true }, view)),
            h(Text, { color: palette.normal, dimColor: dim, wrap: "truncate" }, " · filter: "),
            h(Box, { ref: headRef("filter"), flexShrink: 0 },
                h(Text, { color: typing ? palette.signal : palette.normal, dimColor: dim, bold: true, inverse: true }, field)),
            h(Box, { ref: headRef("clear"), flexShrink: 0 },
                h(Text, { color: typing ? palette.signal : palette.normal, dimColor: dim, bold: true, inverse: true },
                    filter !== "" ? "✕ " : "  "))),
        h(Box, { paddingX: 1 },
            h(Text, { color: palette.signal, dimColor: dim, wrap: "truncate" },
                board.warnings.length > 0 ? `⚠ ${board.warnings.map(sanitize).join(" · ")}` : " ")),
        ...(view === "lanes" ? renderLanes() : renderGraph()),
        dialog !== null ? renderDialog({
            card:    all.cards.get(dialog.id),
            group:   all.groups.find((g) => g.lanes.some((l) => l.status === all.cards.get(dialog.id)?.status))?.title,
            id:      dialog.id,
            pred:    all.pred.get(dialog.id) ?? [],
            succ:    all.succ.get(dialog.id) ?? [],
            tint:    (ref) => {
                const c    = all.cards.get(ref)
                const tone = c !== undefined ? toneOf(all, c) : "idle"
                return tone === "active" ? palette.accent : tone === "done" ? palette.dim : palette.normal
            },
            tabs:    tabLabels,
            tab:     dialogSel,
            first:   dialog.first,
            scroll:  dialog.scrolls[dialogSel] ?? 0,
            lines:   dialogLines,
            columns,
            rows,
            notice
        }) : null)
}

/*  run the terminal board until the user quits  */
export const runTUI = async (log: Log, graph: boolean): Promise<void> => {
    const initial = await buildBoard(log)
    palette = loadPalette(log)

    /*  defer stderr log output while Ink draws, as it bypasses patchConsole  */
    log.defer(true)

    /*  ensure the terminal never stays in mouse reporting mode,
        even on a premature process exit (e.g. an uncaught exception)  */
    const reset = () => {
        mouseReporting(false)
    }
    process.once("exit", reset)
    try {
        const app = render(h(App, { log, graph, initial }), { alternateScreen: true, exitOnCtrlC: true, patchConsole: true })
        await app.waitUntilExit()
    }
    finally {
        process.off("exit", reset)
        mouseReporting(false)
        log.defer(false)
    }
}

