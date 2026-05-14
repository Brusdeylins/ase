/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  full-depth sub-directory clustering for the arch-report pipeline  */

import path                              from "node:path"
import type { ArchSymbol, Cluster, Language } from "./types.js"

export const clusterize = (symbols: ArchSymbol[], scopeRoot: string, lang: Language): Cluster[] => {
    const groups = new Map<string, ArchSymbol[]>()
    for (const s of symbols) {
        const rel = path.relative(scopeRoot, path.dirname(s.file))
        const key = rel === "" ? "." : rel
        const arr = groups.get(key) ?? []
        arr.push(s)
        groups.set(key, arr)
    }
    const out: Cluster[] = []
    for (const [name, syms] of groups) {
        syms.sort((a, b) => a.fqn.localeCompare(b.fqn))
        out.push({ name, language: lang, symbols: syms })
    }
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
}
