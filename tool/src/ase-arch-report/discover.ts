/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  file discovery + basename resolution for the arch-report pipeline  */

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
