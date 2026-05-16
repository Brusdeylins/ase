/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Executive stats panel for the Index page and the per-cluster
    pages.  The panel sits directly under the page `<h1>` and gives
    the architect an immediate "is this codebase healthy?" read
    before they look at any diagram.  Every numeric value carries a
    threshold colour where applicable so review is glanceable;
    Martin metrics that cannot be reliably computed (small clusters,
    JavaScript/C languages) render as "N/A" rather than misleading
    zeros.  */

import type { ApiJson, Cluster }   from "../types.js"
import type { ClusterCoupling }    from "../metrics/coupling.js"
import type { MartinMetrics }      from "../metrics/martin.js"
import type { DocCoverage }        from "../metrics/doc-coverage.js"
import type { HubEntry }           from "../metrics/hubs.js"
import { escapeHtml }              from "./util.js"

export interface IndexStatsInput {
    api:           ApiJson
    cycleCount:    number
    docCoverage:   DocCoverage
    topFanIn:      HubEntry[]
    topFanOut:     HubEntry[]
    totalLoc:      number
}

export interface ClusterStatsInput {
    cluster:        Cluster
    coupling:       ClusterCoupling
    martin:         MartinMetrics
    docCoverage:    DocCoverage
    cyclesTouching: number
}

const sevClass = (s: "green" | "yellow" | "red"): string =>
    `sev-${s}`

const fmtN = (x: number): string =>
    x.toFixed(2)

/*  --- HTML --- */

export const indexStatsPanelHtml = (input: IndexStatsInput): string => {
    const a = input.api
    const totalSym = a.clusters.reduce((n, c) => n + c.symbols.length, 0)
    const cycleSev: "green" | "red" = input.cycleCount === 0 ? "green" : "red"
    const hubsLine = (label: string, list: HubEntry[]): string =>
        list.length === 0 ? "" :
            `<dt>${label}</dt><dd>${list.map((h) =>
                `<code>${escapeHtml(h.name)}</code>&nbsp;(${h.score})`).join(", ")}</dd>`
    return `<section class="stats-panel">
<dl>
<dt>Clusters</dt><dd>${a.clusters.length}</dd>
<dt>Symbols</dt><dd>${totalSym}</dd>
<dt>Files</dt><dd>${a.files.length}</dd>
<dt>Lines of code</dt><dd>${input.totalLoc.toLocaleString("en-US")}</dd>
<dt>Languages</dt><dd>${a.languages.join(", ")}</dd>
<dt>Cycles</dt><dd class="${sevClass(cycleSev)}">${input.cycleCount}</dd>
<dt>Doc-coverage</dt><dd class="${sevClass(input.docCoverage.severity)}">${input.docCoverage.percent}% (${input.docCoverage.documented}/${input.docCoverage.total})</dd>
${hubsLine("Top fan-in", input.topFanIn)}
${hubsLine("Top fan-out", input.topFanOut)}
</dl>
</section>`
}

export const clusterStatsPanelHtml = (input: ClusterStatsInput): string => {
    const c = input.cluster
    const m = input.martin
    const symCount = c.symbols.length
    const abstractCount = c.symbols.filter((s) => s.isAbstract).length
    const fileSet  = new Set(c.symbols.map((s) => s.file))
    const totalLoc = c.symbols.reduce((n, s) => n + s.loc, 0)
    const cycleSev: "green" | "red" = input.cyclesTouching === 0 ? "green" : "red"
    let martinBadge: string
    if (m.confidence === null)
        martinBadge = `<span class="sev-yellow">N/A (no abstract concept in ${c.language})</span>`
    else if (m.confidence === "low")
        martinBadge = "<span class=\"sev-yellow\">N/A (cluster too small)</span>"
    else
        martinBadge = `I=${fmtN(m.i)}&nbsp;·&nbsp;A=${fmtN(m.a)}&nbsp;·&nbsp;D=${fmtN(m.d)}&nbsp;·&nbsp;zone:&nbsp;<strong>${m.zone}</strong>`
    return `<section class="stats-panel">
<dl>
<dt>Language</dt><dd>${c.language}</dd>
<dt>Symbols</dt><dd>${symCount} (${abstractCount} abstract)</dd>
<dt>Files</dt><dd>${fileSet.size}</dd>
<dt>Lines of code</dt><dd>${totalLoc.toLocaleString("en-US")}</dd>
<dt>Doc-coverage</dt><dd class="${sevClass(input.docCoverage.severity)}">${input.docCoverage.percent}% (${input.docCoverage.documented}/${input.docCoverage.total})</dd>
<dt>Coupling</dt><dd>Ca=${m.ca}&nbsp;·&nbsp;Ce=${m.ce}</dd>
<dt>Martin</dt><dd>${martinBadge}</dd>
<dt>Cycles touching</dt><dd class="${sevClass(cycleSev)}">${input.cyclesTouching}</dd>
</dl>
</section>`
}

