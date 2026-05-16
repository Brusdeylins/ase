/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  RenderContext bundles every pre-computed analysis artefact that
    one or both renderers (HTML, Markdown) need, so the page-assembly
    functions can stay declarative and free of compute logic.  The
    orchestrator (`../index.ts`) builds this object once per report
    and passes the same instance to every renderer call.  */

import type { ClusterCoupling } from "../metrics/coupling.js"
import type { MartinMetrics }   from "../metrics/martin.js"
import type { DocCoverage }     from "../metrics/doc-coverage.js"
import type { CycleReport }     from "./cycles.js"

export interface RenderContext {
    coupling:           Map<string, ClusterCoupling>
    martin:             Map<string, MartinMetrics>
    docCovPerCluster:   Map<string, DocCoverage>
    docCovAggregate:    DocCoverage
    cycleReport:        CycleReport
    sortedClusterNames: string[]
    totalLoc:           number
}
