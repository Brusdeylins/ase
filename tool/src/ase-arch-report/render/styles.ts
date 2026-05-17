/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Single source of truth for the Mermaid `classDef` directives
    used by the per-cluster class diagrams.  All visual signals
    (hub-highlight, external-ghost) live here so a Mermaid
    upstream fix or a palette change is a one-line edit instead
    of a hunt across html.ts / md.ts and every emitter location.

    The two definitions deliberately use a *single* CSS property
    each: Mermaid v10's classDiagram parser
    (mermaid-js/mermaid#5498) chokes on comma-separated payloads
    regardless of whether the values are hex codes or CSS named
    colours, so a multi-property `classDef` produces a parse
    error.  When upstream lands the parser fix, richer styling
    can be restored by editing these two constants alone.  */

export const CLASSDEF_HUB      = "classDef hub stroke-width:3px"
export const CLASSDEF_EXTERNAL = "classDef external stroke-dasharray:5 5"

/*  Inline-style suffix applied directly to a class declaration
    (`class Foo:::hub`) — Mermaid's `:::` form is parsed at
    declaration time and avoids the second-line newline boundary
    that breaks the post-declaration `cssClass "..." hub` form.  */
export const HUB_SUFFIX      = ":::hub"
export const EXTERNAL_SUFFIX = ":::external"

/*  Hub-detection threshold reused by the class-diagram builder
    and any future hub-aware renderer (e.g. a hub badge in the
    symbol table).  */
export const HUB_FAN_IN_THRESHOLD = 3
