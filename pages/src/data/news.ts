/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  shared news catalog: the top-level `NEWS.md` of the repository, read at
    build time and arranged into releases (the "----" underlined headings),
    their sections (the "###" headings), and the items of the sections (the
    "**<Title>**: <Text>" bullet points). Both the "News" pull-down of the
    site header and the "News" page are driven by this list (DRY).  */

import fs         from "node:fs"
import path       from "node:path"
import { marked } from "marked"

export interface NewsItem {
    title: string   /*  bold lead-in of the bullet point, e.g. "Task Store"  */
    html:  string   /*  rendered remaining text of the bullet point          */
}

export interface NewsSection {
    kind:  string   /*  lower-case section kind, e.g. "features"   */
    label: string   /*  section heading, e.g. "Features"           */
    items: NewsItem[]
}

export interface NewsRelease {
    id:       string   /*  fragment id, e.g. "ase-1-0-to-ase-2-0"  */
    label:    string   /*  release heading, e.g. "ASE 1.0 to ASE 2.0"  */
    title:    string   /*  target release of heading, e.g. "ASE 2.0"   */
    intro:    string[] /*  rendered introductory paragraphs            */
    sections: NewsSection[]
}

/*  locate the news file relative to the `pages/` project root
    (`pages/etc/astro.config.mjs` runs from there).  */
const newsFile = path.resolve(process.cwd(), "..", "NEWS.md")

/*  turn an upper-case heading like "INCOMPATIBILITIES" into "Incompatibilities"  */
const capitalize = (text: string) =>
    text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()

/*  derive a fragment id from a heading  */
const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/*  walk the Markdown token stream: the level 1 heading ("NEWS") is skipped,
    a level 2 heading opens a release, a paragraph before its first section
    becomes its introduction, a level 3 heading opens a section, and
    every item of a list becomes an entry of the current section. The content
    is trusted, build-time, in-repo material, so it is rendered without an
    HTML sanitizer.  */
export const newsReleases: NewsRelease[] = []
for (const token of marked.lexer(fs.readFileSync(newsFile, "utf8"))) {
    const release = newsReleases.at(-1)
    const section = release?.sections.at(-1)
    if (token.type === "heading" && token.depth === 2)
        newsReleases.push({ id: slugify(token.text), label: token.text,
            title: token.text.replace(/^.*\s+to\s+/, ""), intro: [], sections: [] })
    else if (token.type === "paragraph" && release !== undefined && section === undefined)
        release.intro.push(marked.parseInline(token.text.replace(/\s*\n\s*/g, " ")) as string)
    else if (token.type === "heading" && token.depth === 3 && release !== undefined)
        release.sections.push({ kind: token.text.toLowerCase(), label: capitalize(token.text), items: [] })
    else if (token.type === "list" && section !== undefined) {
        for (const item of token.items) {
            const text = item.text.replace(/\s*\n\s*/g, " ")
            const m    = text.match(/^\*\*(.+?)\*\*:\s*(.*)$/)
            section.items.push(m ?
                { title: m[1], html: marked.parseInline(m[2]) as string } :
                { title: "",   html: marked.parseInline(text) as string })
        }
    }
}
