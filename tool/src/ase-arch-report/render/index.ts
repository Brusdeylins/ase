/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  re-export barrel for the arch-report render layer; importers in
    the pipeline (`../index.ts`) consume `./render/...` rather than
    individual sub-modules so the internal structure can evolve
    without churning the caller  */

export { renderClusterHtml, renderIndexHtml } from "./html.js"
export { renderClusterMd,   renderIndexMd }   from "./md.js"
