/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  file discovery + basename resolution for the arch-report pipeline  */

import fs                                from "node:fs/promises"
import path                              from "node:path"
import { glob }                          from "glob"
import type { Language }                 from "./types.js"

const EXT_TO_LANG: Record<string, Language> = {
    ".java":  "java",
    ".ts":    "typescript",
    ".tsx":   "typescript",
    ".js":    "javascript",
    ".jsx":   "javascript",
    ".mjs":   "javascript",
    ".cjs":   "javascript",
    ".py":    "python",
    ".go":    "go",
    ".rs":    "rust",
    ".kt":    "kotlin",
    ".kts":   "kotlin",
    ".cs":    "csharp",
    ".c":     "c",
    ".h":     "c",
    ".cpp":   "cpp",
    ".cc":    "cpp",
    ".cxx":   "cpp",
    ".hpp":   "cpp",
    ".hh":    "cpp"
}

export interface DiscoverResult {
    basename: string
    files:    Partial<Record<Language, string[]>>
}

export const resolveBasename = (pathOrGlob: string): string => {
    const cut = pathOrGlob.search(/[*?[]/)
    const prefix = cut < 0 ? pathOrGlob : pathOrGlob.slice(0, cut)
    const trimmed = prefix.replace(/\/+$/, "")
    return path.basename(trimmed) || "report"
}

export const discover = async (pathOrGlob: string, langFilter: Language | "auto"): Promise<DiscoverResult> => {
    const isGlob = /[*?[]/.test(pathOrGlob)
    const pattern = isGlob ? pathOrGlob : path.join(pathOrGlob, "**/*")
    const matches = await glob(pattern, { nodir: true, absolute: true })
    const files: Partial<Record<Language, string[]>> = {}
    for (const f of matches) {
        const ext = path.extname(f).toLowerCase()
        const lang = EXT_TO_LANG[ext]
        if (lang === undefined)
            continue
        if (langFilter !== "auto" && lang !== langFilter)
            continue
        files[lang] ??= []
        files[lang]!.push(f)
    }
    for (const lang of Object.keys(files) as Language[])
        files[lang]!.sort()
    return { basename: resolveBasename(pathOrGlob), files }
}

/*  Project-root marker files used to bound auto-scope expansion.
    Walk upward from the user's scope root until we hit a directory
    that carries one of these markers; that directory is the widest
    place we are willing to look for source files that the in-scope
    code happens to reference but the user did not explicitly
    include.  Capped at 6 ancestors to avoid scanning $HOME on
    misconfigured invocations.  */
const PROJECT_ROOT_MARKERS = [
    "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
    "package.json", "tsconfig.json",
    "pyproject.toml", "setup.py",
    "go.mod", "Cargo.toml",
    "CMakeLists.txt", "Makefile",
    ".git"
]
const MAX_DISCOVERY_ASCENT = 6

const fileExists = async (p: string): Promise<boolean> => {
    try {
        await fs.access(p)
        return true
    }
    catch {
        return false
    }
}

/*  Walk upward from `scopeRoot` looking for a directory that
    carries any of the known project-root markers.  Returns the
    nearest such ancestor; falls back to the original scope root
    when no marker is found within the ascent cap so auto-expand
    is a no-op rather than a surprise.  */
export const findDiscoveryRoot = async (scopeRoot: string): Promise<string> => {
    let dir = path.resolve(scopeRoot)
    for (let i = 0; i < MAX_DISCOVERY_ASCENT; i++) {
        for (const marker of PROJECT_ROOT_MARKERS)
            if (await fileExists(path.join(dir, marker)))
                return dir
        const parent = path.dirname(dir)
        if (parent === dir)
            break
        dir = parent
    }
    return scopeRoot
}

/*  Find candidate source files for a set of *simple* type names
    (e.g. "IneligibilityReason") within `discoveryRoot`.  Per
    convention in most one-class-per-file languages (Java, TS,
    Kotlin, C#, Python via PascalCase), the type sits in a file
    of the same basename.  Languages that pack many types per
    file (Go, Rust, C, C++) are intentionally skipped because the
    basename heuristic produces too many false positives there —
    the original symbol simply remains unresolved for those.

    `excludePrefix` is the user's primary scope (already
    extracted in pass 1); files inside it are filtered out so
    pass 2 only adds *new* sources.

    `langFilter` matches the primary-scope language filter so we
    do not pull in cross-language siblings (TS file with a Java
    interface name etc.).  When `langFilter` is "auto" every
    discovered file is kept regardless of language.  */
const BASENAME_MATCHED_EXTS = [ ".java", ".ts", ".tsx", ".kt", ".cs", ".py" ]
export const findFilesByTypeNames = async (
    discoveryRoot: string,
    names: Iterable<string>,
    excludePrefix: string,
    langFilter: Language | "auto"
): Promise<Partial<Record<Language, string[]>>> => {
    const wanted = new Set<string>()
    for (const n of names)
        if (n.length > 0)
            wanted.add(n)
    if (wanted.size === 0)
        return {}
    const pattern  = path.join(discoveryRoot, "**/*")
    const matches  = await glob(pattern, { nodir: true, absolute: true })
    const excludeAbs = path.resolve(excludePrefix)
    const files: Partial<Record<Language, string[]>> = {}
    for (const f of matches) {
        const ext = path.extname(f).toLowerCase()
        if (!BASENAME_MATCHED_EXTS.includes(ext))
            continue
        const lang = EXT_TO_LANG[ext]
        if (lang === undefined)
            continue
        if (langFilter !== "auto" && lang !== langFilter)
            continue
        /*  basename without extension == simple type name in
            one-class-per-file convention  */
        const stem = path.basename(f, ext)
        if (!wanted.has(stem))
            continue
        /*  do not re-include files already in the primary scope  */
        if (path.resolve(f).startsWith(excludeAbs + path.sep))
            continue
        files[lang] ??= []
        files[lang]!.push(f)
    }
    for (const lang of Object.keys(files) as Language[])
        files[lang]!.sort()
    return files
}
