/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  themed HTML rendering for the arch-report pipeline,
    with client-side Mermaid SVG and the B/W + #a01441 accent palette  */

import type { ApiJson, Cluster, ArchSymbol } from "./types.js"
import { THEME, MERMAID_THEME_VARIABLES } from "./theme.js"

const css = `
:root {
    --bg:       ${THEME.bg};
    --fg:       ${THEME.fg};
    --fg-muted: ${THEME.fgMuted};
    --border:   ${THEME.border};
    --subtle:   ${THEME.subtle};
    --accent:   ${THEME.accent};
}
body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; max-width: 1024px; margin: 2rem auto; padding: 0 1rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
th { background: var(--subtle); font-weight: 600; }
code { background: var(--subtle); padding: 0.1rem 0.3rem; border-radius: 3px; }
h1 { border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }
.mermaid { margin: 1.5rem 0; }
`

const mermaidBootstrap = `
<script type="module" id="mermaid-bootstrap">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"
    mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: ${JSON.stringify(MERMAID_THEME_VARIABLES)} })
</script>
`

const wrap = (title: string, body: string): string =>
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${body}
${mermaidBootstrap}
</body>
</html>`

const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")

const classDiagramSrc = (cluster: Cluster): string => {
    const lines: string[] = [ "classDiagram" ]
    for (const s of cluster.symbols) {
        lines.push(`    class ${safeId(s.name)} {`)
        if (s.kind === "interface")
            lines.push("        <<interface>>")
        for (const m of s.members)
            lines.push(`        ${m.signature}`)
        lines.push("    }")
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
        return `<h3><code>${s.name}</code> (${s.kind})</h3><p>${s.doc ?? "<em>no description</em>"}</p><p><em>no public members</em></p>`
    const rows = s.members.map((m) =>
        `<tr><td><code>${m.name}</code></td><td><code>${m.signature}</code></td><td>${m.doc ?? "<em>no description</em>"}</td></tr>`).join("\n")
    return `<h3><code>${s.name}</code> (${s.kind})</h3>
<p>${s.doc ?? "<em>no description</em>"}</p>
<table><thead><tr><th>Method</th><th>Signature</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

export const renderClusterHtml = (cluster: Cluster, _api: ApiJson): string => {
    const body = `<h1>Cluster: <code>${cluster.name}</code> (${cluster.language})</h1>
<div class="mermaid">${classDiagramSrc(cluster)}</div>
<h2>Symbols</h2>
${cluster.symbols.map(symTable).join("\n")}`
    return wrap(`arch-report — ${cluster.name}`, body)
}

export const renderIndexHtml = (api: ApiJson): string => {
    const body = `<h1>Architecture Report</h1>
<p>Scope: <code>${api.scope}</code><br>
Generated: ${api.generatedAt}<br>
Languages: ${api.languages.join(", ")}</p>
<h2>Clusters</h2>
<div class="mermaid">${flowchartSrc(api)}</div>
<h2>Per-cluster pages</h2>
<ul>
${api.clusters.map((c) => `<li><a href="./${safeId(c.name)}.html"><code>${c.name}</code></a> — ${c.symbols.length} symbols</li>`).join("\n")}
</ul>
<h2>Documentation debt</h2>
${api.docDebt.length === 0 ?
    "<p><em>none — every public symbol carries a doc comment</em></p>" :
    `<ul>${api.docDebt.map((d) => `<li><code>${d.fqn}</code> (${d.file}:${d.line})</li>`).join("")}</ul>`}`
    return wrap("arch-report — index", body)
}
