/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  pure-logic edge resolution for the arch-report pipeline  */

import type { Cluster, Edge, UnresolvedRef } from "./types.js"

export interface ResolveResult {
    edges:      Edge[]
    unresolved: UnresolvedRef[]
}

export const resolveEdges = (clusters: Cluster[]): ResolveResult => {
    /*  index by simple name -> cluster.name (last writer wins on duplicate
        names across clusters; this is rare for an arch-report scope)  */
    const symbolCluster = new Map<string, string>()
    for (const c of clusters)
        for (const s of c.symbols)
            symbolCluster.set(s.name, c.name)

    const edgeMap = new Map<string, Edge>()
    const unresolved: UnresolvedRef[] = []

    const key  = (from: string, to: string): string => `${from}->${to}`
    const bump = (from: string, to: string): void => {
        const k = key(from, to)
        const e = edgeMap.get(k)
        if (e === undefined)
            edgeMap.set(k, { from, to, count: 1 })
        else
            e.count++
    }

    for (const c of clusters)
        for (const s of c.symbols)
            for (const ref of [ ...s.extends, ...s.implements, ...s.references ]) {
                const target = symbolCluster.get(ref)
                if (target === undefined)
                    unresolved.push({ ref, from: `${c.name}/${s.name}` })
                else if (target !== c.name)
                    bump(c.name, target)
            }

    const edges = [ ...edgeMap.values() ].sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    return { edges, unresolved }
}
