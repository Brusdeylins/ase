/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Architectural-debt shortlist — a small set of high-signal,
    deterministic findings derived from existing report data so the
    architect lands on the worst-offenders without having to read
    every cluster page.  All thresholds are local constants here so
    a future calibration pass can tune them centrally.

    The findings deliberately mirror skill aspects from
    `ase-arch-analyze` so the report and the skill speak the same
    language:

      - high-distance  → Martin distance D = |A + I − 1| beyond 0.4
        (Martin's main-sequence violation; SA04/SA08 tension)
      - god-package    → Ca ≥ 5 AND Ce ≥ 3 — coordinator dumping
        ground that should be split (SA21 god-package)
      - fragment       → cluster with ≤ 2 symbols that still has
        edges (SA21 fragment); a pure orphan with no edges is
        usually intentional package-info / module-info and is
        not flagged
      - interface-fat  → an `interface` symbol with ≥ 12 methods
        (SA13 INTERFACE-SIZE) — large interfaces hurt
        composability and pull every implementer along

    Languages without a given concept simply do not produce that
    finding kind (no Abstractness for JS/C → no high-distance
    rows; no interface kind for Python ABC → no interface-fat
    rows).  Failure mode is "absent finding", never "false
    positive".  */

import type { Cluster } from "../types.js"
import type { ClusterCoupling } from "./coupling.js"
import type { MartinMetrics } from "./martin.js"

export type ShortlistKind =
    "high-distance" | "god-package" | "fragment" | "interface-fat"

export type ShortlistSeverity = "high" | "medium" | "low"

export interface ShortlistFinding {
    kind:     ShortlistKind
    severity: ShortlistSeverity
    target:   string  /*  cluster name, or "cluster::ClassFqn" for symbol-level findings  */
    metric:   string  /*  formatted value e.g. "D=0.87"  */
    detail:   string  /*  one-line architect-readable explanation  */
}

/*  Tuning knobs — kept as module-local constants so a future
    calibration pass touches only this file.  Thresholds chosen
    from Martin / Lakos rules of thumb plus empirical experience
    on real Java / TS projects of 200–2000 symbols.  */
const HIGH_DISTANCE_THRESHOLD     = 0.4
const HIGH_DISTANCE_MAX_FINDINGS  = 5
const GOD_PACKAGE_CA              = 5
const GOD_PACKAGE_CE              = 3
const FRAGMENT_MAX_SYMBOLS        = 2
const INTERFACE_FAT_METHOD_COUNT  = 12

export const computeShortlist = (
    clusters: Cluster[],
    coupling: Map<string, ClusterCoupling>,
    martin:   Map<string, MartinMetrics>
): ShortlistFinding[] => {
    const findings: ShortlistFinding[] = []

    /*  high-distance: rank clusters with reliable Martin metrics
        by D descending, keep the top N above the threshold.
        Clusters with confidence !== "ok" are skipped — their D is
        either undefined or based on too few symbols to mean
        anything.  */
    const distanceCandidates: { name: string; d: number }[] = []
    for (const c of clusters) {
        const m = martin.get(c.name)
        if (m === undefined || m.confidence !== "ok")
            continue
        if (m.d >= HIGH_DISTANCE_THRESHOLD)
            distanceCandidates.push({ name: c.name, d: m.d })
    }
    distanceCandidates.sort((a, b) => b.d - a.d || a.name.localeCompare(b.name))
    for (const cand of distanceCandidates.slice(0, HIGH_DISTANCE_MAX_FINDINGS)) {
        const m = martin.get(cand.name)!
        findings.push({
            kind:     "high-distance",
            severity: cand.d >= 0.7 ? "high" : "medium",
            target:   cand.name,
            metric:   `D=${cand.d.toFixed(2)}`,
            detail:   `Far from main sequence (I=${m.i.toFixed(2)} · A=${m.a.toFixed(2)} · zone: ${m.zone}) — review whether the cluster's abstractness matches its stability.`
        })
    }

    /*  god-package: high inbound *and* high outbound, the
        coordinator-dumping-ground anti-pattern.  Ranked by Ca+Ce
        so the heaviest hubs come first.  */
    const godCandidates: { name: string; ca: number; ce: number }[] = []
    for (const [name, cp] of coupling)
        if (cp.ca >= GOD_PACKAGE_CA && cp.ce >= GOD_PACKAGE_CE)
            godCandidates.push({ name, ca: cp.ca, ce: cp.ce })
    godCandidates.sort((a, b) =>
        (b.ca + b.ce) - (a.ca + a.ce) || a.name.localeCompare(b.name))
    for (const g of godCandidates)
        findings.push({
            kind:     "god-package",
            severity: "high",
            target:   g.name,
            metric:   `Ca=${g.ca} · Ce=${g.ce}`,
            detail:   "Cluster sits between many callers and many callees — likely a coordinator that should be split along its internal topical clusters."
        })

    /*  fragment: 1–2 symbols with at least one edge — a candidate
        for consolidation with a sibling that shares the imported
        interface.  Symbol-less or edge-less clusters are
        intentional (package-info / module-info / barrel re-export)
        and not flagged.  */
    for (const c of clusters) {
        if (c.symbols.length === 0 || c.symbols.length > FRAGMENT_MAX_SYMBOLS)
            continue
        const cp = coupling.get(c.name)
        if (cp === undefined || (cp.ca + cp.ce) === 0)
            continue
        findings.push({
            kind:     "fragment",
            severity: "low",
            target:   c.name,
            metric:   `${c.symbols.length} symbol${c.symbols.length === 1 ? "" : "s"}`,
            detail:   "Cluster carries 1–2 symbols and still participates in coupling — review whether it should fold into a sibling that already shares its purpose."
        })
    }

    /*  interface-fat: a single `interface` (or trait) declaration
        with too many methods.  Reported per symbol so the
        shortlist points the architect at the exact offender.  */
    for (const c of clusters)
        for (const s of c.symbols)
            if (s.kind === "interface" && s.members.length >= INTERFACE_FAT_METHOD_COUNT)
                findings.push({
                    kind:     "interface-fat",
                    severity: s.members.length >= INTERFACE_FAT_METHOD_COUNT * 2 ? "high" : "medium",
                    target:   `${c.name}::${s.fqn}`,
                    metric:   `${s.members.length} methods`,
                    detail:   "Interface declares many methods — split along orthogonal capabilities so implementers can adopt only what they need."
                })

    /*  Stable sort: severity desc (high → low), then kind for
        grouping, then target for deterministic output.  */
    const severityRank = (s: ShortlistSeverity): number =>
        s === "high" ? 0 : s === "medium" ? 1 : 2
    findings.sort((a, b) =>
        severityRank(a.severity) - severityRank(b.severity)
        || a.kind.localeCompare(b.kind)
        || a.target.localeCompare(b.target))
    return findings
}
