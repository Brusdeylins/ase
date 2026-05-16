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
    they would visually claim the Zone of Pain.  */

import type { Cluster } from "../types.js"
import type { MartinMetrics } from "../metrics/martin.js"

export const mainSequenceMermaid = (
    clusters: Cluster[], martin: Map<string, MartinMetrics>
): string => {
    const lines: string[] = []
    lines.push("quadrantChart")
    lines.push("    title Martin Main Sequence (per cluster)")
    lines.push("    x-axis Stable --> Instable")
    lines.push("    y-axis Concrete --> Abstract")
    lines.push("    quadrant-1 Zone of Uselessness")
    lines.push("    quadrant-2 Stable abstractions")
    lines.push("    quadrant-3 Zone of Pain")
    lines.push("    quadrant-4 Instable concretes")
    let plotted = 0
    for (const c of clusters) {
        const m = martin.get(c.name)
        if (m === undefined || m.confidence !== "ok")
            continue
        /*  Mermaid quadrantChart point syntax: `label: [x, y]`,
            both axes 0..1.  Trim the cluster name to its last
            path segment so labels stay short.  */
        const label = c.name.split("/").pop() ?? c.name
        lines.push(`    ${label}: [${m.i.toFixed(2)}, ${m.a.toFixed(2)}]`)
        plotted++
    }
    if (plotted === 0)
        return ""
    return lines.join("\n")
}
