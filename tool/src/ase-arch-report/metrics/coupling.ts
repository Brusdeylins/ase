/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Per-cluster afferent and efferent coupling derived from the
    per-file import lists captured during extraction (T1.3).  This
    is the canonical source for Martin metrics — the renderer's
    `s.references` scan is a sanity-only fallback used when a
    cluster's files happen to carry no resolvable imports at all.

    Coupling is computed at *cluster granularity* (not per class):
    - Ce(C) = number of distinct OTHER clusters that any file of C
              imports a known symbol from
    - Ca(C) = number of distinct OTHER clusters that import any
              known symbol of C  */

import type { ArchFile, Cluster } from "../types.js"

export interface ClusterCoupling {
    ca: number
    ce: number
}

export const computeCoupling = (
    clusters: Cluster[], files: ArchFile[]
): Map<string, ClusterCoupling> => {
    /*  Index every known simple-name to its owning cluster.
        Multiple clusters may declare same-named symbols; first
        write wins (rare collision; the architect-report's primary
        signal is "is there a coupling at all", and clustering
        edges by simple-name aligns with how the existing
        resolveEdges already operates.)  */
    const symbolToCluster = new Map<string, string>()
    for (const c of clusters)
        for (const s of c.symbols)
            if (!symbolToCluster.has(s.name))
                symbolToCluster.set(s.name, c.name)

    /*  Map every file path to its owning cluster — files are not
        listed on the Cluster type, so we walk the symbols and use
        their file field, taking the dirname for the file-set.  */
    const fileToCluster = new Map<string, string>()
    for (const c of clusters)
        for (const s of c.symbols)
            fileToCluster.set(s.file, c.name)

    /*  cluster -> set of distinct external cluster names it
        DEPENDS ON (drives Ce) and that DEPEND ON it (drives Ca)  */
    const efferent = new Map<string, Set<string>>()
    const afferent = new Map<string, Set<string>>()
    for (const c of clusters) {
        efferent.set(c.name, new Set())
        afferent.set(c.name, new Set())
    }

    /*  Walk every captured file and resolve each import to a
        target cluster via simple-name lookup.  Imports typically
        carry an FQN (`java.io.IOException`,
        `org.foo.bar.MyClass`); extract the *last* dotted/slashed
        segment as the simple type name.  */
    const lastSegment = (s: string): string => {
        const parts = s.split(/[./]/)
        return parts[parts.length - 1]
    }
    for (const f of files) {
        const fromCluster = fileToCluster.get(f.path)
        if (fromCluster === undefined)
            continue
        for (const imp of f.imports) {
            const simple = lastSegment(imp)
            const toCluster = symbolToCluster.get(simple)
            if (toCluster === undefined || toCluster === fromCluster)
                continue
            efferent.get(fromCluster)!.add(toCluster)
            afferent.get(toCluster)!.add(fromCluster)
        }
    }

    const result = new Map<string, ClusterCoupling>()
    for (const c of clusters)
        result.set(c.name, {
            ca: afferent.get(c.name)!.size,
            ce: efferent.get(c.name)!.size
        })
    return result
}
