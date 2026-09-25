/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Cycle callout rendered on the Index page directly below the
    layered flowchart.  For every strongly-connected component
    with two or more cluster members we list the members and
    recommend the minimum-feedback-arc-set edges to cut so the
    architect has an *actionable* shortlist rather than a vague
    "there are cycles".  The empty-cycles case renders a positive
    green badge instead of a section full of "no value" prose.  */

import { escapeHtml }   from "./util.js"
import type { Cluster } from "../types.js"
import type { DirectedEdge } from "../graph/scc.js"

export interface CycleReport {
    /*  SCCs with >= 2 cluster members  */
    cycles: { members: string[]; cut: DirectedEdge[] }[]
}

export const cyclesHtml = (report: CycleReport): string => {
    if (report.cycles.length === 0)
        return "<section class=\"cycles\"><h2>Cyclic dependencies</h2><p class=\"sev-green\">no cyclic dependencies — every cluster sits in a clean DAG</p></section>"
    const items = report.cycles.map((cy, i) => {
        const members = cy.members.map((m) => `<code>${escapeHtml(m)}</code>`).join(" → ")
        const cutLine = cy.cut.length === 0 ? "" :
            `<br><em>cut to break:</em> ${cy.cut.map((e) =>
                `<code>${escapeHtml(e.from)} → ${escapeHtml(e.to)}</code>`).join(", ")}`
        return `<li><strong>Cycle ${i + 1}</strong> (${cy.members.length} clusters): ${members}${cutLine}</li>`
    }).join("\n")
    return `<section class="cycles"><h2>Cyclic dependencies</h2>
<p class="sev-red"><strong>${report.cycles.length}</strong> cycle group${report.cycles.length === 1 ? "" : "s"} detected — each cluster of a group depends transitively on every other</p>
<ol class="cycle-list">
${items}
</ol>
</section>`
}

export const cyclesMd = (report: CycleReport): string => {
    if (report.cycles.length === 0)
        return "## Cyclic dependencies\n\n_no cyclic dependencies — every cluster sits in a clean DAG_ ✓\n"
    const lines: string[] = []
    lines.push("## Cyclic dependencies\n")
    lines.push(`**${report.cycles.length}** cycle group${report.cycles.length === 1 ? "" : "s"} detected. [!]\n`)
    report.cycles.forEach((cy, i) => {
        const members = cy.members.map((m) => `\`${m}\``).join(" → ")
        lines.push(`${i + 1}. **Cycle ${i + 1}** (${cy.members.length} clusters): ${members}`)
        if (cy.cut.length > 0)
            lines.push(`   _cut to break:_ ${cy.cut.map((e) => `\`${e.from} → ${e.to}\``).join(", ")}`)
    })
    return lines.join("\n") + "\n"
}

/*  Count how many cycles touch a given cluster — used by the
    per-cluster stats panel "cycles touching" badge.  */
export const cyclesTouchingCluster = (report: CycleReport, cluster: Cluster): number => {
    let n = 0
    for (const cy of report.cycles)
        if (cy.members.includes(cluster.name))
            n++
    return n
}
