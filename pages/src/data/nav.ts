/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  the site navigation: one entry per top-level page, in the very order the
    site header lists them. Each entry doubles as the metadata record of its
    page route, so route path, nav label, browser title, and meta description
    are kept in a single place.  */

export interface NavItem {
    path:        string  /*  route path of the page (with trailing slash)  */
    label:       string  /*  label shown in the site header navigation     */
    title:       string  /*  browser title of the page                     */
    description: string  /*  meta description of the page                  */
}

/*  the main navigation entries, shown as the left-hand header group  */
export const navItems: NavItem[] = [
    { path:        "/highlights/",
      label:       "Highlights",
      title:       "Highlights",
      description: "The highlights of ASE, each shown in a short screencast, boosting the " +
                   "recurring work-steps of industrial Software Engineering." },
    { path:        "/setup/",
      label:       "Setup",
      title:       "Setup",
      description: "Prerequisites, install, update, and uninstall commands for the ASE CLI and " +
                   "its agent tool plugin, plus the available ASE configuration parameters." },
    { path:        "/usage/",
      label:       "Usage",
      title:       "Usage",
      description: "How to get started with ASE: the intent-driven way into the skills, plus the " +
                   "full skill catalog with its online manual pages." },
    { path:        "/workflows/",
      label:       "Workflows",
      title:       "Workflows",
      description: "The ASE operation modes shown as concrete Claude Code CLI transcripts, " +
                   "followed by a day in the life of an engineer working with ASE." },
    { path:        "/philosophy/",
      label:       "Philosophy",
      title:       "Philosophy",
      description: "The philosophy behind ASE: the Agentic AI Level model and its sweet spot, " +
                   "the split into skills and workflows, and the resulting operation modes." },
    { path:        "/design/",
      label:       "Design",
      title:       "Design Decisions",
      description: "The assumptions behind ASE, the four design decisions derived from them, " +
                   "and the named Software Engineering methods ASE builds upon." },
    { path:        "/architecture/",
      label:       "Architecture",
      title:       "Architecture",
      description: "The architecture of ASE: the hooks, skills, MCP service, and CLI building " +
                   "blocks and the way they interlock inside the agent tool." },
    { path:        "/compat/",
      label:       "Compatibility",
      title:       "Compatibility",
      description: "The known compatibility of ASE with the supported agent harnesses " +
                   "(Anthropic Claude Code CLI, GitHub Copilot CLI, OpenAI Codex CLI) and LLMs." }
]

/*  the author entry, shown separately in the right-hand header group  */
export const navAuthor: NavItem = {
    path:        "/author/",
    label:       "Author",
    title:       "Author",
    description: "About Dr. Ralf S. Engelschall, the author of ASE, plus the contributors, " +
                 "supporting organizations, and sibling projects behind the toolkit."
}

/*  look up a navigation entry by its route path  */
export const navItem = (path: string): NavItem => {
    const item = [ ...navItems, navAuthor ].find((item) => item.path === path)
    if (item === undefined)
        throw new Error(`no navigation entry for route path "${path}"`)
    return item
}
