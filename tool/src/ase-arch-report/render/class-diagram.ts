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
    - a `<<hub>>` stereotype on classes whose intra-cluster fan-in
      reaches the hub threshold (load-bearing classes).  Stacks
      with any other stereotype the class already carries so an
      interface hub renders both `<<interface>>` and `<<hub>>`
      and a nested hub renders both `<<inner>>` and `<<hub>>`.
      CSS-based highlighting (`style …`, `classDef …`) is
      deliberately avoided — Mermaid v11.15's classDiagram
      parser rejects every hyphenated CSS property name, so
      multi-stereotype is the only reliably-parsing visual cue.
    - dashed `<<external>>` ghost classes for heritage targets
      that live outside every in-scope cluster (so structural
      relationships to sibling packages stay visible even when
      the chosen scope is narrow)
    - nested (lexically-inner) types grouped under a per-parent
      `namespace OuterFqn["Outer (nested types)"] { ... }` box
      so the reader sees them as members of their enclosing scope
      rather than as free-floating top-level classes; each nested
      class additionally carries the `<<inner>>` stereotype as a
      cross-renderer hint that this class has no own source file

    Single source of truth — any styling tweak or workaround for
    Mermaid grammar quirks (see render/styles.ts) only needs to
    land here, not in two duplicate copies under html.ts / md.ts.  */

import type { ArchSymbol, Cluster }  from "../types.js"
import { safeId }                    from "./util.js"
import { classFanInIntraCluster }    from "../metrics/hubs.js"
import { HUB_FAN_IN_THRESHOLD }      from "./styles.js"

