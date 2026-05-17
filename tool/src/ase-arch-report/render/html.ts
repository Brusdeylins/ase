/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  themed HTML rendering for the arch-report pipeline,
    with client-side Mermaid SVG and the B/W + #a01441 accent palette  */

import type { ApiJson, Cluster, ArchSymbol } from "../types.js"
import { THEME, MERMAID_THEME_VARIABLES }    from "../theme.js"
import { escapeHtml, safeId }                from "./util.js"
import type { RenderContext }                from "./context.js"
import { topClusterHubs }                    from "../metrics/hubs.js"
import { indexStatsPanelHtml, clusterStatsPanelHtml } from "./stats-panel.js"
import { dsmHtml }                           from "./dsm.js"
import { cyclesHtml, cyclesTouchingCluster } from "./cycles.js"
import { mainSequenceMermaid }               from "./main-sequence.js"
import { classFanInIntraCluster }            from "../metrics/hubs.js"

const css = `
:root {
    --bg:       ${THEME.bg};
    --fg:       ${THEME.fg};
    --fg-muted: ${THEME.fgMuted};
    --border:   ${THEME.border};
    --subtle:   ${THEME.subtle};
    --accent:   ${THEME.accent};
}
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
body { font-family: system-ui, sans-serif; }
main { max-width: 1024px; margin: 2rem auto; padding: 0 1rem; box-sizing: border-box; }
main > * { box-sizing: border-box; max-width: 100%; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; table-layout: fixed; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
th { background: var(--subtle); font-weight: 600; }
code { background: var(--subtle); padding: 0.1rem 0.3rem; border-radius: 3px; word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
h1 { border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }
.diagram-frame {
    margin: 1.5rem 0 0.25rem 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: auto;
    min-height: 400px;
    max-height: 80vh;
    background: var(--bg);
    cursor: grab;
}
.diagram-frame:active { cursor: grabbing; }
.diagram-frame .mermaid { margin: 0; padding: 0.5rem; min-width: max-content; }
.diagram-hint { text-align: right; font-size: 0.75rem; color: var(--fg-muted); margin: 0 0 1rem 0; user-select: none; }
footer { margin-top: 2.5rem; padding-top: 0.75rem; border-top: 2px solid var(--accent); font-size: 0.85rem; color: var(--fg-muted); text-align: center; }
.doc-debt { font-size: 0.8rem; }
.doc-debt code { font-size: 0.85em; }
.back-link { font-size: 0.85rem; margin: 0 0 0.5rem 0; }
.stats-panel { background: var(--subtle); border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem 1rem; margin: 1rem 0; font-size: 0.9rem; }
.stats-panel dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; }
.stats-panel dt { font-weight: 600; color: var(--fg-muted); }
.stats-panel dd { margin: 0; }
.sev-green  { color: #1b7f3b; font-weight: 600; }
.sev-yellow { color: #b27d00; font-weight: 600; }
.sev-red    { color: var(--accent); font-weight: 600; }
.dsm-wrap { overflow: auto; margin: 1rem 0; }
table.dsm { table-layout: auto; width: auto; font-size: 0.75rem; border-collapse: collapse; }
table.dsm th, table.dsm td { border: 1px solid var(--border); padding: 0.2rem 0.35rem; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal; white-space: nowrap; }
table.dsm th.dsm-col { writing-mode: vertical-rl; transform: rotate(180deg); max-height: 10rem; background: var(--subtle); font-weight: 500; }
table.dsm th.dsm-row { text-align: right; background: var(--subtle); font-weight: 500; }
table.dsm th.dsm-corner { background: transparent; border: none; }
table.dsm td.dsm-diag  { background: var(--border); }
table.dsm td.dsm-cycle { background: rgba(160, 20, 65, 0.18); font-weight: 600; }
.cycles ol { padding-left: 1.5rem; }
.cycle-list code { background: transparent; padding: 0; }
`

const mermaidBootstrap = `
<script src="https://unpkg.com/panzoom@9.4.3/dist/panzoom.min.js"></script>
<script type="module" id="mermaid-bootstrap">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"
    mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: ${JSON.stringify(MERMAID_THEME_VARIABLES)}, maxTextSize: 5000000, maxEdges: 10000 })
    await mermaid.run({ querySelector: ".mermaid" })
    if (typeof window.panzoom === "function") {
        for (const svg of document.querySelectorAll(".diagram-frame svg")) {
            window.panzoom(svg, { maxZoom: 8, minZoom: 0.25, bounds: true, boundsPadding: 0.1, smoothScroll: false })
            /*  prevent the page from scrolling on wheel-over-SVG by
                capturing wheel events on the diagram-frame container
                with a non-passive listener (Chrome's default passive
                wheel listeners block preventDefault inside panzoom)  */
            const frame = svg.closest(".diagram-frame")
            if (frame !== null)
                frame.addEventListener("wheel", (e) => e.preventDefault(), { passive: false })
        }
    }
    else {
        console.warn("ase-arch-report: panzoom global not available — pan/zoom disabled")
    }
</script>
`

