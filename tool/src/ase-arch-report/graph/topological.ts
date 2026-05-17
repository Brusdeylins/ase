/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  SCC-condensation + longest-path layer assignment.

    The Tier 3 renderer needs two structurally-derived orderings:
    (a) a deterministic *topological* order over packages so the DSM
        matrix lists rows/columns left-to-right in dependency order
        (cycle-closing entries fall above the diagonal), and
    (b) a *layer* index per package so the layered TD flowchart can
        stack packages with `entrypoint` on top and `leaf` on the
        bottom.  Both are derived from the same Tarjan SCC pass.

    Strategy: condense each SCC to a single super-node, build the
    DAG of super-nodes (edges between SCCs only), run Kahn's
    algorithm for the topological order, then assign each super-node
    a layer = longest-path length from any source super-node (so
    every package sits below all of its dependencies).  Each
    original node inherits the layer of its SCC.

    Reference: Kahn, A. B. (1962). "Topological sorting of large
    networks". Communications of the ACM 5 (11): 558–562.  */

import { tarjanSCC, type DirectedEdge } from "./scc.js"

export interface Layering {
    /*  list of SCC index in topological order (sources first)  */
    sccOrder:    number[]
    /*  per-node: which SCC it belongs to  */
    sccOfNode:   Map<string, number>
    /*  per-SCC: member node ids  */
    sccs:        string[][]
    /*  per-SCC: layer index (0 = entrypoint, larger = deeper)  */
    layerOfScc:  Map<number, number>
    /*  per-node: layer index (= layer of its SCC)  */
    layerOfNode: Map<string, number>
}

export const layerAssignment = (
    nodes: string[], edges: DirectedEdge[]
): Layering => {
    const sccs       = tarjanSCC(nodes, edges)
    const sccOfNode  = new Map<string, number>()
    for (let i = 0; i < sccs.length; i++)
        for (const n of sccs[i])
            sccOfNode.set(n, i)

    /*  condensed DAG: edges between distinct SCCs, deduplicated  */
    const sccOut    = new Map<number, Set<number>>()
    const sccInDeg  = new Map<number, number>()
    for (let i = 0; i < sccs.length; i++) {
        sccOut.set(i, new Set())
        sccInDeg.set(i, 0)
    }
    for (const e of edges) {
        const a = sccOfNode.get(e.from)
        const b = sccOfNode.get(e.to)
        if (a === undefined || b === undefined || a === b)
            continue
        if (!sccOut.get(a)!.has(b)) {
            sccOut.get(a)!.add(b)
            sccInDeg.set(b, sccInDeg.get(b)! + 1)
        }
    }

    /*  Kahn topological sort over the condensed DAG  */
    const sccOrder: number[] = []
    const ready: number[]    = []
    for (const [scc, deg] of sccInDeg)
        if (deg === 0)
            ready.push(scc)
    ready.sort((a, b) => a - b)
    while (ready.length > 0) {
        const s = ready.shift()!
        sccOrder.push(s)
        for (const t of sccOut.get(s)!) {
            sccInDeg.set(t, sccInDeg.get(t)! - 1)
            if (sccInDeg.get(t) === 0)
                ready.push(t)
        }
        ready.sort((a, b) => a - b)
    }

    /*  longest-path layer assignment in topological order — each
        SCC's layer = 1 + max(predecessor layers)  */
    const layerOfScc = new Map<number, number>()
    for (const s of sccOrder)
        layerOfScc.set(s, 0)
    for (const s of sccOrder)
        for (const t of sccOut.get(s)!) {
            const candidate = layerOfScc.get(s)! + 1
            if (candidate > layerOfScc.get(t)!)
                layerOfScc.set(t, candidate)
        }

    const layerOfNode = new Map<string, number>()
    for (const n of nodes) {
        const s = sccOfNode.get(n)!
        layerOfNode.set(n, layerOfScc.get(s)!)
    }

    return { sccOrder, sccOfNode, sccs, layerOfScc, layerOfNode }
}