export const buildClassDiagram = (
    cluster: Cluster, allInScopeSymbols: Set<string>
): string => {
    const clusterNames = new Set(cluster.symbols.map((s) => s.name))
    const fanIn        = classFanInIntraCluster(cluster)
    const isHub        = (name: string): boolean =>
        (fanIn.get(name) ?? 0) >= HUB_FAN_IN_THRESHOLD
    /*  bare-name → set of in-cluster FQNs.  Used to resolve heritage
        and reference targets (which are emitted by extract.ts as
        bare type names) to the diagram node id.  A unique match
        rewrites the id to its FQN form so nested types with the
        same simple name as a top-level class do not collide; an
        ambiguous or missing match falls back to the bare-name id.  */
    const nameToFqns = new Map<string, string[]>()
    for (const s of cluster.symbols) {
        const arr = nameToFqns.get(s.name) ?? []
        arr.push(s.fqn)
        nameToFqns.set(s.name, arr)
    }
    const idForName = (name: string): string => {
        const fqns = nameToFqns.get(name)
        if (fqns !== undefined && fqns.length === 1)
            return safeId(fqns[0])
        return safeId(name)
    }
    const clusterIds = new Set(cluster.symbols.map((s) => safeId(s.fqn)))
    /*  externals = heritage targets that live neither in this
        cluster nor in any other in-scope cluster  */
    const externals = new Set<string>()
    for (const s of cluster.symbols)
        for (const target of [ ...s.extends, ...s.implements ])
            if (!clusterNames.has(target) && !allInScopeSymbols.has(target))
                externals.add(target)
    /*  partition into top-level vs nested.  Top-level symbols
        render outside any namespace box; nested ones are grouped
        under a per-parent namespace block keyed by enclosingFqn.  */
    const topLevel: ArchSymbol[] = []
    const nestedByParent = new Map<string, ArchSymbol[]>()
    for (const s of cluster.symbols)
        if (s.enclosingFqn === null)
            topLevel.push(s)
        else {
            const arr = nestedByParent.get(s.enclosingFqn) ?? []
            arr.push(s)
            nestedByParent.set(s.enclosingFqn, arr)
        }
    const lines: string[] = [ "classDiagram" ]
    /*  Emit a single class block — declaration plus an optional
        single-line annotation that bundles every applicable
        stereotype.  Mermaid v11.15's classDiagram parser accepts
        exactly one `<<…>>` per class body, so we comma-join the
        active markers (`<<interface, hub>>`, `<<inner, hub>>`,
        etc.) rather than stacking multiple annotation lines —
        which would either be silently overwritten or trigger a
        parse error depending on the Mermaid build.  Caller
        decides indent depth so the same helper serves top-level
        and inside-namespace contexts.  */
    const emitClass = (s: ArchSymbol, indent: string): void => {
        const id = safeId(s.fqn)
        const stereotypes: string[] = []
        if (s.kind === "interface")
            stereotypes.push("interface")
        if (s.enclosingFqn !== null)
            stereotypes.push("inner")
        if (isHub(s.name))
            stereotypes.push("hub")
        if (stereotypes.length === 0) {
            lines.push(`${indent}class ${id}`)
            return
        }
        lines.push(`${indent}class ${id} {`)
        lines.push(`${indent}    <<${stereotypes.join(", ")}>>`)
        lines.push(`${indent}}`)
    }
    /*  Render outers without nested children standalone at top
        level; for each outer that DOES have nested children,
        wrap the outer AND its children together in a single
        namespace box so the structural unit reads as one piece
        rather than being split into a standalone class + a
        separate scope box (which the user reads as "torn
        apart").

        Mermaid v11.15's classDiagram does NOT support the
        `name["display label"]` bracket syntax that flowchart's
        `subgraph` provides (Mermaid issue #7618), so the
        namespace name itself is the box title.  Critically, the
        namespace id MUST NOT collide with any class id inside
        the diagram — putting the outer class into its own
        eponymous namespace would have dagre register the id as
        a class shape first and then crash inside `insertCluster`
        with `Gs[c] is not a function` because the cluster-shape
        registry has no entry under the "class" key.  We sidestep
        the clash by suffixing the namespace id with `_scope`;
        the box title therefore reads e.g. "Outer_scope", which
        is the only reliably-rendering form until upstream lands
        a real label feature.  */
    const topLevelByFqn = new Map(topLevel.map((s) => [ s.fqn, s ]))
    const usedAsOuter = new Set<string>()
    for (const s of topLevel) {
        if (!nestedByParent.has(s.fqn)) {
            emitClass(s, "    ")
            continue
        }
        const outerLabel = s.fqn.split(".").pop() ?? s.fqn
        lines.push(`    namespace ${safeId(outerLabel)}_scope {`)
        emitClass(s, "        ")
        for (const child of nestedByParent.get(s.fqn)!)
            emitClass(child, "        ")
        lines.push("    }")
        usedAsOuter.add(s.fqn)
    }
    /*  Orphan parents: nested types whose enclosing fqn is not
        itself in the cluster (e.g. deeper-than-one-level nesting
        where the immediate parent is also nested and therefore
        not in the top-level set).  Render their nested members
        in their own namespace so they still appear grouped — no
        outer class to include in the box.  */
    for (const parentFqn of [ ...nestedByParent.keys() ].sort()) {
        if (usedAsOuter.has(parentFqn) || topLevelByFqn.has(parentFqn))
            continue
        const orphanLabel = parentFqn.split(".").pop() ?? parentFqn
        lines.push(`    namespace ${safeId(orphanLabel)}_scope {`)
        for (const child of nestedByParent.get(parentFqn)!)
            emitClass(child, "        ")
        lines.push("    }")
    }
    /*  Edges (heritage + references) — emitted at top level after
        all classes are declared.  Mermaid 11 resolves edge
        endpoints across namespace boundaries by id, so an edge
        between an outer class and a nested one renders correctly
        as long as both ids have been declared above.  */
    for (const s of cluster.symbols) {
        const fromId = safeId(s.fqn)
        for (const parent of s.extends)
            lines.push(`    ${idForName(parent)} <|-- ${fromId}`)
        for (const iface of s.implements)
            lines.push(`    ${idForName(iface)} <|.. ${fromId}`)
        for (const r of s.references) {
            const refId = idForName(r)
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
    /*  Group every `<<external>>` ghost into a single namespace
        box so the externals cluster together visually instead of
        floating in the middle of the chart between in-cluster
        classes.  Because in-cluster classes draw heritage edges
        TO externals (extends / implements with the parent on the
        right), dagre's layered layout naturally places the
        externals_scope cluster at the top of the diagram —
        Mermaid renders parents above children for `<|--` /
        `<|..` relations.  */
    if (externals.size > 0) {
        lines.push("    namespace externals_scope {")
        for (const ext of [ ...externals ].sort()) {
            lines.push(`        class ${safeId(ext)} {`)
            lines.push("            <<external>>")
            lines.push("        }")
        }
        lines.push("    }")
    }
    return lines.join("\n")
}