/*  --- Markdown --- */

const mdSev = (sev: "green" | "yellow" | "red"): string =>
    sev === "red" ? " [!]" : sev === "yellow" ? " [~]" : " ✓"

export const indexStatsPanelMd = (input: IndexStatsInput): string => {
    const a = input.api
    const totalSym = a.clusters.reduce((n, c) => n + c.symbols.length, 0)
    const cycleSev: "green" | "red" = input.cycleCount === 0 ? "green" : "red"
    const lines: string[] = []
    lines.push(`- Clusters: ${a.clusters.length}`)
    lines.push(`- Symbols: ${totalSym}`)
    lines.push(`- Files: ${a.files.length}`)
    lines.push(`- Lines of code: ${input.totalLoc.toLocaleString("en-US")}`)
    lines.push(`- Languages: ${a.languages.join(", ")}`)
    lines.push(`- Cycles: ${input.cycleCount}${mdSev(cycleSev)}`)
    lines.push(`- Doc-coverage: ${input.docCoverage.percent}% (${input.docCoverage.documented}/${input.docCoverage.total})${mdSev(input.docCoverage.severity)}`)
    if (input.topFanIn.length > 0)
        lines.push(`- Top fan-in: ${input.topFanIn.map((h) => `\`${h.name}\` (${h.score})`).join(", ")}`)
    if (input.topFanOut.length > 0)
        lines.push(`- Top fan-out: ${input.topFanOut.map((h) => `\`${h.name}\` (${h.score})`).join(", ")}`)
    return lines.join("\n") + "\n"
}

export const clusterStatsPanelMd = (input: ClusterStatsInput): string => {
    const c = input.cluster
    const m = input.martin
    const symCount = c.symbols.length
    const abstractCount = c.symbols.filter((s) => s.isAbstract).length
    const fileSet  = new Set(c.symbols.map((s) => s.file))
    const totalLoc = c.symbols.reduce((n, s) => n + s.loc, 0)
    const cycleSev: "green" | "red" = input.cyclesTouching === 0 ? "green" : "red"
    let martinLine: string
    if (m.confidence === null)
        martinLine = `N/A (no abstract concept in ${c.language})`
    else if (m.confidence === "low")
        martinLine = "N/A (cluster too small)"
    else
        martinLine = `I=${fmtN(m.i)} · A=${fmtN(m.a)} · D=${fmtN(m.d)} · zone: **${m.zone}**`
    const lines: string[] = []
    lines.push(`- Language: ${c.language}`)
    lines.push(`- Symbols: ${symCount} (${abstractCount} abstract)`)
    lines.push(`- Files: ${fileSet.size}`)
    lines.push(`- Lines of code: ${totalLoc.toLocaleString("en-US")}`)
    lines.push(`- Doc-coverage: ${input.docCoverage.percent}% (${input.docCoverage.documented}/${input.docCoverage.total})${mdSev(input.docCoverage.severity)}`)
    lines.push(`- Coupling: Ca=${m.ca} · Ce=${m.ce}`)
    lines.push(`- Martin: ${martinLine}`)
    lines.push(`- Cycles touching: ${input.cyclesTouching}${mdSev(cycleSev)}`)
    return lines.join("\n") + "\n"
}
