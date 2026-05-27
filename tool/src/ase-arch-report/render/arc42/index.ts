/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  arc42 orchestrator.  Drives the 12 chapter render-functions in
    order, joins their md/html outputs, and writes a single index.md
    and/or index.html (with a leading H1, a date stamp, and a 12-anchor
    table of contents).  No external assets, no per-chapter files.  */

import fs                              from "node:fs/promises"
import path                            from "node:path"
import type { ApiJson, ArchReportOpts } from "../../types.js"
import type { RenderContext }          from "../context.js"
import type { ProjectMeta }            from "../../project-meta.js"
import { renderAllChapters }           from "./chapters.js"
import { wrapHtml, renderToc }         from "./html-wrapper.js"
import { strings }                     from "./strings.js"

export interface Arc42Result {
    files: string[]
}

const TITLE_EN = "Architecture Documentation"
const TITLE_DE = "Architektur-Dokumentation"

export const renderArc42 = async (
    api:    ApiJson,
    ctx:    RenderContext,
    meta:   ProjectMeta,
    opts:   ArchReportOpts,
    outDir: string
): Promise<Arc42Result> => {
    const lang    = opts.reportLang
    const s       = strings[lang]
    const reportTitle = lang === "de" ? TITLE_DE : TITLE_EN
    const chapters = renderAllChapters({
        api, ctx, meta, lang,
        scope: api.scope
    })
    const files: string[] = []
    if (opts.format === "md" || opts.format === "both") {
        const md = mdHead(reportTitle, api.generatedAt, s.generatedAt) +
            renderToc(lang, "md") +
            chapters.map((c) => c.md).join("\n")
        const target = path.join(outDir, "index.md")
        await fs.writeFile(target, md, "utf8")
        files.push(target)
    }
    if (opts.format === "html" || opts.format === "both") {
        const body = chapters.map((c) => c.html).join("\n")
        const html = wrapHtml(lang, reportTitle, body, api.generatedAt)
        const target = path.join(outDir, "index.html")
        await fs.writeFile(target, html, "utf8")
        files.push(target)
    }
    return { files }
}

const mdHead = (title: string, generatedAt: string, generatedAtLabel: string): string =>
    `# ${title}\n\n*${generatedAtLabel}: ${generatedAt.slice(0, 10)}*\n\n`
