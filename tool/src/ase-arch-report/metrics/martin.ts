/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Robert C. Martin's package metrics — Instability, Abstractness,
    Distance from the Main Sequence, plus a zone classification.

    Definitions (from "Agile Software Development" and the
    OO-design-metrics literature):
      I = Ce / (Ce + Ca)
        Range 0..1.  0 = maximally stable (lots of incoming deps,
        no outgoing); 1 = maximally instable.
      A = abstract_class_count / total_class_count   per cluster
        Range 0..1.  0 = fully concrete; 1 = nothing instantiable.
      D = | A + I − 1 |
        Distance from the *Main Sequence* line (A + I = 1).  0 = on
        the line (good balance of abstractness and stability), 1 =
        worst (either Zone of Pain or Zone of Uselessness).
      Zones:
        I<0.3 ∧ A<0.3 → Zone of Pain        (stable, concrete)
        I>0.7 ∧ A>0.7 → Zone of Uselessness (instable, abstract)
        else          → ok / Main Sequence

    Confidence: the metric is statistically meaningless for very
    small clusters and for languages where `isAbstract` cannot be
    reliably inferred (JavaScript, plain C).  When confidence is
    null the renderer should display "N/A" instead of a number.  */

import type { Cluster, Language } from "../types.js"
import type { ClusterCoupling } from "./coupling.js"

export type MartinZone = "pain" | "uselessness" | "ok"

export interface MartinMetrics {
    ca:         number
    ce:         number
    i:          number
    a:          number
    d:          number
    zone:       MartinZone
    confidence: "ok" | "low" | "isolated" | null
}

/*  languages where `isAbstract` cannot be inferred from syntax
    alone — Martin Abstractness is reported as "N/A" for them  */
const NO_ABSTRACT_CONCEPT = new Set<Language>([ "javascript", "c" ])

const MIN_SYMBOLS_FOR_CONFIDENCE = 3

const zoneOf = (i: number, a: number): MartinZone => {
    if (i < 0.3 && a < 0.3)
        return "pain"
    if (i > 0.7 && a > 0.7)
        return "uselessness"
    return "ok"
}

export const computeMartin = (
    cluster: Cluster, coupling: ClusterCoupling
): MartinMetrics => {
    const total    = cluster.symbols.length
    const abstract = cluster.symbols.reduce((n, s) => n + (s.isAbstract ? 1 : 0), 0)
    const ca = coupling.ca
    const ce = coupling.ce
    /*  A truly isolated cluster (Ca = Ce = 0) has no defined
        Instability under Martin's I = Ce / (Ce + Ca) formula —
        the ratio is 0/0.  We default I to 0 to keep arithmetic
        downstream safe (D = |A + I − 1|), but flag the cluster
        with confidence = "isolated" so the renderer can show
        "N/A (isolated)" instead of misleadingly placing the
        cluster in the Zone of Pain at (I=0, A=0).  */
    const i  = (ca + ce === 0) ? 0 : ce / (ca + ce)
    const a  = total === 0 ? 0 : abstract / total
    const d  = Math.abs(a + i - 1)

    /*  honest confidence: null when the cluster's language has no
        abstract concept (A is structurally zero), "low" when the
        cluster is too small for the ratios to be statistically
        meaningful, "isolated" when there are no edges at all, and
        "ok" otherwise.  */
    let confidence: "ok" | "low" | "isolated" | null
    if (NO_ABSTRACT_CONCEPT.has(cluster.language))
        confidence = null
    else if (ca + ce === 0)
        confidence = "isolated"
    else if (total < MIN_SYMBOLS_FOR_CONFIDENCE)
        confidence = "low"
    else
        confidence = "ok"

    return { ca, ce, i, a, d, zone: zoneOf(i, a), confidence }
}

export const computeAllMartin = (
    clusters: Cluster[], coupling: Map<string, ClusterCoupling>
): Map<string, MartinMetrics> => {
    const out = new Map<string, MartinMetrics>()
    for (const c of clusters) {
        const cp = coupling.get(c.name) ?? { ca: 0, ce: 0 }
        out.set(c.name, computeMartin(c, cp))
    }
    return out
}
