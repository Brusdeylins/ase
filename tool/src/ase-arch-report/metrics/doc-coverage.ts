/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Documentation coverage per cluster and aggregate, plus a
    threshold-colour helper so the renderer can stamp the result as
    green / yellow / red without duplicating the same magic numbers
    across HTML and Markdown emitters.  Coverage counts both the
    symbol-level doc (the class/interface JavaDoc above the type)
    and the member-level docs (each method/field) — matching what
    the doc-debt list reports.  */

import type { Cluster } from "../types.js"

export type Severity = "green" | "yellow" | "red"

export interface DocCoverage {
    documented: number
    total:      number
    percent:    number
    severity:   Severity
}

const GREEN_THRESHOLD  = 80
const YELLOW_THRESHOLD = 50

const severityFor = (percent: number): Severity => {
    if (percent >= GREEN_THRESHOLD)
        return "green"
    if (percent >= YELLOW_THRESHOLD)
        return "yellow"
    return "red"
}

const docPair = (cluster: Cluster): { documented: number; total: number } => {
    let documented = 0
    let total      = 0
    for (const s of cluster.symbols) {
        total++
        if (s.doc !== null)
            documented++
        for (const m of s.members) {
            total++
            if (m.doc !== null)
                documented++
        }
    }
    return { documented, total }
}

export const computeDocCoverage = (cluster: Cluster): DocCoverage => {
    const { documented, total } = docPair(cluster)
    const percent  = total === 0 ? 100 : Math.round((documented / total) * 100)
    return { documented, total, percent, severity: severityFor(percent) }
}

export const computeAggregateDocCoverage = (clusters: Cluster[]): DocCoverage => {
    let documented = 0
    let total      = 0
    for (const c of clusters) {
        const p = docPair(c)
        documented += p.documented
        total      += p.total
    }
    const percent = total === 0 ? 100 : Math.round((documented / total) * 100)
    return { documented, total, percent, severity: severityFor(percent) }
}
