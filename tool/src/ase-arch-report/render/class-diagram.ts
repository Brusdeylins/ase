/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Shared Mermaid classDiagram source builder used by both the
    HTML and Markdown renderers.  Returns the raw Mermaid source
    (no ```mermaid fence, no <div> wrapper) so each caller can
    embed it the way its output format requires.

    The diagram intentionally complements — not duplicates — the
    per-symbol method tables rendered below the diagram on each
    cluster page:

    - one body-less `class Foo` declaration per in-cluster symbol
    - the bare `<<interface>>` stereotype body for interfaces
    - inheritance edges (`<|--` for extends, `<|..` for implements)
    - intra-cluster call-reference edges (`..>`) — filtered to
      cluster-known targets to keep the diagram local
    - the inline `:::hub` suffix on classes whose intra-cluster
      fan-in reaches the hub threshold (high load-bearing classes
      get a thick border)
    - dashed `<<external>>` ghost classes for heritage targets
      that live outside every in-scope cluster (so structural
      relationships to sibling packages stay visible even when
      the chosen scope is narrow)

    Single source of truth — any styling tweak or workaround for
    Mermaid grammar quirks (see render/styles.ts) only needs to
    land here, not in two duplicate copies under html.ts / md.ts.  */

import type { Cluster }            from "../types.js"
import { safeId }                  from "./util.js"
import { classFanInIntraCluster }  from "../metrics/hubs.js"
import {
    CLASSDEF_HUB, CLASSDEF_EXTERNAL,
    HUB_SUFFIX,   EXTERNAL_SUFFIX,
    HUB_FAN_IN_THRESHOLD
} from "./styles.js"

export const buildClassDiagram = (
    cluster: Cluster, allInScopeSymbols: Set<string>
): string => {
    const clusterNames = new Set(cluster.symbols.map((s) => s.name))
    const clusterIds   = new Set(cluster.symbols.map((s) => safeId(s.name)))
    const fanIn        = classFanInIntraCluster(cluster)
    const isHub        = (name: string): boolean =>
        (fanIn.get(name) ?? 0) >= HUB_FAN_IN_THRESHOLD
    const hubSuffix    = (name: string): string =>
        isHub(name) ? HUB_SUFFIX : ""
    const hasAnyHub    = cluster.symbols.some((s) => isHub(s.name))
    /*  externals = heritage targets that live neither in this
        cluster nor in any other in-scope cluster  */
    const externals = new Set<string>()
    for (const s of cluster.symbols)
        for (const target of [ ...s.extends, ...s.implements ])
            if (!clusterNames.has(target) && !allInScopeSymbols.has(target))
                externals.add(target)
    const lines: string[] = [ "classDiagram" ]
    if (hasAnyHub)
        lines.push(`    ${CLASSDEF_HUB}`)
    if (externals.size > 0)
        lines.push(`    ${CLASSDEF_EXTERNAL}`)
    for (const s of cluster.symbols) {
        const idWithStyle = `${safeId(s.name)}${hubSuffix(s.name)}`
        if (s.kind === "interface") {
            lines.push(`    class ${idWithStyle} {`)
            lines.push("        <<interface>>")
            lines.push("    }")
        }
        else
            lines.push(`    class ${idWithStyle}`)
        for (const parent of s.extends)
            lines.push(`    ${safeId(parent)} <|-- ${safeId(s.name)}`)
        for (const iface of s.implements)
            lines.push(`    ${safeId(iface)} <|.. ${safeId(s.name)}`)
        const fromId = safeId(s.name)
        for (const r of s.references) {
            const refId = safeId(r)
            /*  emit a `..>` dependency edge only when the target is
                an in-cluster sibling, not the symbol itself, and not
                already covered by a heritage edge above  */
            if (refId !== fromId
                && clusterIds.has(refId)
                && !s.extends.includes(r)
                && !s.implements.includes(r))
                lines.push(`    ${fromId} ..> ${refId}`)
        }
    }
    for (const ext of [ ...externals ].sort()) {
        lines.push(`    class ${safeId(ext)}${EXTERNAL_SUFFIX} {`)
        lines.push("        <<external>>")
        lines.push("    }")
    }
    return lines.join("\n")
}