const frame = (src: string): string => `<div class="diagram-frame">
<div class="mermaid">${escapeHtml(src)}</div>
</div>
<div class="diagram-hint">drag to pan · wheel to zoom</div>`

const wrap = (title: string, body: string, generatedAt: string): string =>
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<main>
${body}
<footer>created with <a href="https://github.com/rse/ase">ASE Skill</a> at ${generatedAt.slice(0, 10)}</footer>
</main>
${mermaidBootstrap}
</body>
</html>`

const HUB_FAN_IN_THRESHOLD = 3

const classDiagramSrc = (cluster: Cluster): string => {
    /*  The class diagram complements — not duplicates — the per-symbol
        method tables rendered below the diagram.  Emit each class as a
        body-less declaration (or as the bare `<<interface>>` stereotype
        for interfaces) plus the inheritance and call-reference edges
        between them, so the diagram conveys the *relationships* between
        classes instead of re-listing methods that already appear in
        the tabular section.  Reference edges are limited to in-cluster
        targets to keep each per-cluster page focussed.  Classes whose
        intra-cluster fan-in reaches the hub threshold get the accent
        `hub` style applied via the well-supported `:::hub` inline
        syntax (the standalone `classDef` + `cssClass` form breaks
        Mermaid v10's classDiagram parser when the style payload
        contains comma-separated CSS properties).  */
    const clusterIds = new Set(cluster.symbols.map((s) => safeId(s.name)))
    const fanIn      = classFanInIntraCluster(cluster)
    const isHub      = (name: string): boolean =>
        (fanIn.get(name) ?? 0) >= HUB_FAN_IN_THRESHOLD
    const hubSuffix  = (name: string): string =>
        isHub(name) ? ":::hub" : ""
    const hasAnyHub  = cluster.symbols.some((s) => isHub(s.name))
    const lines: string[] = [ "classDiagram" ]
    if (hasAnyHub)
        lines.push("    classDef hub fill:#fbe6ec,stroke:#a01441,stroke-width:3px")
    for (const s of cluster.symbols) {
        const idWithStyle = `${safeId(s.name)}${hubSuffix(s.name)}`
        if (s.kind === "interface") {
            lines.push(`    class ${idWithStyle} {`)
            lines.push("        <<interface>>")
            lines.push("    }")
        }
        else
            lines.push(`    class ${idWithStyle}`)
        const heritageIds = new Set([
            ...s.extends.map((e) => safeId(e)),
            ...s.implements.map((i) => safeId(i))
        ])
        for (const parent of s.extends)
            lines.push(`    ${safeId(parent)} <|-- ${safeId(s.name)}`)
        for (const iface of s.implements)
            lines.push(`    ${safeId(iface)} <|.. ${safeId(s.name)}`)
        const fromId = safeId(s.name)
        for (const r of s.references) {
            const refId = safeId(r)
            if (refId !== fromId && clusterIds.has(refId) && !heritageIds.has(refId))
                lines.push(`    ${fromId} ..> ${refId}`)
        }
    }
    return lines.join("\n")
}

const flowchartSrc = (api: ApiJson, layerOfCluster: Map<string, number>): string => {
    /*  Layered top-down flowchart: cluster nodes are grouped into
        `subgraph` blocks per topological layer, sources on top,
        leaves on the bottom.  This makes the dependency direction
        readable at a glance and gives cycle groups (equal-rank
        layer) a clear visual cluster.  */
    const lines: string[] = [ "flowchart TD" ]
    const byLayer = new Map<number, string[]>()
    for (const c of api.clusters) {
        const layer = layerOfCluster.get(c.name) ?? 0
        const arr = byLayer.get(layer) ?? []
        arr.push(c.name)
        byLayer.set(layer, arr)
    }
    const sortedLayers = [ ...byLayer.keys() ].sort((a, b) => a - b)
    const symCount = new Map(api.clusters.map((c) => [ c.name, c.symbols.length ]))
    for (const layer of sortedLayers) {
        lines.push(`    subgraph layer${layer}["Layer ${layer}"]`)
        for (const name of byLayer.get(layer)!.sort())
            lines.push(`        ${safeId(name)}["${name}<br/>${symCount.get(name) ?? 0} symbols"]`)
        lines.push("    end")
    }
    for (const e of api.edges)
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
    return lines.join("\n")
}

const symTable = (s: ArchSymbol): string => {
    const header = `<h3><code>${escapeHtml(s.name)}</code> (${s.kind} · ${s.loc} LOC · ${s.members.length} methods)</h3>`
    if (s.members.length === 0)
        return `${header}<p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p><p><em>no public members</em></p>`
    const rows = s.members.map((m) =>
        `<tr><td><code>${escapeHtml(m.name)}</code></td><td><code>${escapeHtml(m.signature)}</code></td><td>${m.doc !== null ? escapeHtml(m.doc) : "<em>no description</em>"}</td></tr>`).join("\n")
    return `${header}
<p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p>
<table><thead><tr><th>Method</th><th>Signature</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

export const renderClusterHtml = (cluster: Cluster, api: ApiJson, ctx: RenderContext): string => {
    const clusterFqns = new Set(cluster.symbols.map((s) => s.fqn))
    const clusterDebt = api.docDebt.filter((d) =>
        clusterFqns.has(d.fqn.split("#")[0]))
    const debtSection = `<section class="doc-debt"><h2>Documentation debt</h2>
${clusterDebt.length === 0 ?
    "<p><em>none — every public symbol in this cluster carries a doc comment</em></p>" :
    `<ul>${clusterDebt.map((d) => `<li><code>${escapeHtml(d.fqn)}</code> (${escapeHtml(d.file)}:${d.line})</li>`).join("")}</ul>`}</section>`
    const stats = clusterStatsPanelHtml({
        cluster,
        coupling:       ctx.coupling.get(cluster.name) ?? { ca: 0, ce: 0 },
        martin:         ctx.martin.get(cluster.name)!,
        docCoverage:    ctx.docCovPerCluster.get(cluster.name)!,
        cyclesTouching: cyclesTouchingCluster(ctx.cycleReport, cluster)
    })
    const body = `<p class="back-link"><a href="./index.html">← back to index</a></p>
<h1>Cluster: <code>${cluster.name}</code> (${cluster.language})</h1>
${stats}
<h2>Class relationships</h2>
${frame(classDiagramSrc(cluster))}
<h2>Symbols</h2>
${cluster.symbols.map(symTable).join("\n")}
${debtSection}`
    return wrap(`arch-report — ${cluster.name}`, body, api.generatedAt)
}

export const renderIndexHtml = (api: ApiJson, ctx: RenderContext): string => {
    const mainSeq = mainSequenceMermaid(api.clusters, ctx.martin)
    const mainSeqSection = mainSeq === "" ? "" :
        `<h2>Martin Main Sequence</h2>\n${frame(mainSeq)}`
    const stats = indexStatsPanelHtml({
        api,
        cycleCount:  ctx.cycleReport.cycles.length,
        docCoverage: ctx.docCovAggregate,
        topFanIn:    topClusterHubs(ctx.coupling, 3, "ca"),
        topFanOut:   topClusterHubs(ctx.coupling, 3, "ce"),
        totalLoc:    ctx.totalLoc
    })
    const body = `<h1>Architecture Report</h1>
<p>Scope: <code>${escapeHtml(api.scope)}</code><br>
Generated: ${api.generatedAt}<br>
Languages: ${api.languages.join(", ")}</p>
<p><em>Coverage: public and protected API only. Private and package-private members are intentionally excluded.</em></p>
${stats}
<h2>Cluster dependencies</h2>
${frame(flowchartSrc(api, ctx.layerOfCluster))}
${cyclesHtml(ctx.cycleReport)}
<h2>Dependency Structure Matrix</h2>
${dsmHtml(api, ctx.sortedClusterNames)}
${mainSeqSection}
<h2>Per-cluster pages</h2>
<ul>
${api.clusters.map((c) => `<li><a href="./${safeId(c.name)}.html"><code>${c.name}</code></a> — ${c.symbols.length} symbols</li>`).join("\n")}
</ul>
<section class="doc-debt"><h2>Documentation debt</h2>
${api.docDebt.length === 0 ?
    "<p><em>none — every public symbol carries a doc comment</em></p>" :
    `<ul>${api.docDebt.map((d) => `<li><code>${escapeHtml(d.fqn)}</code> (${escapeHtml(d.file)}:${d.line})</li>`).join("")}</ul>`}</section>`
    return wrap("arch-report — index", body, api.generatedAt)
}
