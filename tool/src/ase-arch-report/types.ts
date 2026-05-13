/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  shared types for the arch-report pipeline  */

export type Language =
    "java"   | "typescript" | "javascript" | "python" | "go"
    | "rust" | "kotlin"     | "csharp"     | "c"      | "cpp"

export type SymbolKind =
    "class"    | "interface" | "record"   | "enum" | "trait"
    | "struct" | "method"    | "function" | "field"

export type Modifier =
    "public" | "protected" | "private" | "internal" | "sealed" | "abstract" | "final"

export interface Member {
    name:      string
    kind:      SymbolKind
    signature: string
    doc:       string | null
    line:      number
}

export interface Symbol {
    fqn:        string
    name:       string
    kind:       SymbolKind
    modifiers:  Modifier[]
    extends:    string[]
    implements: string[]
    file:       string
    line:       number
    doc:        string | null
    members:    Member[]
}

export interface Edge {
    from:  string
    to:    string
    count: number
}

export interface Cluster {
    name:     string
    language: Language
    symbols:  Symbol[]
}

export interface ArchReportOpts {
    pathOrGlob: string
    lang:       Language | "auto"
    output:     string
    format:     "md" | "html" | "both"
    config?:    string
    queriesDir?: string
}

export interface ApiJson {
    scope:       string
    generatedAt: string
    languages:   Language[]
    clusters:    Cluster[]
    edges:       Edge[]
    docDebt:     { fqn: string, file: string, line: number }[]
    unresolved:  { ref: string, from: string }[]
}
