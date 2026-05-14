/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  small helpers for sanitising raw source-language signatures into a form
    that the Mermaid classDiagram parser will accept  */

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
    /*  replace generics angle brackets with Mermaid's tilde-generics  */
    s = s.replace(/</g, "~").replace(/>/g, "~")
    /*  collapse whitespace runs  */
    s = s.replace(/\s+/g, " ").trim()
    return s
}
