/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  themed HTML rendering for the arch-report pipeline,
    with client-side Mermaid SVG and the B/W + #a01441 accent palette  */

import type { ApiJson, Cluster, ArchSymbol } from "../types.js"
import { THEME, MERMAID_THEME_VARIABLES } from "../theme.js"

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
.diagram-frame:active {
    cursor: grabbing;
}
.diagram-frame .mermaid {
    margin: 0;
    padding: 0.5rem;
    min-width: max-content;
}
.diagram-hint {
    text-align: right;
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin: 0 0 1rem 0;
    user-select: none;
}
footer {
    margin-top: 2.5rem;
    padding-top: 0.75rem;
    border-top: 2px solid var(--accent);
    font-size: 0.85rem;
    color: var(--fg-muted);
    text-align: center;
}
.doc-debt { font-size: 0.8rem; }
.doc-debt code { font-size: 0.85em; }
.back-link { font-size: 0.85rem; margin: 0 0 0.5rem 0; }
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

/*  HTML-escape Mermaid diagram source before embedding into the page:
    raw `<<interface>>` tokens, generics with `<` / `>`, and bare `&`
    would otherwise be parsed by the browser as malformed HTML and the
    Mermaid runtime — which reads `.textContent` after browser parsing —
    would receive a corrupted diagram source and fail with a "Parse
    error" pointing at the resulting orphan tag fragment  */
const escapeHtml = (s: string): string => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

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

const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")

const classDiagramSrc = (cluster: Cluster): string => {
    /*  The class diagram complements — not duplicates — the per-symbol
        method tables rendered below the diagram.  Emit each class as a
        body-less declaration (or as the bare `<<interface>>` stereotype
        for interfaces) plus the inheritance and call-reference edges
        between them, so the diagram conveys the *relationships* between
        classes instead of re-listing methods that already appear in
        the tabular section.  Reference edges are limited to in-cluster
        targets to keep each per-cluster page focussed.  */
    const clusterIds = new Set(cluster.symbols.map((s) => safeId(s.name)))
    const lines: string[] = [ "classDiagram" ]
    for (const s of cluster.symbols) {
        if (s.kind === "interface") {
            lines.push(`    class ${safeId(s.name)} {`)
            lines.push("        <<interface>>")
            lines.push("    }")
        }
        else
            lines.push(`    class ${safeId(s.name)}`)
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

const flowchartSrc = (api: ApiJson): string => {
    const lines: string[] = [ "flowchart LR" ]
    for (const c of api.clusters)
        lines.push(`    ${safeId(c.name)}["${c.name}<br/>${c.symbols.length} symbols"]`)
    for (const e of api.edges)
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
    return lines.join("\n")
}

const symTable = (s: ArchSymbol): string => {
    if (s.members.length === 0)
        return `<h3><code>${escapeHtml(s.name)}</code> (${s.kind})</h3><p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p><p><em>no public members</em></p>`
    const rows = s.members.map((m) =>
        `<tr><td><code>${escapeHtml(m.name)}</code></td><td><code>${escapeHtml(m.signature)}</code></td><td>${m.doc !== null ? escapeHtml(m.doc) : "<em>no description</em>"}</td></tr>`).join("\n")
    return `<h3><code>${escapeHtml(s.name)}</code> (${s.kind})</h3>
<p>${s.doc !== null ? escapeHtml(s.doc) : "<em>no description</em>"}</p>
<table><thead><tr><th>Method</th><th>Signature</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

export const renderClusterHtml = (cluster: Cluster, api: ApiJson): string => {
    const clusterFqns = new Set(cluster.symbols.map((s) => s.fqn))
    const clusterDebt = api.docDebt.filter((d) =>
        clusterFqns.has(d.fqn.split("#")[0]))
    const debtSection = `<section class="doc-debt"><h2>Documentation debt</h2>
${clusterDebt.length === 0 ?
    "<p><em>none — every public symbol in this cluster carries a doc comment</em></p>" :
    `<ul>${clusterDebt.map((d) => `<li><code>${escapeHtml(d.fqn)}</code> (${escapeHtml(d.file)}:${d.line})</li>`).join("")}</ul>`}</section>`
    const body = `<p class="back-link"><a href="./index.html">← back to index</a></p>
<h1>Cluster: <code>${cluster.name}</code> (${cluster.language})</h1>
${frame(classDiagramSrc(cluster))}
<h2>Symbols</h2>
${cluster.symbols.map(symTable).join("\n")}
${debtSection}`
    return wrap(`arch-report — ${cluster.name}`, body, api.generatedAt)
}

export const renderIndexHtml = (api: ApiJson): string => {
    const body = `<h1>Architecture Report</h1>
<p>Scope: <code>${api.scope}</code><br>
Generated: ${api.generatedAt}<br>
Languages: ${api.languages.join(", ")}</p>
<p><em>Coverage: public and protected API only. Private and package-private members are intentionally excluded.</em></p>
<h2>Clusters</h2>
${frame(flowchartSrc(api))}
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
