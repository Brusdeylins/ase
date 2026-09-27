/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                                   from "node:path"

import { render, Box, Text, useInput }        from "ink"

import type Log                               from "./ase-lib-log.js"
import { Task }                               from "./ase-task.js"
import { buildBoard, toneOf }                 from "./ase-task-board-core.js"
import type { Board }                         from "./ase-task-board-core.js"
import pkg                                    from "../package.json" with { type: "json" }
import { useBoardState, mouseReporting }      from "./ase-task-board-tui-model.js"
import type { BoardCtx }                      from "./ase-task-board-tui-model.js"
import { handleMouse, handleKey }             from "./ase-task-board-tui-control.js"
import { h, palette, loadPalette, renderLanes, renderGraph } from "./ase-task-board-tui-view.js"
import { sanitize, renderDialog, renderConfirm, renderTransfer } from "./ase-task-board-tui-popup.js"

/*  render the whole screen  */
const renderScreen = (ctx: BoardCtx) => {
    const {
        columns, rows, all, board, surface, view, filter, typing, dialog, notice, carry, confirm, transfer,
        headRef, tabLabels, dialogSel, dialogLines, transferCard, transferList, dim
    } = ctx

    /*  refuse to draw into a too small window  */
    if (columns < 40 || rows < 16)
        return h(Box, { width: columns, height: rows, justifyContent: "center", alignItems: "center" },
            h(Text, { color: palette.signal }, `window too small (${columns}×${rows}) — needs at least 40×16`))

    /*  the status line in the last line of the screen, below the key hints, enclosed
        on its left and right side by the downward lines of the rule above it,
        showing the ASE version (dimmed) while there is nothing else to report  */
    const report = notice !== null ? sanitize(notice) :
        carry !== null ? `moving task "${carry.id}" from ${carry.from}: select a bold lane, SPACE drops, ESC cancels` :
            typing ? "filtering tasks by fuzzy matched keywords (SPACE: and, COMMA: or): ⏎ keeps, ESC clears" : null
    const status = h(Box, { key: "status", paddingX: 1 },
        h(Box, { flexShrink: 0 }, h(Text, { color: palette.dim, dimColor: dim }, "│")),
        h(Box, { flexGrow: 1, justifyContent: "center", paddingX: 1 },
            h(Text, { color: report !== null ? palette.signal : palette.dim, dimColor: dim, wrap: "truncate" },
                report ?? [ "⧉ ASE: ", h(Text, { key: "app", bold: true }, "Task Board"),
                    " · Version: ", h(Text, { key: "version", bold: true }, `ASE ${pkg.version}`) ])),
        h(Box, { flexShrink: 0 }, h(Text, { color: palette.dim, dimColor: dim }, "│")))

    /*  the counted tasks (without the context tasks of a filtered graph), and
        the (inversely rendered) filter field of the header: the tail of the
        filter query (with the cursor while typing), padded to a fixed width,
        followed by its clear button (shown with a filter query only)  */
    const tasks = [ ...board.cards.values() ].filter((c) => !board.context.has(c.id))
    const field = (sanitize(filter) + (typing ? "▏" : "")).slice(-14).padEnd(14)

    /*  render the screen, with the dialog and popups on top  */
    return h(Box, { width: columns, height: rows, flexDirection: "column" },
        /*  the header, enclosed on its left and right side by the upward lines of
            the rule below it, with the view value and the filter field in boxes of
            their own, so that they are measurable for the mouse hit-testing  */
        h(Box, { paddingX: 1 },
            h(Box, { flexShrink: 0 }, h(Text, { color: palette.dim, dimColor: dim }, "│")),
            h(Box, { flexGrow: 1, justifyContent: "center", paddingX: 1 },
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
                    h(Text, { color: palette.dim, dimColor: dim, bold: true, inverse: true }, ` ${view} `)),
                h(Text, { color: palette.normal, dimColor: dim, wrap: "truncate" }, " · filter: "),
                h(Box, { ref: headRef("filter"), flexShrink: 0 },
                    h(Text, { color: typing ? palette.signal : palette.dim, dimColor: dim, bold: true, inverse: true }, field)),
                h(Box, { ref: headRef("clear"), flexShrink: 0 },
                    h(Text, { color: typing ? palette.signal : palette.dim, dimColor: dim, bold: true, inverse: true },
                        filter !== "" ? "✕ " : "  "))),
            h(Box, { flexShrink: 0 }, h(Text, { color: palette.dim, dimColor: dim }, "│"))),

        /*  the horizontal rule below the header, turning upward with rounded corners at both ends  */
        h(Text, { color: palette.dim, dimColor: dim }, " ╰" + "─".repeat(Math.max(0, columns - 4)) + "╯ "),
        h(Box, { paddingX: 1 },
            h(Text, { color: palette.signal, dimColor: dim, wrap: "truncate" },
                board.warnings.length > 0 ? `⚠ ${board.warnings.map(sanitize).join(" · ")}` : " ")),
        ...(view === "lanes" ? renderLanes(ctx) : renderGraph(ctx)).filter((el) => surface.keys || !String(el.key).startsWith("keys")),

        /*  the horizontal rule between the key hints and the status line, turning downward with rounded corners at both ends  */
        h(Text, { color: palette.dim, dimColor: dim }, " ╭" + "─".repeat(Math.max(0, columns - 4)) + "╮ "),
        status,
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
        }) : null,
        confirm !== null ? renderConfirm(confirm.id, confirm.yes, columns, rows) : null,
        transfer !== null && transferCard !== undefined ?
            renderTransfer(transfer.id, transferCard.status, transferList, transfer.at, columns, rows) : null)
}

/*  the root component of the terminal board  */
const App = ({ log, initial }: { log: Log, initial: Board }) => {
    const ctx = useBoardState(log, initial)

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
                handleMouse(ctx, Number(report[1]), Number(report[2]) - 1, Number(report[3]) - 1)
            return
        }
        handleKey(ctx, input, key)
    })
    return renderScreen(ctx)
}

/*  run the terminal board until the user quits  */
export const runTUI = async (log: Log): Promise<void> => {
    const initial = await buildBoard(log)
    loadPalette(log)

    /*  defer stderr log output while Ink draws, as it bypasses patchConsole  */
    log.defer(true)

    /*  ensure the terminal never stays in mouse reporting mode,
        even on a premature process exit (e.g. an uncaught exception)  */
    const reset = () => {
        mouseReporting(false)
    }
    process.once("exit", reset)
    try {
        const app = render(h(App, { log, initial }), { alternateScreen: true, exitOnCtrlC: true, patchConsole: true })
        await app.waitUntilExit()
    }
    finally {
        process.off("exit", reset)
        mouseReporting(false)
        log.defer(false)
    }
}

