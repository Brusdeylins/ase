/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  resolve TSDoc/JSDoc `{@inheritDoc}` placeholders in symbol and member
    docs by walking each symbol's `extends` and `implements` chains across
    all clusters and substituting the inherited description.  Both the
    bare `{@inheritDoc}` form (inherit from the first overridden parent)
    and the qualified `{@inheritDoc Foo.bar}` / `{@inheritDoc Foo#bar}`
    form (inherit from a named symbol/member) are supported.  When no
    inherited doc can be found the placeholder is dropped silently.  */

import type { Cluster, ArchSymbol, ArchMember } from "./types.js"

const INHERIT_DOC_TAG = /\{?@inheritDoc(?:\s+([^\s}]+))?\}?/g

const MAX_DEPTH = 8

const lookupMemberDoc = (
    target: string | undefined, sym: ArchSymbol, memberName: string,
    symMap: Map<string, ArchSymbol>, depth: number
): string | null => {
    if (target !== undefined) {
        const [ typeName, memberRef ] = target.split(/[.#]/)
        const parent = symMap.get(typeName)
        if (parent === undefined)
            return null
        const refName = memberRef ?? memberName
        const pm = parent.members.find((mm) => mm.name === refName)
        if (pm === undefined || pm.doc === null)
            return null
        return resolveDoc(pm.doc, parent, pm, symMap, depth + 1)
    }
    const parents = [ ...sym.extends, ...sym.implements ]
    for (const p of parents) {
        const parent = symMap.get(p)
        if (parent === undefined)
            continue
        const pm = parent.members.find((mm) => mm.name === memberName)
        if (pm !== undefined && pm.doc !== null)
            return resolveDoc(pm.doc, parent, pm, symMap, depth + 1)
        const inherited = lookupMemberDoc(undefined, parent, memberName, symMap, depth + 1)
        if (inherited !== null)
            return inherited
    }
    return null
}

const lookupSymbolDoc = (
    target: string | undefined, sym: ArchSymbol,
    symMap: Map<string, ArchSymbol>, depth: number
): string | null => {
    if (target !== undefined) {
        const parent = symMap.get(target)
        if (parent === undefined || parent.doc === null)
            return null
        return resolveDoc(parent.doc, parent, null, symMap, depth + 1)
    }
    const parents = [ ...sym.extends, ...sym.implements ]
    for (const p of parents) {
        const parent = symMap.get(p)
        if (parent === undefined)
            continue
        if (parent.doc !== null)
            return resolveDoc(parent.doc, parent, null, symMap, depth + 1)
        const inherited = lookupSymbolDoc(undefined, parent, symMap, depth + 1)
        if (inherited !== null)
            return inherited
    }
    return null
}

const resolveDoc = (
    doc: string, sym: ArchSymbol, mem: ArchMember | null,
    symMap: Map<string, ArchSymbol>, depth: number
): string => {
    if (depth > MAX_DEPTH)
        return doc.replace(INHERIT_DOC_TAG, "").replace(/\s+/g, " ").trim()
    const out = doc.replace(INHERIT_DOC_TAG, (_match, target?: string) => {
        const replacement = mem !== null ?
            lookupMemberDoc(target, sym, mem.name, symMap, depth) :
            lookupSymbolDoc(target, sym, symMap, depth)
        return replacement ?? ""
    })
    return out.replace(/\s+/g, " ").trim()
}

export const resolveInheritDocs = (clusters: Cluster[]): void => {
    /*  index every symbol both by FQN and by short name so qualified refs
        like `{@inheritDoc Foo.bar}` resolve regardless of cluster boundary;
        FQN takes precedence on collision  */
    const symMap = new Map<string, ArchSymbol>()
    for (const c of clusters)
        for (const s of c.symbols) {
            symMap.set(s.fqn, s)
            if (!symMap.has(s.name))
                symMap.set(s.name, s)
        }
    for (const c of clusters)
        for (const s of c.symbols) {
            if (s.doc !== null && /@inheritDoc/.test(s.doc)) {
                const resolved = resolveDoc(s.doc, s, null, symMap, 0)
                s.doc = resolved.length === 0 ? null : resolved
            }
            for (const m of s.members) {
                if (m.doc === null)
                    continue
                if (!/@inheritDoc/.test(m.doc))
                    continue
                const resolved = resolveDoc(m.doc, s, m, symMap, 0)
                m.doc = resolved.length === 0 ? null : resolved
            }
        }
}
