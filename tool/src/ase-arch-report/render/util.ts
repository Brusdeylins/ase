/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  small helpers shared between the HTML and Markdown renderers
    and between the per-section render modules.  `escapeHtml` is
    used to guard every user-derived string before it is embedded
    into the HTML output; `safeId` is the canonical Mermaid /
    HTML-anchor identifier sanitiser used both as cluster-page
    filename basename and as Mermaid node id.  */

import type { ApiJson, Cluster, DocDebtEntry } from "../types.js"

export const escapeHtml = (s: string): string => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

/*  Mermaid identifier grammar requires an identifier to start with
    a letter or underscore and disallows several reserved keywords
    in node-id position.  `safeId` first replaces every non-alnum
    character with `_`, then prefixes an underscore when the result
    starts with a digit, and finally suffixes an underscore when
    the result matches a known reserved keyword.  Both guards are
    no-ops for the overwhelming majority of clean cluster / symbol
    names and only trigger for the rare edge cases (e.g. a cluster
    named `2025archive` or a class named `class`).  */
const MERMAID_RESERVED = new Set([
    "class", "end", "subgraph", "direction", "click", "style",
    "linkStyle", "classDef", "cssClass", "interpolate", "default",
    "graph", "flowchart", "stateDiagram", "sequenceDiagram",
    "erDiagram", "classDiagram", "quadrantChart", "xychart-beta"
])
export const safeId = (s: string): string => {
    let r = s.replace(/[^A-Za-z0-9_]/g, "_")
    if (/^[0-9]/.test(r))
        r = `_${r}`
    if (MERMAID_RESERVED.has(r))
        r = `${r}_`
    return r
}

/*  Canonical cell-key for the inter-cluster edge map shared by the
    DSM renderer (HTML grid + Markdown GFM table).  Centralising
    the key format prevents the two emission paths from diverging
    on future escape-character workarounds.  */
export const edgeCellKey = (from: string, to: string): string =>
    `${from}->${to}`

/*  Filter the global doc-debt list down to entries that belong to
    a given cluster.  Member-level entries use the `Symbol#member`
    FQN form so we split on `#` and match the prefix against the
    cluster's symbol FQN set — kept here as a single source of
    truth so both renderers cannot drift on the split semantics.  */
export const filterClusterDocDebt = (api: ApiJson, cluster: Cluster): DocDebtEntry[] => {
    const clusterFqns = new Set(cluster.symbols.map((s) => s.fqn))
    return api.docDebt.filter((d) => clusterFqns.has(d.fqn.split("#")[0]))
}

/*  Render a GFM table whose source is column-aligned with space
    padding so the raw .md file stays human-readable.  GFM parsers
    accept arbitrary dash-count separator rows, so widening the
    `---` segments to match the column width is a no-op for the
    rendered output but a major win for diffs and code review.

    All cell content is taken verbatim — callers must already
    embed any inline emphasis (`code`, _italic_) before handing
    rows in.  The helper does not know about display width vs.
    character width; for ASCII code identifiers (the only kind of
    content the arch-report emits in tables) the two coincide.

    Optional `align` array carries GFM's per-column alignment
    markers (`"left" | "right" | "center" | null`); the separator
    row encodes them via the colon-placement convention.  */
export type MdAlign = "left" | "right" | "center" | null
export const renderMdTable = (
    headers: string[], rows: string[][], align?: MdAlign[]
): string => {
    const cols = headers.length
    const widths = headers.map((h) => h.length)
    for (const row of rows)
        for (let i = 0; i < cols; i++) {
            const cell = i < row.length ? row[i] : ""
            if (cell.length > widths[i])
                widths[i] = cell.length
        }
    /*  GFM requires at least 3 dashes per separator cell;
        widen up to widths[i] to keep the source aligned.  */
    const sepWidth = (i: number): number => Math.max(3, widths[i])
    const pad = (s: string, w: number, a: MdAlign): string => {
        const gap = w - s.length
        if (gap <= 0)
            return s
        if (a === "right")
            return " ".repeat(gap) + s
        if (a === "center") {
            const left  = Math.floor(gap / 2)
            const right = gap - left
            return " ".repeat(left) + s + " ".repeat(right)
        }
        return s + " ".repeat(gap)
    }
    const sepCell = (i: number): string => {
        const w = sepWidth(i)
        const a = align?.[i] ?? null
        if (a === "left")   return ":" + "-".repeat(w - 1)
        if (a === "right")  return "-".repeat(w - 1) + ":"
        if (a === "center") return ":" + "-".repeat(w - 2) + ":"
        return "-".repeat(w)
    }
    const lines: string[] = []
    lines.push("| " + headers.map((h, i) => pad(h, widths[i], align?.[i] ?? null)).join(" | ") + " |")
    lines.push("| " + headers.map((_, i) => sepCell(i)).join(" | ") + " |")
    for (const row of rows) {
        const cells: string[] = []
        for (let i = 0; i < cols; i++) {
            const v = i < row.length ? row[i] : ""
            cells.push(pad(v, widths[i], align?.[i] ?? null))
        }
        lines.push("| " + cells.join(" | ") + " |")
    }
    return lines.join("\n")
}
