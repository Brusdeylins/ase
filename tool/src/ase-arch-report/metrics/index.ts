/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  re-export barrel for the arch-report metrics layer; consumers
    in `../render/...` import from `./metrics/...` so the internal
    layout can evolve without churning the renderer side  */

export { computeCoupling, type ClusterCoupling } from "./coupling.js"
export {
    computeMartin, computeAllMartin,
    type MartinMetrics, type MartinZone
} from "./martin.js"
export {
    computeDocCoverage, computeAggregateDocCoverage,
    type DocCoverage, type Severity
} from "./doc-coverage.js"
export {
    topClusterHubs, classFanInIntraCluster,
    type HubEntry
} from "./hubs.js"
export {
    computeShortlist,
    type ShortlistFinding, type ShortlistKind, type ShortlistSeverity
} from "./shortlist.js"
export {
    computeInheritance, topInheritanceHubs,
    type InheritanceMetrics, type InheritanceHubEntry
} from "./inheritance.js"
