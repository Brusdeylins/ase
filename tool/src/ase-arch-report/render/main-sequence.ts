/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Robert C. Martin's "Main Sequence" plot rendered via Mermaid's
    quadrantChart — every cluster becomes one labelled point in
    (Instability, Abstractness) space.  The four quadrants directly
    map to Martin's qualitative zones:

        upper-right (high I, high A) → Zone of Uselessness
        lower-left  (low I,  low A)  → Zone of Pain
        upper-left  (low I,  high A) → stable abstractions (good)
        lower-right (high I, low A)  → instable concretes  (ok)

    Clusters whose Martin metrics could not be reliably computed
    (no abstract concept in the language, or too-small cluster) are
    suppressed from the plot rather than being shown at (0,0) where
    they would visually claim the Zone of Pain.

    Label-collision handling: in real projects multiple clusters
    often land at the same — or *visually indistinguishable* —
    (I, A) coordinates.  Mermaid's quadrantChart renders one point
    per coordinate and lays each label flush against its dot, so
    near-by points draw their labels on top of each other and
    only one cluster name remains legible.  We fight this in two
    stages:

      1) **exact-coord bucketing**: collapse points sharing the
         same rounded (i, a) pair into a single merged point with
         a comma-joined label.
      2) **collision-radius merge**: greedily merge any remaining
         pair of point-groups whose Euclidean distance falls
         below COLLISION_RADIUS.  The merged centroid is the
         size-weighted average so a 3-cluster group does not get
         dragged toward a 1-cluster neighbour, and labels are
         concatenated alphabetically for stable, diff-able
         output.

    COLLISION_RADIUS is tuned empirically: 0.08 of the unit square
    is roughly the horizontal space a 12-character label needs at
    Mermaid's default quadrantChart scale.  Bump it if labels
    still overlap on dense plots; lower it if it merges
    architecturally distinct clusters too aggressively.

    Edge-inset: Mermaid quadrantChart hard-codes label position
    to below-right of the dot — confirmed against v11.15 docs and
    issues #4849 / #7487 — so a cluster legitimately at A=0.0
    draws its label *under* the x-axis caption and disappears
    visually.  We compensate by mapping every plotted coordinate
    from [0,1] into [PLOT_INSET, 1-PLOT_INSET].  The quadrant
    boundary at 0.5 stays in the middle of the displayed area and
    qualitative zone-assignment is preserved; the cost is a small
    precision shift (a true I=0.00 plots at I=0.05) which is
    acceptable for a qualitative chart and far cheaper than
    losing the label entirely.  */

import type { Cluster } from "../types.js"
import type { MartinMetrics } from "../metrics/martin.js"

const COLLISION_RADIUS = 0.08
const PLOT_INSET       = 0.05

/*  Map a raw I or A value from the source range [0,1] into the
    inset display range [PLOT_INSET, 1-PLOT_INSET] so points at
    the natural extremes do not draw their labels into the axis
    captions.  Linear; preserves the quadrant boundary at 0.5.  */
const insetCoord = (v: number): number =>
    PLOT_INSET + v * (1 - 2 * PLOT_INSET)

interface PointGroup {
    i:     number
    a:     number
    names: string[]
}

/*  Greedy single-linkage merge: in each pass find the closest
    pair below the threshold and merge them; repeat until no pair
    is within the radius.  Order is deterministic because the
    closest-pair scan walks the array in index order and merges
    into the lower index; ties broken by index too.  */
const mergeColocated = (groups: PointGroup[], radius: number): PointGroup[] => {
    const out = groups.slice()
    const r2 = radius * radius
    let changed = true
    while (changed) {
        changed = false
        for (let i = 0; i < out.length && !changed; i++)
            for (let j = i + 1; j < out.length; j++) {
                const di = out[i].i - out[j].i
                const da = out[i].a - out[j].a
                if (di * di + da * da < r2) {
                    const ni = out[i].names.length
                    const nj = out[j].names.length
                    out[i] = {
                        i:     (out[i].i * ni + out[j].i * nj) / (ni + nj),
                        a:     (out[i].a * ni + out[j].a * nj) / (ni + nj),
                        names: [ ...out[i].names, ...out[j].names ]
                    }
                    out.splice(j, 1)
                    changed = true
                    break
                }
            }
    }
    return out
}

export const mainSequenceMermaid = (
    clusters: Cluster[], martin: Map<string, MartinMetrics>
): string => {
    /*  Stage 1: bucket clusters by their rounded coordinate pair.
        Key format `"i|a"` keeps the two decimals verbatim so no
        floating-point comparison is needed.  */
    const exactBuckets = new Map<string, PointGroup>()
    for (const c of clusters) {
        const m = martin.get(c.name)
        if (m === undefined || m.confidence !== "ok")
            continue
        const ix = m.i.toFixed(2)
        const ay = m.a.toFixed(2)
        const key = `${ix}|${ay}`
        const label = c.name.split("/").pop() ?? c.name
        const g = exactBuckets.get(key)
        if (g === undefined)
            exactBuckets.set(key, { i: m.i, a: m.a, names: [ label ] })
        else
            g.names.push(label)
    }
    if (exactBuckets.size === 0)
        return ""
    /*  Stage 2: merge near-coplanar point-groups so their labels
        do not draw on top of each other in the rendered SVG.  */
    const merged = mergeColocated([ ...exactBuckets.values() ], COLLISION_RADIUS)
    const lines: string[] = []
    lines.push("quadrantChart")
    lines.push("    title Martin Main Sequence (per cluster)")
    lines.push("    x-axis Stable --> Instable")
    lines.push("    y-axis Concrete --> Abstract")
    lines.push("    quadrant-1 Zone of Uselessness")
    lines.push("    quadrant-2 Stable abstractions")
    lines.push("    quadrant-3 Zone of Pain")
    lines.push("    quadrant-4 Instable concretes")
    /*  Emit one point per remaining group.  Sort labels
        alphabetically inside each group, and sort groups by their
        merged label so the .md / .html source stays stable across
        runs.  */
    const emit: { label: string; i: number; a: number }[] = []
    for (const g of merged) {
        g.names.sort()
        emit.push({ label: g.names.join(", "), i: g.i, a: g.a })
    }
    emit.sort((p, q) => p.label.localeCompare(q.label))
    for (const p of emit)
        lines.push(`    ${p.label}: [${insetCoord(p.i).toFixed(2)}, ${insetCoord(p.a).toFixed(2)}]`)
    return lines.join("\n")
}
