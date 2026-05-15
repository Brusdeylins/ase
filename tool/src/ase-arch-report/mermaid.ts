/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  small helpers for sanitising raw source-language signatures into a form
    that the Mermaid classDiagram parser will accept  */

import type { Modifier } from "./types.js"

const VISIBILITY_PREFIX = /^(public|private|protected|static|final|abstract|synchronized|default|native|volatile|transient|strictfp)\s+/

export const mermaidSafeSignature = (sig: string): string => {
    let s = sig.trim()
    /*  strip repeated leading modifier keywords  */
    while (true) {
        const next = s.replace(VISIBILITY_PREFIX, "")
        if (next === s)
            break
        s = next
    }
    /*  strip trailing semicolon  */
    s = s.replace(/;$/, "")
    /*  rewrite generics angle brackets into square brackets, iteratively
        from innermost to outermost so nested generics like
        `Map<Integer, Entry<String, Character>>` collapse cleanly into
        `Map[Integer, Entry[String, Character]]`.  The Mermaid classDiagram
        parser uses `~...~` for tilde-generics but cannot disambiguate
        nested or comma-bearing tilde sequences, so square brackets are
        used as a syntactically inert substitute that still preserves the
        type-parameter information visually.  */
    let prev
    do {
        prev = s
        s = s.replace(/<([^<>]*)>/g, "[$1]")
    } while (s !== prev)
    /*  drop any leftover unbalanced angle brackets (defensive: should not
        occur after the loop above, but keeps Mermaid output well-formed
        when the input contains stray comparison operators)  */
    s = s.replace(/[<>]/g, "")
    /*  collapse whitespace runs  */
    s = s.replace(/\s+/g, " ").trim()
    return s
}

/*  map a member's modifier set to the Mermaid classDiagram visibility
    prefix character.  Only `+` (public) and `#` (protected) are ever
    emitted because `private` members are filtered out upstream by the
    extractor; default (no explicit modifier) is treated as public,
    matching the visibility policy applied during extraction.  */
export const mermaidVisibilityPrefix = (modifiers: Modifier[]): string => {
    if (modifiers.includes("protected"))
        return "#"
    return "+"
}
