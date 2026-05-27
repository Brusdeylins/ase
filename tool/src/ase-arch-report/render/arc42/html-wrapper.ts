/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Single-page HTML wrapper for the arc42 report.  Embeds CSS and the
    client-side Mermaid bootstrap so the produced index.html is fully
    self-contained (no external CSS, no images folder).  Adds a 12-anchor
    table of contents at the top.  */

import { THEME, MERMAID_THEME_VARIABLES } from "../../theme.js"
import { strings, type Lang }             from "./strings.js"

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
h1 { border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; margin-top: 2.5rem; }
h1:first-of-type { margin-top: 0; }
h2 { margin-top: 1.8rem; color: var(--fg); }
h3 { margin-top: 1.2rem; color: var(--fg); }
.arc42-help { background: var(--subtle); border-left: 3px solid var(--border); padding: 0.6rem 0.9rem; margin: 0.6rem 0 1rem 0; font-size: 0.9rem; color: var(--fg-muted); }
.arc42-help p:first-child { margin-top: 0; }
.arc42-help p:last-child { margin-bottom: 0; }
.derived { border-top: 2px dashed var(--accent); margin-top: 1.5rem; padding-top: 0.5rem; }
.derived > h3:first-child { margin-top: 0.4rem; color: var(--accent); }
.diagram-frame {
    margin: 1.5rem 0 0.25rem 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: auto;
    min-height: 250px;
    max-height: 80vh;
    background: var(--bg);
    cursor: grab;
}
.diagram-frame:active { cursor: grabbing; }
.diagram-frame .mermaid { margin: 0; padding: 0.5rem; min-width: max-content; }
.diagram-hint { text-align: right; font-size: 0.75rem; color: var(--fg-muted); margin: 0 0 1rem 0; user-select: none; }
.diagram-frame .mermaid svg g.cluster > rect { fill: #f0f0f0 !important; stroke: var(--border) !important; }
.diagram-frame .mermaid svg g.cluster[id$="externals_scope"] > rect { fill: #c8c8c8 !important; }
footer { margin-top: 2.5rem; padding-top: 0.75rem; border-top: 2px solid var(--accent); font-size: 0.85rem; color: var(--fg-muted); text-align: center; }
.toc { background: var(--subtle); border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem 1rem; margin: 1rem 0 2rem 0; }
.toc ol { margin: 0.25rem 0 0 0; padding-left: 1.5rem; }
.toc li { margin: 0.15rem 0; }
.shortlist h3 { margin-top: 1.2rem; margin-bottom: 0.4rem; font-size: 1rem; }
.shortlist-list { padding-left: 1.2rem; }
.shortlist-list li { margin-bottom: 0.5rem; }
.shortlist-detail { color: var(--fg-muted); font-size: 0.85em; }
.dsm-wrap { overflow: auto; margin: 1rem 0; }
table.dsm { table-layout: auto; width: auto; font-size: 0.75rem; border-collapse: collapse; }
table.dsm th, table.dsm td { border: 1px solid var(--border); padding: 0.2rem 0.35rem; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal; white-space: nowrap; }
table.dsm th.dsm-col { writing-mode: vertical-rl; transform: rotate(180deg); max-height: 10rem; background: var(--subtle); font-weight: 500; }
table.dsm th.dsm-row { text-align: right; background: var(--subtle); font-weight: 500; }
table.dsm th.dsm-corner { background: transparent; border: none; }
table.dsm td.dsm-diag  { background: var(--border); }
table.dsm td.dsm-cycle { background: rgba(160, 20, 65, 0.18); font-weight: 600; }
.cycle-list code { background: transparent; padding: 0; }
.sym { margin: 1rem 0; }
.sym .vis-badge { display: inline-block; font-size: 0.7rem; font-weight: normal; padding: 0 0.3rem; border-radius: 3px; margin-left: 0.25rem; vertical-align: middle; }
.sym .vis-badge.vis-private { color: var(--accent); border: 1px solid var(--accent); }
.sym .vis-badge.vis-protected { color: #b27d00; border: 1px solid #b27d00; }
.sym .metric-badge { display: inline-block; font-size: 0.7rem; font-weight: normal; color: var(--fg-muted); border: 1px solid var(--border); border-radius: 3px; padding: 0 0.3rem; margin-left: 0.25rem; vertical-align: middle; }
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
            const frame = svg.closest(".diagram-frame")
            if (frame !== null)
                frame.addEventListener("wheel", (e) => e.preventDefault(), { passive: false })
        }
    }
</script>
`

const CHAPTER_TITLES_EN = [
    "Introduction and Goals",
    "Architecture Constraints",
    "Context and Scope",
    "Solution Strategy",
    "Building Block View",
    "Runtime View",
    "Deployment View",
    "Crosscutting Concepts",
    "Architecture Decisions",
    "Quality Requirements",
    "Risks and Technical Debt",
    "Glossary"
]

const CHAPTER_TITLES_DE = [
    "Einführung und Ziele",
    "Randbedingungen",
    "Kontextabgrenzung",
    "Lösungsstrategie",
    "Bausteinsicht",
    "Laufzeitsicht",
    "Verteilungssicht",
    "Querschnittliche Konzepte",
    "Architekturentscheidungen",
    "Qualitätsanforderungen",
    "Risiken und Technische Schulden",
    "Glossar"
]

export const chapterTitles = (lang: Lang): string[] =>
    lang === "de" ? CHAPTER_TITLES_DE : CHAPTER_TITLES_EN

export const renderToc = (lang: Lang, fmt: "md" | "html"): string => {
    const titles = chapterTitles(lang)
    const s      = strings[lang]
    if (fmt === "md") {
        const lines = titles.map((t, i) =>
            `${i + 1}. [${i + 1}. ${t}](#${i + 1}-${slugify(t)})`)
        return `## ${s.tableOfContents}\n\n${lines.join("\n")}\n`
    }
    const lis = titles.map((t, i) =>
        `<li><a href="#${anchorId(i + 1, t)}">${i + 1}. ${escapeHtml(t)}</a></li>`)
    return `<nav class="toc"><strong>${escapeHtml(s.tableOfContents)}</strong><ol>${lis.join("")}</ol></nav>`
}

export const wrapHtml = (lang: Lang, title: string, body: string, generatedAt: string): string => {
    const s = strings[lang]
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p><em>${s.generatedAt}: ${escapeHtml(generatedAt.slice(0, 10))}</em></p>
${renderToc(lang, "html")}
${body}
<footer>${s.footerCreatedWith} <a href="https://github.com/rse/ase">ASE</a> · arc42</footer>
</main>
${mermaidBootstrap}
</body>
</html>`
}

const slugify = (s: string): string =>
    s.toLowerCase()
        .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

export const anchorId = (chapterNum: number, title: string): string =>
    `ch${chapterNum}-${slugify(title)}`

export const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
