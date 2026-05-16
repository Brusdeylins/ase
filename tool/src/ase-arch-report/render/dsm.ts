/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Dependency Structure Matrix (DSM) — an N×N table where rows and
    columns are clusters in topological order, and cell [i][j] is
    the edge-count from cluster i to cluster j.  Reading rules:

      - rows describe *who depends on whom* — a heavy row is a
        cluster with high fan-out (knows too much)
      - columns describe *what is depended upon* — a heavy column
        is a cluster with high fan-in (load-bearing)
      - cells *above the diagonal* are upward dependencies in a
        topological sort: in a healthy acyclic design they should
        be empty; any value there indicates an edge participating
        in a cycle and is rendered with an accent background

    This single table conveys more architectural truth per pixel
    than the same data spread across a flowchart.  */

import type { ApiJson } from "../types.js"
import { escapeHtml, safeId } from "./util.js"

export const dsmHtml = (api: ApiJson, sortedClusterNames: string[]): string => {
    if (sortedClusterNames.length === 0)
        return "<p><em>no clusters to plot</em></p>"
    const pos = new Map<string, number>()
    for (let i = 0; i < sortedClusterNames.length; i++)
        pos.set(sortedClusterNames[i], i)
    /*  build cell map [from][to] -> count  */
    const cell = new Map<string, number>()
    const cellKey = (from: string, to: string): string => `${from}->${to}`
    for (const e of api.edges) {
        if (pos.has(e.from) && pos.has(e.to))
            cell.set(cellKey(e.from, e.to), (cell.get(cellKey(e.from, e.to)) ?? 0) + e.count)
    }
    const rows: string[] = []
    /*  header row  */
    rows.push(`<tr><th class="dsm-corner"></th>${sortedClusterNames.map((name) =>
        `<th class="dsm-col"><span>${escapeHtml(name)}</span></th>`).join("")}</tr>`)
    /*  data rows  */
    for (const from of sortedClusterNames) {
        const cells: string[] = []
        for (const to of sortedClusterNames) {
            const c = cell.get(cellKey(from, to)) ?? 0
            const isDiagonal = from === to
            const isAboveDiagonal = pos.get(to)! < pos.get(from)!
            const classes = [ "dsm-cell" ]
            if (isDiagonal)
                classes.push("dsm-diag")
            else if (isAboveDiagonal && c > 0)
                classes.push("dsm-cycle")
            cells.push(`<td class="${classes.join(" ")}">${c === 0 ? "" : c}</td>`)
        }
        cells.unshift(`<th class="dsm-row" id="dsm-${safeId(from)}"><code>${escapeHtml(from)}</code></th>`)
        rows.push(`<tr>${cells.join("")}</tr>`)
    }
    return `<div class="dsm-wrap">
<table class="dsm">
${rows.join("\n")}
</table>
</div>`
}

export const dsmMd = (api: ApiJson, sortedClusterNames: string[]): string => {
    if (sortedClusterNames.length === 0)
        return "_no clusters to plot_\n"
    const pos = new Map<string, number>()
    for (let i = 0; i < sortedClusterNames.length; i++)
        pos.set(sortedClusterNames[i], i)
    const cell = new Map<string, number>()
    for (const e of api.edges)
        if (pos.has(e.from) && pos.has(e.to))
            cell.set(`${e.from}->${e.to}`, (cell.get(`${e.from}->${e.to}`) ?? 0) + e.count)
    const lines: string[] = []
    /*  abbreviate cluster name for compact column header  */
    const abbr = (n: string): string => n.length > 12 ? n.slice(0, 11) + "…" : n
    lines.push("| from \\ to | " + sortedClusterNames.map(abbr).join(" | ") + " |")
    lines.push("|" + "---|".repeat(sortedClusterNames.length + 1))
    for (const from of sortedClusterNames) {
        const cells = sortedClusterNames.map((to) => {
            const c = cell.get(`${from}->${to}`) ?? 0
            if (from === to)
                return "·"
            if (c === 0)
                return ""
            const isAbove = pos.get(to)! < pos.get(from)!
            return isAbove ? `**${c}**` : String(c)
        })
        lines.push(`| \`${abbr(from)}\` | ` + cells.join(" | ") + " |")
    }
    return lines.join("\n") + "\n\nAbove-diagonal cells (bold) indicate cycle-participating dependencies.\n"
}
