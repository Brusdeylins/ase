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
import { escapeHtml, safeId, filterClusterDocDebt } from "./util.js"
import type { RenderContext }                from "./context.js"
import { topClusterHubs }                    from "../metrics/hubs.js"
import { indexStatsPanelHtml, clusterStatsPanelHtml } from "./stats-panel.js"
import { dsmHtml }                           from "./dsm.js"
import { cyclesHtml, cyclesTouchingCluster } from "./cycles.js"
import { mainSequenceMermaid }               from "./main-sequence.js"
import { buildClassDiagram }                 from "./class-diagram.js"
import { buildLayeredFlowchart }             from "./flowchart.js"

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
.sym.nested { margin-left: 2rem; border-left: 2px solid var(--border); padding-left: 0.75rem; }
.sym.nested h3 { font-size: 1em; }
.sym .nested-hint { font-size: 0.8rem; color: var(--fg-muted); font-weight: normal; }
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
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.esm.min.mjs"
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

/*  classDiagram and flowchart Mermaid source builders moved to
    ./class-diagram.ts and ./flowchart.ts so the Markdown
    renderer can reuse them without duplicating the emission +
    quirk-workaround logic.  */

const symTable = (s: ArchSymbol): string => {
    /*  Nested types render with a visible indent + parent hint so
        the reader sees the structural relationship at a glance and
        does not look for a non-existent `<Inner>.java` file.  The
        wrapper carries the `nested` class only when applicable;
        top-level symbols stay visually identical to before.  */
    const wrapClass = s.enclosingFqn !== null ? "sym nested" : "sym"
    const hint      = s.enclosingFqn !== null ?
        ` <span class="nested-hint">(nested in <code>${escapeHtml(s.enclosingFqn)}</code>)</span>` : ""
    const header    = `<h3><code>${escapeHtml(s.name)}</code> (${s.kind} · ${s.loc} LOC · ${s.members.length} methods)${hint}</h3>`
    if (s.members.length === 0) {
        const empty = s.enclosingFqn !== null ? "no members" : "no public members"
        return `<div class="${wrapClass}">${header}<p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p><p><em>${empty}</em></p></div>`
    }
    const rows = s.members.map((m) =>
        `<tr><td><code>${escapeHtml(m.name)}</code></td><td><code>${escapeHtml(m.signature)}</code></td><td>${m.doc !== null ? escapeHtml(m.doc) : "<em>no description</em>"}</td></tr>`).join("\n")
    return `<div class="${wrapClass}">${header}
<p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p>
<table><thead><tr><th>Method</th><th>Signature</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table></div>`
}

/*  Sort cluster symbols so each top-level type is immediately
    followed by its nested children (recursively).  Children of
    one parent stay alphabetical; siblings at every depth do too.
    Returns a flat array — the renderer keeps emitting `symTable`
    per entry, no extra grouping logic needed downstream.  */
const orderSymbolsHierarchically = (symbols: ArchSymbol[]): ArchSymbol[] => {
    const byParent = new Map<string | null, ArchSymbol[]>()
    for (const s of symbols) {
        const arr = byParent.get(s.enclosingFqn) ?? []
        arr.push(s)
        byParent.set(s.enclosingFqn, arr)
    }
    for (const arr of byParent.values())
        arr.sort((a, b) => a.fqn.localeCompare(b.fqn))
    const out: ArchSymbol[] = []
    const visit = (parentFqn: string | null): void => {
        for (const s of byParent.get(parentFqn) ?? []) {
            out.push(s)
            visit(s.fqn)
        }
    }
    visit(null)
    /*  defensive: a symbol whose enclosingFqn points outside this
        cluster's symbol set would never be reached by the walk
        above.  Append in original order so nothing silently
        disappears from the per-cluster page.  */
    if (out.length < symbols.length) {
        const seen = new Set(out.map((s) => s.fqn))
        for (const s of symbols)
            if (!seen.has(s.fqn))
                out.push(s)
    }
    return out
}

export const renderClusterHtml = (cluster: Cluster, api: ApiJson, ctx: RenderContext): string => {
    const clusterDebt = filterClusterDocDebt(api, cluster)
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
${frame(buildClassDiagram(cluster, ctx.allInScopeSymbols))}
<h2>Symbols</h2>
${orderSymbolsHierarchically(cluster.symbols).map(symTable).join("\n")}
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
<p><em>Coverage: top-level types show only their public and protected members. Nested (inner) types appear regardless of visibility and expose their <strong>full</strong> member list — private helpers included — because a nested type's entire purpose is to be internal to the enclosing scope, and filtering its members would leave the reader with an empty shell. Private and package-private members of top-level types remain excluded.</em></p>
${stats}
<h2>Cluster dependencies</h2>
${frame(buildLayeredFlowchart(api, ctx.layerOfCluster))}
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
