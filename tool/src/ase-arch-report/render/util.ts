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

export const escapeHtml = (s: string): string => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

export const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")
