/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  ApiJson assembly with deterministic ordering for the arch-report pipeline  */

import type { ApiJson, Cluster, Edge, Language, DocDebtEntry, UnresolvedRef } from "./types.js"

export interface RenderJsonInput {
    scope:      string
    languages:  Language[]
    clusters:   Cluster[]
    edges:      Edge[]
    docDebt:    DocDebtEntry[]
    unresolved: UnresolvedRef[]
}

const isoNow = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z")

export const renderJson = (input: RenderJsonInput): ApiJson => ({
    scope:       input.scope,
    generatedAt: isoNow(),
    languages:   [ ...input.languages ].sort(),
    clusters:    [ ...input.clusters ].sort((a, b) => a.name.localeCompare(b.name)),
    edges:       input.edges,
    docDebt:     input.docDebt,
    unresolved:  input.unresolved
})
