/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Index-page "Architectural debt" section.  Renders the
    deterministic shortlist computed by metrics/shortlist.ts as a
    short grouped list — one bullet per finding, grouped by kind
    so the architect scans by category (god-packages first, then
    high-distance clusters, then fragments, then fat interfaces).
    Each bullet links the offending cluster page where it makes
    sense, so the reader can drill in with a click.  Severity
    drives a coloured chip prefix so HIGH findings dominate the
    visual hierarchy of the section.  */

import type { ShortlistFinding, ShortlistKind } from "../metrics/shortlist.js"
import { escapeHtml, safeId }                   from "./util.js"

const KIND_LABEL: Record<ShortlistKind, string> = {
    "high-distance": "High Martin distance",
    "god-package":   "God-package",
    "fragment":      "Fragment cluster",
    "interface-fat": "Fat interface"
}

const KIND_ORDER: ShortlistKind[] =
    [ "god-package", "high-distance", "interface-fat", "fragment" ]

const groupFindings = (
    findings: ShortlistFinding[]
): Map<ShortlistKind, ShortlistFinding[]> => {
    const out = new Map<ShortlistKind, ShortlistFinding[]>()
    for (const k of KIND_ORDER)
        out.set(k, [])
    for (const f of findings)
        out.get(f.kind)!.push(f)
    return out
}

/*  Render the cluster portion of `target`; interface-fat targets
    encode "cluster::ClassFqn", every other kind is just a cluster
    name.  Returns the cluster part separately so the renderer can
    link to the cluster page.  */
const splitTarget = (target: string): { cluster: string; symbol: string | null } => {
    const idx = target.indexOf("::")
    if (idx === -1)
        return { cluster: target, symbol: null }
    return { cluster: target.slice(0, idx), symbol: target.slice(idx + 2) }
}

export const shortlistHtml = (findings: ShortlistFinding[]): string => {
    if (findings.length === 0)
        return "<section class=\"shortlist\"><h2>Architectural debt</h2><p class=\"sev-green\">no shortlist findings — every cluster sits within the configured thresholds for Martin distance, coupling shape, fragment size, and interface fat</p></section>"
    const groups = groupFindings(findings)
    const renderFinding = (f: ShortlistFinding): string => {
        const t      = splitTarget(f.target)
        const link   = `<a href="./${safeId(t.cluster)}.html"><code>${escapeHtml(t.cluster)}</code></a>`
        const symbol = t.symbol !== null ? ` &rarr; <code>${escapeHtml(t.symbol)}</code>` : ""
        let sev = "sev-green"
        if (f.severity === "high")
            sev = "sev-red"
        else if (f.severity === "medium")
            sev = "sev-yellow"
        return `<li><strong class="${sev}">[${f.severity.toUpperCase()}]</strong> ${link}${symbol} &mdash; <em>${escapeHtml(f.metric)}</em><br><span class="shortlist-detail">${escapeHtml(f.detail)}</span></li>`
    }
    const sections: string[] = []
    for (const k of KIND_ORDER) {
        const list = groups.get(k)!
        if (list.length === 0)
            continue
        sections.push(`<h3>${KIND_LABEL[k]} (${list.length})</h3>
<ul class="shortlist-list">
${list.map(renderFinding).join("\n")}
</ul>`)
    }
    return `<section class="shortlist"><h2>Architectural debt</h2>
${sections.join("\n")}
</section>`
}

export const shortlistMd = (findings: ShortlistFinding[]): string => {
    if (findings.length === 0)
        return "## Architectural debt\n\n_no shortlist findings — every cluster sits within the configured thresholds for Martin distance, coupling shape, fragment size, and interface fat_ ✓\n"
    const groups = groupFindings(findings)
    const lines: string[] = []
    lines.push("## Architectural debt\n")
    for (const k of KIND_ORDER) {
        const list = groups.get(k)!
        if (list.length === 0)
            continue
        lines.push(`### ${KIND_LABEL[k]} (${list.length})\n`)
        for (const f of list) {
            const t = splitTarget(f.target)
            let sevBadge = "[•]"
            if (f.severity === "high")
                sevBadge = "[!]"
            else if (f.severity === "medium")
                sevBadge = "[~]"
            const symbol = t.symbol !== null ? ` &rarr; \`${t.symbol}\`` : ""
            lines.push(`- ${sevBadge} \`${t.cluster}\`${symbol} — _${f.metric}_  `)
            lines.push(`  ${f.detail}`)
        }
        lines.push("")
    }
    return lines.join("\n") + "\n"
}
