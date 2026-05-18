/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Chidamber & Kemerer-style class metrics derived from the
    existing per-symbol heritage data (`extends`, `implements`,
    `members`):

      DIT — Depth of Inheritance Tree.  Longest chain from a class
            up to a root, counting every step including the first
            external supertype (e.g. `java.lang.Object`).  High DIT
            means changes ripple through many ancestors; literature
            usually flags DIT > 5.
      NOC — Number of (direct) Children.  Inverse of `extends`:
            how many in-scope classes name this class as a direct
            supertype.  High NOC concentrates dependencies and
            argues for a stable contract on the parent.
      WMC outlier — naive Weighted Method Count: members.length per
            class, flagged when above a hard cap (30) or above
            mean + 2σ across the in-scope class population.  A
            cyclomatic-complexity-weighted variant would require
            per-method AST walking; the simple count already
            surfaces the dominant offenders.

    Cycle protection: should the heritage graph contain a cycle
    (cyclic generics in TS or genuine model errors), DIT walks
    track the visit set and return depth 0 once revisited so the
    computation terminates.  */

import type { Cluster, ArchSymbol } from "../types.js"

export interface InheritanceMetrics {
    /*  keyed by `ArchSymbol.fqn` — the qualified name uniquely
        identifies a symbol across the whole report, including
        nested types  */
    dit:         Map<string, number>
    noc:         Map<string, number>
    wmc:         Map<string, number>
    wmcOutliers: Set<string>
}

const WMC_HARD_CAP        = 30
const WMC_SIGMA_THRESHOLD = 2

export const computeInheritance = (clusters: Cluster[]): InheritanceMetrics => {
    /*  Flatten every in-scope symbol once + build the simple-name
        → fqn lookup the heritage strings need.  `extends` and
        `implements` carry *simple* names (the extractor strips the
        package prefix when collecting heritage), so the resolver
        maps a simple name to whichever in-scope symbol matches.
        Same-named symbols across clusters collide on first-write
        like `coupling.ts` already does — acceptable: the report's
        primary architectural signal is "is there a heritage link
        at all", not "which exact namespace owns the parent".  */
    const allSymbols: ArchSymbol[] = []
    const byFqn = new Map<string, ArchSymbol>()
    const nameToFqn = new Map<string, string>()
    for (const c of clusters)
        for (const s of c.symbols) {
            allSymbols.push(s)
            byFqn.set(s.fqn, s)
            if (!nameToFqn.has(s.name))
                nameToFqn.set(s.name, s.fqn)
        }

    /*  Recursive DIT with memoisation.  Each call returns the
        longest distance from `fqn` up to a root, counting +1 for
        every step.  An unresolved parent (i.e. one that lives
        outside the report scope) still contributes +1 — Martin
        counts every supertype, in-scope or not — but does not
        recurse further.  */
    const dit = new Map<string, number>()
    const visitDit = (fqn: string, path: Set<string>): number => {
        const cached = dit.get(fqn)
        if (cached !== undefined)
            return cached
        if (path.has(fqn))
            return 0
        const s = byFqn.get(fqn)
        if (s === undefined)
            return 0
        const parents = [ ...s.extends, ...s.implements ]
        if (parents.length === 0) {
            dit.set(fqn, 0)
            return 0
        }
        path.add(fqn)
        let best = 0
        for (const p of parents) {
            const parentFqn = nameToFqn.get(p)
            const parentDit = parentFqn !== undefined ?
                visitDit(parentFqn, path) : 0
            const candidate = 1 + parentDit
            if (candidate > best)
                best = candidate
        }
        path.delete(fqn)
        dit.set(fqn, best)
        return best
    }
    for (const s of allSymbols)
        visitDit(s.fqn, new Set())

    /*  NOC = how many in-scope classes name `s` as a direct
        supertype.  Counts both `extends` and `implements` because
        for the architect "you have N subtypes" is one fact
        regardless of which keyword the subtype used.  */
    const noc = new Map<string, number>()
    for (const s of allSymbols)
        noc.set(s.fqn, 0)
    for (const s of allSymbols)
        for (const p of [ ...s.extends, ...s.implements ]) {
            const parentFqn = nameToFqn.get(p)
            if (parentFqn !== undefined)
                noc.set(parentFqn, (noc.get(parentFqn) ?? 0) + 1)
        }

    /*  WMC + outlier flag.  The hard cap of 30 catches "obvious"
        god classes regardless of population shape; the σ-based
        cut catches outliers in projects where the median class is
        already large (the cap alone would miss them) or where the
        median is small (then any 20-method class is suspicious).
        Empty populations short-circuit out — no outliers possible.  */
    const wmc = new Map<string, number>()
    const memberCounts: number[] = []
    for (const s of allSymbols) {
        wmc.set(s.fqn, s.members.length)
        memberCounts.push(s.members.length)
    }
    const wmcOutliers = new Set<string>()
    if (memberCounts.length > 0) {
        const n     = memberCounts.length
        const mean  = memberCounts.reduce((a, b) => a + b, 0) / n
        const varc  = memberCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / n
        const sigma = Math.sqrt(varc)
        const sigmaCut = mean + WMC_SIGMA_THRESHOLD * sigma
        for (const s of allSymbols)
            if (s.members.length >= WMC_HARD_CAP || s.members.length > sigmaCut)
                wmcOutliers.add(s.fqn)
    }
    return { dit, noc, wmc, wmcOutliers }
}

/*  Convenience: produce a per-cluster top-N hub-by-NOC list so
    cluster pages can surface their structural anchors at a
    glance.  Sorted by NOC desc, ties broken by fqn for stable
    output.  */
export interface InheritanceHubEntry {
    fqn: string
    noc: number
    dit: number
}
export const topInheritanceHubs = (
    cluster: Cluster, inh: InheritanceMetrics, n: number
): InheritanceHubEntry[] => {
    const entries: InheritanceHubEntry[] = cluster.symbols
        .map((s) => ({ fqn: s.fqn, noc: inh.noc.get(s.fqn) ?? 0, dit: inh.dit.get(s.fqn) ?? 0 }))
        .filter((e) => e.noc > 0)
    entries.sort((a, b) => b.noc - a.noc || a.fqn.localeCompare(b.fqn))
    return entries.slice(0, n)
}
