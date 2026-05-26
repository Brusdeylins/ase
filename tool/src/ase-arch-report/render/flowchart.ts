/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Shared Mermaid `flowchart TD` source builder for the inter-
    cluster dependency graph on the Index page.  Cluster nodes are
    grouped into `subgraph` blocks per topological layer
    (source-cluster layer 0 on top, leaf-cluster layer N on the
    bottom), edges are drawn with their reference-count label.

    Mermaid v11.15 features used here:

    - YAML front-matter init block selects the **ELK renderer**
      (`config.flowchart.defaultRenderer: elk`).  ELK produces
      noticeably tighter layered layouts than the default Dagre
      engine for graphs with > 3 layers and reduces edge crossings
      on dense inter-cluster fans.

    - **Typed-node shape syntax** `id@{ shape: ?, label: "..." }`
      conveys cluster role at a glance: `hex` for clusters that
      touch a cyclic dependency (architectural hot spot), `doc`
      for pure-leaf clusters (zero outgoing edges — likely a
      stable API or data contract), `rounded` for everything else.

    - **Per-edge `linkStyle`** with `stroke-width` bucketed by
      reference count gives the architect a visual weight cue
      without having to read every numeric edge label.  Buckets
      are intentionally coarse — 4 thickness levels — because
      finer gradation hits Mermaid's anti-aliasing wall and
      stops being legible.  */

import type { ApiJson } from "../types.js"
import type { CycleReport } from "./cycles.js"
import { safeId }       from "./util.js"

/*  Map a reference-count to a stroke-width bucket.  Thresholds
    chosen so an architect can distinguish "tiny coupling" from
    "load-bearing edge" without the bucketing turning the diagram
    into a coarse on/off signal.  */
const edgeThicknessPx = (count: number): number => {
    if (count >= 30) return 4
    if (count >= 10) return 3
    if (count >=  3) return 2
    return 1
}

/*  Pick a cluster's node shape by its structural role.  A cluster
    that participates in any cycle is the most actionable signal
    and wins over the leaf signal; leaves are next; everything
    else gets the neutral rounded box.  */
const shapeForCluster = (
    name: string, cyclic: Set<string>, leaf: Set<string>
): string => {
    if (cyclic.has(name))
        return "hex"
    if (leaf.has(name))
        return "doc"
    return "rounded"
}

export const buildLayeredFlowchart = (
    api: ApiJson,
    layerOfCluster: Map<string, number>,
    cycleReport: CycleReport
): string => {
    /*  Set of clusters that touch any cycle — used by the typed-
        node shape picker to mark architectural hot spots.  */
    const cyclic = new Set<string>()
    for (const cy of cycleReport.cycles)
        for (const m of cy.members)
            cyclic.add(m)
    /*  Set of clusters with zero outgoing edges (pure leaves).
        A "leaf" in the dependency graph typically represents a
        stable API or data-contract layer and gets a doc shape
        as a visual cue.  */
    const hasOutgoing = new Set<string>()
    for (const e of api.edges)
        hasOutgoing.add(e.from)
    const leaf = new Set<string>()
    for (const c of api.clusters)
        if (!hasOutgoing.has(c.name))
            leaf.add(c.name)

    const lines: string[] = []
    /*  Front-matter init: switch to ELK renderer.  Mermaid 11
        consumes YAML between `---` fences before the diagram
        keyword.  */
    lines.push("---")
    lines.push("config:")
    lines.push("  flowchart:")
    lines.push("    defaultRenderer: elk")
    lines.push("---")
    lines.push("flowchart TD")
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
        for (const name of byLayer.get(layer)!.sort()) {
            const shape = shapeForCluster(name, cyclic, leaf)
            const label = `${name}<br/>${symCount.get(name) ?? 0} symbols`
            lines.push(`        ${safeId(name)}@{ shape: ${shape}, label: "${label}" }`)
        }
        lines.push("    end")
    }
    /*  Emit edges and remember each edge's index so per-edge
        `linkStyle` directives below can address them by index.
        Mermaid numbers `linkStyle` in the order edges appear in
        the source, so the index is just the running count.  */
    const edgeWeights: number[] = []
    for (const e of api.edges) {
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
        edgeWeights.push(edgeThicknessPx(e.count))
    }
    /*  Emit one linkStyle per edge.  We could collapse runs of
        the same width into ranged forms (`linkStyle 0,1,2 …`) but
        the per-edge form keeps the source diff trivial when an
        edge moves, and Mermaid handles N hundred linkStyles fine.  */
    for (let i = 0; i < edgeWeights.length; i++)
        lines.push(`    linkStyle ${i} stroke-width:${edgeWeights[i]}px`)
    return lines.join("\n")
}
