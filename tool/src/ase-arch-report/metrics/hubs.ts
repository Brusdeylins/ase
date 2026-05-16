/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  "Hub" detection on the inter-cluster dependency graph and
    intra-cluster class graph.  A hub is a node that sits at the
    top of the fan-in or fan-out distribution — the architect cares
    about both because high fan-in indicates a load-bearing
    component (changes ripple widely) and high fan-out indicates a
    coordinator / orchestrator that knows too much.  */

import type { Cluster } from "../types.js"
import type { ClusterCoupling } from "./coupling.js"

export interface HubEntry {
    name:  string
    score: number
}

export const topClusterHubs = (
    coupling: Map<string, ClusterCoupling>, n: number, kind: "ca" | "ce"
): HubEntry[] => {
    const entries: HubEntry[] = []
    for (const [name, cp] of coupling)
        entries.push({ name, score: kind === "ca" ? cp.ca : cp.ce })
    entries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    return entries.filter((e) => e.score > 0).slice(0, n)
}

/*  Per-class fan-in within a cluster — used by the cluster-page
    class-diagram renderer (T3.4) to draw the hub-highlight border
    around classes referenced by many siblings.  The renderer
    supplies the threshold; this routine just returns the count
    map.  Counts only intra-cluster references (the `..>` edges
    drawn in the cluster diagram).  */
export const classFanInIntraCluster = (cluster: Cluster): Map<string, number> => {
    const ids = new Set(cluster.symbols.map((s) => s.name))
    const fanIn = new Map<string, number>()
    for (const s of cluster.symbols)
        fanIn.set(s.name, 0)
    for (const s of cluster.symbols)
        for (const r of s.references)
            if (ids.has(r) && r !== s.name)
                fanIn.set(r, (fanIn.get(r) ?? 0) + 1)
    return fanIn
}
