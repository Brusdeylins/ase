/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  shared terminology catalog: the sibling `terminology.md`, imported raw at
    build time and arranged into its definitions (the "Definition: **<Term>**:"
    bullet points). The "Terminology" page is driven by this list (DRY).  */

import { marked } from "marked"
import termText   from "./terminology.md?raw"

export interface TermDefinition {
    no:   number   /*  1-based position in `terminology.md`  */
    id:   string   /*  fragment id, e.g. "software-agent"     */
    term: string   /*  defined term, e.g. "Software Agent"   */
    html: string   /*  rendered definition text              */
}

/*  derive a fragment id from a term, e.g. "Artificial Intelligence (AI)"
    into "artificial-intelligence"  */
const slugify = (text: string) =>
    text.replace(/\s*\(.*?\)/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/*  walk the Markdown token stream: the level 1 heading ("Terminology") is
    skipped, and every item of a list becomes a definition. The definition
    texts are kept raw until all terms are known, as they may reference any
    of them.  */
const raw: { no: number, id: string, term: string, text: string }[] = []
for (const token of marked.lexer(termText)) {
    if (token.type !== "list")
        continue
    for (const item of token.items) {
        const m = item.text.trim().match(/^Definition:\s*\*\*(.+?)\*\*:\s*(?:<br\s*\/?>)?\s*([\s\S]*)$/)
        if (m === null)
            throw new Error(`invalid definition in "terminology.md": "${item.text}"`)
        raw.push({ no: raw.length + 1, id: slugify(m[1]), term: m[1], text: m[2].replace(/\s*\n\s*/g, " ") })
    }
}

/*  map every term onto its fragment id, under its full name, its name without
    the parenthesized abbreviation, and the abbreviation alone, e.g. for
    "Artificial Intelligence (AI)" also "Artificial Intelligence" and "AI"  */
const aliases = new Map<string, string>()
for (const def of raw) {
    aliases.set(def.term, def.id)
    aliases.set(def.term.replace(/\s*\(.*?\)/g, ""), def.id)
    const abbrev = def.term.match(/\((.+?)\)/)
    if (abbrev !== null)
        aliases.set(abbrev[1], def.id)
}

/*  render the definitions, with every bold reference to another term (also
    in its plural form, like "**AI Agents**") turned into a link to the
    definition of that term. The content is trusted, build-time, in-repo
    material, so it is rendered without an HTML sanitizer.  */
export const termDefinitions: TermDefinition[] = raw.map((def) => {
    const text = def.text.replace(/\*\*(.+?)\*\*/g, (match, ref: string) => {
        const id = aliases.get(ref) ?? aliases.get(ref.replace(/s$/, ""))
        return id !== undefined && id !== def.id ? `[**${ref}**](#${id})` : match
    })
    return { no: def.no, id: def.id, term: def.term, html: marked.parseInline(text) as string }
})

