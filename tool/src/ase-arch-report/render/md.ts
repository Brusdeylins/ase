/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Markdown rendering for the arch-report pipeline  */

import type { ApiJson, Cluster, ArchSymbol }       from "../types.js"
import { safeId, filterClusterDocDebt }            from "./util.js"
import type { RenderContext }                      from "./context.js"
import { topClusterHubs }                          from "../metrics/hubs.js"
import { indexStatsPanelMd, clusterStatsPanelMd }  from "./stats-panel.js"
import { dsmMd }                                   from "./dsm.js"
import { cyclesMd, cyclesTouchingCluster }         from "./cycles.js"
import { mainSequenceMermaid }                     from "./main-sequence.js"
import { buildClassDiagram }                       from "./class-diagram.js"
import { buildLayeredFlowchart }                   from "./flowchart.js"

const fenced = (src: string): string => `\`\`\`mermaid\n${src}\n\`\`\``

const apiTable = (s: ArchSymbol): string => {
    const head = `### \`${s.name}\` (${s.kind} · ${s.loc} LOC · ${s.members.length} methods)\n\n${s.doc ?? "_(no description)_"}\n\n`
    if (s.members.length === 0)
        return head + "_no public members_\n"
    const rows = s.members.map((m) =>
        `| \`${m.name}\` | \`${m.signature}\` | ${m.doc ?? "_(no description)_"} |`).join("\n")
    return head + "| Method | Signature | Description |\n|---|---|---|\n" + rows + "\n"
}

export const renderClusterMd = (cluster: Cluster, api: ApiJson, ctx: RenderContext): string => {
    const parts: string[] = []
    parts.push("[← back to index](./index.md)\n")
    parts.push(`# Cluster: \`${cluster.name}\` (${cluster.language})\n`)
    parts.push(clusterStatsPanelMd({
        cluster,
        coupling:       ctx.coupling.get(cluster.name) ?? { ca: 0, ce: 0 },
        martin:         ctx.martin.get(cluster.name)!,
        docCoverage:    ctx.docCovPerCluster.get(cluster.name)!,
        cyclesTouching: cyclesTouchingCluster(ctx.cycleReport, cluster)
    }))
    parts.push("## Class relationships\n")
    parts.push(fenced(buildClassDiagram(cluster, ctx.allInScopeSymbols)))
    parts.push("\n## Symbols\n")
    for (const s of cluster.symbols)
        parts.push(apiTable(s))
    parts.push("\n## Documentation debt\n")
    const clusterDebt = filterClusterDocDebt(api, cluster)
    if (clusterDebt.length === 0)
        parts.push("_none — every public symbol in this cluster carries a doc comment_")
    else
        for (const d of clusterDebt)
            parts.push(`- \`${d.fqn}\` (${d.file}:${d.line})`)
    return parts.join("\n") + "\n"
}

export const renderIndexMd = (api: ApiJson, ctx: RenderContext): string => {
    const lines: string[] = []
    lines.push("# Architecture Report\n")
    lines.push(`Scope: \`${api.scope}\`  `)
    lines.push(`Generated: ${api.generatedAt}  `)
    lines.push(`Languages: ${api.languages.join(", ")}\n`)
    lines.push("> Coverage: public and protected API only. Private and package-private members are intentionally excluded.\n")
    lines.push("## Summary\n")
    lines.push(indexStatsPanelMd({
        api,
        cycleCount:  ctx.cycleReport.cycles.length,
        docCoverage: ctx.docCovAggregate,
        topFanIn:    topClusterHubs(ctx.coupling, 3, "ca"),
        topFanOut:   topClusterHubs(ctx.coupling, 3, "ce"),
        totalLoc:    ctx.totalLoc
    }))
    lines.push("## Cluster dependencies\n")
    lines.push(fenced(buildLayeredFlowchart(api, ctx.layerOfCluster)))
    lines.push(cyclesMd(ctx.cycleReport))
    lines.push("\n## Dependency Structure Matrix\n")
    lines.push(dsmMd(api, ctx.sortedClusterNames))
    const mainSeq = mainSequenceMermaid(api.clusters, ctx.martin)
    if (mainSeq !== "")
        lines.push("\n## Martin Main Sequence\n" + fenced(mainSeq) + "\n")
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
