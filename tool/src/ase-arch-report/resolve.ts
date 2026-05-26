/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  pure-logic edge resolution for the arch-report pipeline  */

import type { Cluster, Edge, UnresolvedRef } from "./types.js"

export interface ResolveResult {
    edges:      Edge[]
    unresolved: UnresolvedRef[]
}

export const resolveEdges = (clusters: Cluster[]): ResolveResult => {
    /*  Index by simple name -> set of owning clusters.  When the same
        simple name exists in two clusters (e.g. two `Logger` classes
        in different packages), every cross-cluster reference to that
        name now bumps an edge into *each* candidate cluster instead
        of silently picking the last-iterated one — the previous
        "last writer wins" behaviour produced a non-deterministic
        miscount that propagated into Ca/Ce, Martin metrics, the DSM,
        and cycle detection.  */
    const symbolCluster = new Map<string, Set<string>>()
    for (const c of clusters)
        for (const s of c.symbols) {
            let set = symbolCluster.get(s.name)
            if (set === undefined) {
                set = new Set()
                symbolCluster.set(s.name, set)
            }
            set.add(c.name)
        }

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

    type Tagged = { ref: string; kind: UnresolvedRef["kind"] }
    const tagged = (refs: string[], kind: UnresolvedRef["kind"]): Tagged[] =>
        refs.map((ref) => ({ ref, kind }))
    for (const c of clusters)
        for (const s of c.symbols) {
            const all: Tagged[] = [
                ...tagged(s.extends,    "extends"),
                ...tagged(s.implements, "implements"),
                ...tagged(s.references, "references")
            ]
            for (const { ref, kind } of all) {
                const targets = symbolCluster.get(ref)
                if (targets === undefined)
                    unresolved.push({ ref, from: `${c.name}/${s.name}`, kind })
                else for (const t of targets)
                    if (t !== c.name)
                        bump(c.name, t)
            }
        }

    const edges = [ ...edgeMap.values() ].sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    return { edges, unresolved }
}
