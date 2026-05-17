/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Shared Mermaid `flowchart TD` source builder for the inter-
    cluster dependency graph on the Index page.  Cluster nodes
    are grouped into `subgraph` blocks per topological layer
    (source-cluster layer 0 on top, leaf-cluster layer N on the
    bottom), edges are drawn with their reference-count label.  */

import type { ApiJson } from "../types.js"
import { safeId }       from "./util.js"

export const buildLayeredFlowchart = (
    api: ApiJson, layerOfCluster: Map<string, number>
): string => {
    const lines: string[] = [ "flowchart TD" ]
    const byLayer = new Map<number, string[]>()
    for (const c of api.clusters) {
        const layer = layerOfCluster.get(c.name) ?? 0
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
    return lines.join("\n")
}
