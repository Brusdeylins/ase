/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Constants reused by the per-cluster class-diagram renderer.

    History of CSS-styling attempts (and why they all failed):
    Mermaid v11.15's classDiagram parser tokenises both `classDef`
    AND `style` payloads character-by-character and rejects any
    CSS property name that contains a hyphen — `stroke-width` is
    read as `stroke` (ALPHA) followed by an unexpected MINUS
    token, and parsing aborts.  Earlier guidance that `style
    ClassName stroke-width:Xpx` would parse where `classDef`
    failed turned out to be incorrect for classDiagram (it holds
    only for flowchart).  Rather than ship a renderer that
    intermittently throws Parse Errors at the reader, we drop CSS
    styling altogether and use Mermaid-native multi-stereotype
    blocks (`<<hub>>` etc.) for every visual signal.  See render/
    class-diagram.ts for the stereotype layering and #1884 /
    #4021 for the upstream grammar issue.  */

/*  Intra-cluster fan-in at which a class is considered a "hub"
    (load-bearing component).  Reused by the class-diagram
    renderer and any future hub-aware caller (e.g. a hub badge
    in the symbol table).  */
export const HUB_FAN_IN_THRESHOLD = 3
