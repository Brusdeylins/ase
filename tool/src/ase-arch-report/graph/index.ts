/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  re-export barrel for the arch-report graph layer; consumers
    (`../metrics/...`, `../render/...`) import from `./graph/...`
    rather than individual sub-modules so the internal structure
    can evolve without churning callers  */

export { tarjanSCC, type DirectedEdge }   from "./scc.js"
export { feedbackArcSet }                  from "./fas.js"
export { layerAssignment, type Layering }  from "./topological.js"
