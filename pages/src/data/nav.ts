/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  the site navigation: one entry per top-level page, in the very order the
    site header lists them. Each entry doubles as the metadata record of its
    page route, so route path, nav label, browser title, and meta description
    are kept in a single place.  */

import { site } from "./site.ts"

export interface NavItem {
    path:        string  /*  route path of the page (with trailing slash)  */
    label:       string  /*  label shown in the site header navigation     */
    title:       string  /*  browser title of the page                     */
    description: string  /*  meta description of the page                  */
}

/*  a bare link entry, carrying no page metadata of its own: either a section
    of a page, addressed by the fragment of its route path ("/foo/bar/#quux"),
    or an external target ("https://...")  */
export interface NavSection {
    path:        string  /*  route path of the section, or external URL  */
    label:       string  /*  label shown in the site header navigation   */
}

/*  a group of entries, shown in the site header as a single label opening a
    pull-down menu with its members. The label is either a page (or external
    target) of its own or, with `page` left out, a bare entry which cannot be
    selected at all.  */
export interface NavGroup {
    label:       string                    /*  label shown in the site header navigation  */
    page?:       NavItem | NavSection      /*  the target of the label itself, if any     */
    items:       (NavItem | NavSection)[]  /*  the entries of the pull-down menu          */
}

/*  a header navigation entry is either a plain page or a group of entries  */
export type NavEntry = NavItem | NavGroup

/*  distinguish a group entry from a plain page entry  */
export const isNavGroup = (entry: NavEntry): entry is NavGroup =>
    (entry as NavGroup).items !== undefined

/*  distinguish a page entry from a bare section entry  */
export const isNavPage = (entry: NavItem | NavSection): entry is NavItem =>
    "title" in entry

/*  the main navigation entries, shown as the left-hand header group  */
export const navItems: NavEntry[] = [
    { label:       "Home",
      page:        { path:        "/",
                     label:       "Home",
                     title:       "Home",
                     description: "ASE" },
      items: [
          { path: "/#overview",     label: "Overview"     },
          { path: "/#testimonials", label: "Testimonials" },
          { path: "/#fit",          label: "Fit Check"    }
      ] },
    { label:       "Highlights",
      page:        { path:        "/highlights/",
                     label:       "Highlights",
                     title:       "Highlights",
                     description: "The highlights of ASE, each shown in a short screencast, boosting the " +
                                  "recurring work-steps of industrial Software Engineering." },
      items: [
          { path: "/highlights/#productivity", label: "Productivity Difference" },
          { path: "/highlights/#previews",     label: "Skill Sneak Previews"    }
      ] },
    { label:       "Setup",
      page:        { path:        "/setup/",
                     label:       "Setup",
                     title:       "Setup",
                     description: "Prerequisites, install, update, and uninstall commands for the ASE CLI and " +
                                  "its agent tool plugin, the available ASE configuration parameters, and the " +
                                  "known agent harness and LLM compatibility." },
      items: [
          { path: "/setup/#installation",  label: "Installation"  },
          { path: "/setup/#statusline",    label: "Statusline" },
          { path: "/setup/#services",      label: "Addon Services"   },
          { path: "/setup/#configuration", label: "Configuration" },
          { path: "/setup/#compat",        label: "Compatibility" }
      ] },
    { label:       "Usage",
      page:        { path:        "/usage/",
                     label:       "Usage",
                     title:       "Usage",
                     description: "How to get started with ASE: the intent-driven way into the skills, plus the " +
                                  "full skill catalog with its online manual pages." },
      items: [
          { path: "/usage/#getstarted", label: "Get Started"    },
          { path: "/usage/#overview",   label: "Skill Overview" },
          { path: "/usage/#deepdive",   label: "Skill Deep-Dive" }
      ] },
    { label:       "Workflows",
      page:        { path:        "/workflows/",
                     label:       "Workflows",
                     title:       "Workflows",
                     description: "The ASE operation modes shown as concrete Claude Code CLI transcripts, " +
                                  "followed by a day in the life of an engineer working with ASE." },
      items: [
          { path: "/workflows/#operation-modes",       label: "Operation Modes" },
          { path: "/workflows/#development-workflows", label: "Development Workflows" },
          { path: "/workflows/#engineering-session",   label: "Engineering Session"   }
      ] },
    /*
    { label:       "Use Cases",
      items: [
          { path:        "/usecases/technology-stack/",
            label:       "Technology Stack",
            title:       "Use Case: Technology Stack",
            description: "How to establish and evolve the technology stack of a project with ASE, " +
                         "from discovering components to reconciling the resulting artifacts." },
          { path:        "/usecases/crafting-feature/",
            label:       "Crafting Feature",
            title:       "Use Case: Crafting Feature",
            description: "How to craft a new feature with ASE, from the initial task plan over the " +
                         "implementation to the review of the resulting change set." }
      ] },
    */
    { label:       "Design",
      page:        { path:        "/design/",
                     label:       "Design",
                     title:       "Design Decisions",
                     description: "The philosophy behind ASE, the assumptions it is based on, the four design " +
                                  "decisions derived from them, the named Software Engineering methods ASE " +
                                  "builds upon, and the architecture resulting from them." },
      items: [
          { path: "/design/#philosophy",   label: "Philosophy"   },
          { path: "/design/#assumptions",  label: "Assumptions"  },
          { path: "/design/#decisions",    label: "Decisions"    },
          { path: "/design/#methodology",  label: "Methodology"  },
          { path: "/design/#architecture", label: "Architecture" }
      ] },
]

/*  the author entry, shown separately in the right-hand header group  */
export const navAuthor: NavGroup = {
    label:       "Author",
    page:        { path:        "/author/",
                   label:       "Author",
                   title:       "Author",
                   description: "About Dr. Ralf S. Engelschall, the author of ASE, plus the contributors " +
                                "and supporting organizations behind the toolkit." },
    items: [
        { path: "/author/#author",       label: "Author"       },
        { path: "/author/#contributors", label: "Contributors" },
        { path: "/author/#sponsors",     label: "Sponsors"     }
    ]
}

/*  the project entry, shown at the very end of the right-hand header group.
    Its label leads directly to the project repository, as does the first
    entry of its pull-down menu.  */
export const navProject: NavGroup = {
    label:       "Project",
    page:        { path:  site.repo,
                   label: "Project" },
    items: [
        { path:  site.repo,
          label: "Repository" },
        { path:        "/project/",
          label:       "Sibling Projects",
          title:       "Sibling Projects",
          description: "The sibling projects accompanying ASE, which together form a larger toolkit for " +
                       "combining Agentic AI Coding with traditional Software Engineering." }
    ]
}

/*  all page entries, with the grouped ones flattened into the top-level list
    and the bare link entries of the pull-down menus left out  */
export const navPages: NavItem[] = [ ...navItems, navAuthor, navProject ]
    .flatMap((entry) => !isNavGroup(entry) ? [ entry ] : [
        ...(entry.page !== undefined && isNavPage(entry.page) ? [ entry.page ] : []),
        ...entry.items.filter(isNavPage)
    ])

/*  look up a navigation entry by its route path  */
export const navItem = (path: string): NavItem => {
    const item = navPages.find((item) => item.path === path)
    if (item === undefined)
        throw new Error(`no navigation entry for route path "${path}"`)
    return item
}
