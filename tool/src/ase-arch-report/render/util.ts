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
