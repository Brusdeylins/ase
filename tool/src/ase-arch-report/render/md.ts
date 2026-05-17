/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Markdown rendering for the arch-report pipeline  */

import type { ApiJson, Cluster, ArchSymbol }   from "../types.js"
import { safeId }                              from "./util.js"
import type { RenderContext }                  from "./context.js"
import { topClusterHubs, classFanInIntraCluster } from "../metrics/hubs.js"

const HUB_FAN_IN_THRESHOLD = 3
import { indexStatsPanelMd, clusterStatsPanelMd } from "./stats-panel.js"
import { dsmMd }                               from "./dsm.js"
import { cyclesMd, cyclesTouchingCluster }     from "./cycles.js"
import { mainSequenceMermaid }                 from "./main-sequence.js"

const mermaidClassDiagram = (cluster: Cluster, allInScopeSymbols: Set<string>): string => {
    /*  same shape as the HTML class diagram: body-less class
        declarations, inheritance + call-reference edges (intra-cluster
        only), inline `:::hub` style for high-fan-in classes, and
        `<<external>>` ghost classes for heritage targets that live
        outside the chosen scope (so structural relationships to
        sibling packages stay visible).  */
    const clusterNames = new Set(cluster.symbols.map((s) => s.name))
    const clusterIds   = new Set(cluster.symbols.map((s) => safeId(s.name)))
    const fanIn        = classFanInIntraCluster(cluster)
    const isHub        = (name: string): boolean =>
        (fanIn.get(name) ?? 0) >= HUB_FAN_IN_THRESHOLD
    const hubSuffix    = (name: string): string =>
        isHub(name) ? ":::hub" : ""
    const hasAnyHub    = cluster.symbols.some((s) => isHub(s.name))
    const externals    = new Set<string>()
    for (const s of cluster.symbols)
        for (const target of [ ...s.extends, ...s.implements ])
            if (!clusterNames.has(target) && !allInScopeSymbols.has(target))
                externals.add(target)
    const lines: string[] = [ "```mermaid", "classDiagram" ]
    if (hasAnyHub)
        lines.push("    classDef hub stroke-width:3px")
    if (externals.size > 0)
        lines.push("    classDef external stroke-dasharray:5 5")
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
    for (const ext of [ ...externals ].sort()) {
        lines.push(`    class ${safeId(ext)}:::external {`)
        lines.push("        <<external>>")
        lines.push("    }")
    }
    lines.push("```")
    return lines.join("\n")
}

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
    parts.push(mermaidClassDiagram(cluster, ctx.allInScopeSymbols))
    parts.push("\n## Symbols\n")
    for (const s of cluster.symbols)
        parts.push(apiTable(s))
    parts.push("\n## Documentation debt\n")
    const clusterFqns = new Set(cluster.symbols.map((s) => s.fqn))
    const clusterDebt = api.docDebt.filter((d) =>
        clusterFqns.has(d.fqn.split("#")[0]))
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
    lines.push("```mermaid")
    lines.push("flowchart TD")
    const byLayer = new Map<number, string[]>()
    for (const c of api.clusters) {
        const layer = ctx.layerOfCluster.get(c.name) ?? 0
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
    lines.push("```\n")
    lines.push(cyclesMd(ctx.cycleReport))
    lines.push("\n## Dependency Structure Matrix\n")
    lines.push(dsmMd(api, ctx.sortedClusterNames))
    const mainSeq = mainSequenceMermaid(api.clusters, ctx.martin)
    if (mainSeq !== "") {
        lines.push("\n## Martin Main Sequence\n")
        lines.push("```mermaid")
        lines.push(mainSeq)
        lines.push("```\n")
    }
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
