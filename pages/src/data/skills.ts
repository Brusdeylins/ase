/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  shared skill catalog: the single source of truth for the grouping and
    ordering of all ASE skills. Both the catalog grid in `Section-Usage.astro`
    (which arranges the groups into its own column layout) and the sidebar in
    `Modal-Help.astro` are driven by this list, so the two stay in sync (DRY).  */

export interface SkillGroup {
    label:  string
    skills: string[]
}

export const skillGroups: SkillGroup[] = [
    {
        label: "Standalone Mode 1/3",
        skills: [
            "ase-help-skill",
            "ase-help-intent",
            "ase-meta-config",
            "ase-meta-why",
            "ase-meta-eli5",
            "ase-meta-proximity",
            "ase-meta-quotes",
            "ase-meta-evaluate",
            "ase-meta-diaboli",
            "ase-meta-steelman",
            "ase-meta-quorum",
            "ase-meta-chat",
            "ase-meta-search",
            "ase-meta-brainstorm"
        ]
    },
    {
        label: "Standalone Mode 2/3",
        skills: [
            "ase-meta-compat",
            "ase-meta-mint",
            "ase-meta-workflow",
            "ase-arch-analyze",
            "ase-arch-discover",
            "ase-code-analyze",
            "ase-code-insight",
            "ase-code-explain",
            "ase-code-lint",
            "ase-docs-shorten",
            "ase-docs-refine",
            "ase-docs-proofread",
            "ase-docs-distill"
        ]
    },
    {
        label: "Standalone Mode 3/3",
        skills: [
            "ase-repo-review",
            "ase-repo-diff",
            "ase-repo-changelog",
            "ase-repo-commit",
            "ase-repo-dissect",
            "ase-repo-merge",
            "ase-repo-resolve"
        ]
    },
    {
        label: "Task Mode",
        skills: [
            "ase-task-id",
            "ase-task-edit",
            "ase-task-grill",
            "ase-task-research",
            "ase-task-reboot",
            "ase-task-implement",
            "ase-task-integrate",
            "ase-task-view",
            "ase-task-list",
            "ase-task-status",
            "ase-task-assign",
            "ase-task-rename",
            "ase-task-condense",
            "ase-task-dissect",
            "ase-task-estimate",
            "ase-task-delete"
        ]
    },
    {
        label: "Direct Mode",
        skills: [
            "ase-code-edit",
            "ase-spec-edit",
            "ase-spec-activate"
        ]
    },
    {
        label: "Sync Mode",
        skills: [
            "ase-sync-reconcile",
            "ase-sync-import",
            "ase-sync-export"
        ]
    }
]
