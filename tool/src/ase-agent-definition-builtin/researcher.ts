/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { AgentKind } from "../ase-agent-definition-core.js"

/*  agent "ase agent researcher"  */
export default {
    kind: "researcher",
    description:
        "Process the research requests of tasks in any task lifecycle model, as requested with key " +
        "\"R\" on the task board: claim every task tagged with \"ase-agent-research:pending\" " +
        "(except in an activity status, until it changes) by turning its oldest \"research\" " +
        "attachment into \"research-running\" and assigning the task to the agent (keeping all " +
        "other agents off it), research the topic of the prompt of the request (or, for an empty " +
        "prompt, the task plan itself) on the Web and in the source artifacts via the headless " +
        "agent tool and the \"ase-task-research\" skill (grounded in its \"Source:\", a " +
        "\"branch:\" one checked out in a temporary Git worktree), append the research report to " +
        "the \"research\" attachment of the task and refine its plan by the recommendations " +
        "(saved only if not changed meanwhile), restore its previous assignee, and remove the " +
        "request if the research was attached (else turn it into \"research-failed\", or back into " +
        "\"research\" on interrupt), logging to stdout and to the \"agent:researcher\" attachment of the task",
    modeDesc: "",
    mode: "research",
    modes: {
        /*  research the topic of the prompt of the request in the working copy, grounded in the
            "Source:" of the task: a "worktree" one in the working copy itself, and a "branch:"
            one in a temporary, detached Git worktree of the branch (passed to the skill and the
            agent tool), which is removed afterwards, where the prompt is optional (as an empty
            one researches the task plan itself), and where the processing succeeded only if the
            research attachment was created or changed and the skill reported the attached research  */
        research: {
            title:     "Research topics for tasks on request",
            description:
                "Claims every task with a pending research request (requested with key R on the task " +
                "boards) in any status except an activity one. Researches the topic of the prompt (or, " +
                "without a prompt, the task plan itself) on the Web and in the source artifacts via the " +
                "ase-task-research skill, appends the report to its research attachment, refines its plan " +
                "by the recommendations, and restores its previous assignee.",
            type:      "request",
            workdir:   "source",
            request:   { name: "research", done: "researched" },
            prompt:    {
                skill: "ase-task-research",
                args:  "--refine{?source-dir: --int-source-dir \"{source-dir}\"} {id}:{?prompt: {prompt}}"
            },
            attach:    { expect: "text/markdown;research" },
            success:   { criterion: [ "exit", "clean", "attachment" ], match: [ "status:\\W*research attached\\b" ] }
        }
    }
} satisfies AgentKind

