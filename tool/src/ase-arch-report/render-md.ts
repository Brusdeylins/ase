/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Markdown rendering for the arch-report pipeline  */

import type { ApiJson, Cluster, ArchSymbol } from "./types.js"
import { mermaidSafeSignature } from "./mermaid.js"

const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")

const mermaidClassDiagram = (cluster: Cluster): string => {
    const lines: string[] = [ "```mermaid", "classDiagram" ]
    for (const s of cluster.symbols) {
        const kindTag = s.kind === "interface" ? "<<interface>>" : ""
        lines.push(`    class ${safeId(s.name)} {`)
        if (kindTag !== "")
            lines.push(`        ${kindTag}`)
        for (const m of s.members)
            lines.push(`        ${mermaidSafeSignature(m.signature)}`)
        lines.push("    }")
        for (const parent of s.extends)
            lines.push(`    ${safeId(parent)} <|-- ${safeId(s.name)}`)
        for (const iface of s.implements)
            lines.push(`    ${safeId(iface)} <|.. ${safeId(s.name)}`)
    }
    lines.push("```")
    return lines.join("\n")
}

const apiTable = (s: ArchSymbol): string => {
    const head = `### \`${s.name}\` (${s.kind})\n\n${s.doc ?? "_(no description)_"}\n\n`
    if (s.members.length === 0)
        return head + "_no public members_\n"
    const rows = s.members.map((m) =>
        `| \`${m.name}\` | \`${m.signature}\` | ${m.doc ?? "_(no description)_"} |`).join("\n")
    return head + "| Method | Signature | Description |\n|---|---|---|\n" + rows + "\n"
}

export const renderClusterMd = (cluster: Cluster, _api: ApiJson): string => {
    const parts: string[] = []
    parts.push(`# Cluster: \`${cluster.name}\` (${cluster.language})\n`)
    parts.push(mermaidClassDiagram(cluster))
    parts.push("\n## Symbols\n")
    for (const s of cluster.symbols)
        parts.push(apiTable(s))
    return parts.join("\n")
}

export const renderIndexMd = (api: ApiJson): string => {
    const lines: string[] = []
    lines.push("# Architecture Report\n")
    lines.push(`Scope: \`${api.scope}\`  `)
    lines.push(`Generated: ${api.generatedAt}  `)
    lines.push(`Languages: ${api.languages.join(", ")}\n`)
    lines.push("> Coverage: public and protected API only. Private and package-private members are intentionally excluded.\n")
    lines.push("## Clusters\n")
    lines.push("```mermaid")
    lines.push("flowchart LR")
    for (const c of api.clusters)
        lines.push(`    ${safeId(c.name)}["${c.name}<br/>${c.symbols.length} symbols"]`)
    for (const e of api.edges)
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
    lines.push("```\n")
    lines.push("## Per-cluster pages\n")
    for (const c of api.clusters)
        lines.push(`- [\`${c.name}\`](./${safeId(c.name)}.md) — ${c.symbols.length} symbols`)
    lines.push("\n## Documentation debt\n")
    if (api.docDebt.length === 0)
        lines.push("_none — every public symbol carries a doc comment_")
    else
        for (const d of api.docDebt)
            lines.push(`- \`${d.fqn}\` (${d.file}:${d.line})`)
    return lines.join("\n") + "\n"
}
