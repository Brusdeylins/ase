/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  methodology provenance: the classic, well-known reasoning and engineering
    methods ASE bakes into its skills, each mapped onto the very skill that
    implements it. `Methodology-Strip.astro` renders this list as a strip of
    chips whose `data-help-id` opens the man-page of the mapped skill in the
    shared help modal, exactly like the skill catalog entries do.  */

export type Method = {
    name:  string  /*  the classic method, under its established name  */
    note:  string  /*  what the method achieves, in a few words        */
    skill: string  /*  the ASE skill implementing the method           */
}

export const methods: Method[] = [
    { name: "Five-Whys",                note: "drill down to root cause",  skill: "ase-meta-why"        },
    { name: "YAGNI",                    note: "build for today only",      skill: "ase-code-craft"      },
    { name: "Steelman",                 note: "strengthen a thesis",       skill: "ase-meta-steelman"   },
    { name: "Devil's Advocate",         note: "challenge a thesis",        skill: "ase-meta-diaboli"    },
    { name: "Weighted Decision Matrix", note: "compare alternatives",      skill: "ase-meta-evaluate"   },
    { name: "ELI5",                     note: "explain it simply",         skill: "ase-meta-eli5"       },
    { name: "KISS",                     note: "keep design simple",        skill: "ase-code-craft"      },
    { name: "Rule of Three",            note: "abstract on third repeat",  skill: "ase-code-refactor"   },
    { name: "Boy Scout Rule",           note: "leave code cleaner",        skill: "ase-code-refactor"   },
    { name: "Coupling & Cohesion",      note: "focused parts, thin wires", skill: "ase-arch-analyze"    },
    { name: "Occam's Razor",            note: "smallest fix wins",         skill: "ase-code-resolve"    },
    { name: "Socratic Method",          note: "question until clear",      skill: "ase-task-grill"      },
    { name: "Diverge-Converge",         note: "widen ideas, then narrow",  skill: "ase-meta-brainstorm" },
    { name: "Delphi Method",            note: "consensus of many experts", skill: "ase-meta-quorum"     },
    { name: "Feynman Technique",        note: "explain it by analogy",     skill: "ase-code-explain"    },
    { name: "Inverted Pyramid",         note: "most important first",      skill: "ase-docs-distill"    },
    { name: "2x2 Matrix",               note: "sort along two dimensions", skill: "ase-meta-quotes"     },
    { name: "Ladder of Abstraction",    note: "move up and down topics",   skill: "ase-meta-proximity"  },
    { name: "Divide & Conquer",         note: "split an epic into parts",  skill: "ase-task-dissect"    },
    { name: "Atomic Commits",           note: "one purpose per commit",    skill: "ase-code-dissect"    },
    { name: "Dry Run",                  note: "rehearse before applying",  skill: "ase-task-preflight"  },
    { name: "Peer Review",              note: "judge diff before merge",   skill: "ase-meta-review"     },
    { name: "Round-Trip Engineering",   note: "keep artifacts in sync",    skill: "ase-sync-reconcile"  },
    { name: "Blast Radius",             note: "see what a change hits",    skill: "ase-meta-diff"       },
    { name: "Build vs. Buy",            note: "reuse or roll your own",    skill: "ase-arch-discover"   },
    { name: "Single Responsibility",    note: "one reason to change",      skill: "ase-code-craft"      },
    { name: "Code Smells",              note: "spot known bad patterns",   skill: "ase-code-lint"       },
    { name: "Big-O Analysis",           note: "cost of an algorithm",      skill: "ase-code-analyze"    },
    { name: "Code Churn",               note: "find the busiest files",    skill: "ase-code-insight"    },
    { name: "Decision Records (ADR)",   note: "capture the why",           skill: "ase-arch-analyze"    },
    { name: "Conventional Commits",     note: "type the commit subject",   skill: "ase-meta-commit"     },
    { name: "Pre-Mortem",               note: "imagine it already failed", skill: "ase-meta-diaboli"    }
]

