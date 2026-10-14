/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { AgentDefinition }     from "../ase-agent-definition-api.js"
import type { AgentKind }           from "../ase-agent-definition-core.js"

/*  integrate the changeset of the task into its target by the Git operation <mode>, where
    the skill itself puts the task into "INTEGRATED" on success, so the task counts as
    integrated on the "plan integrated" status of the skill only (else it is deferred), and
    where the tasks are processed serially only, as merges into the same target branch
    cannot run concurrently  */
const integrate = (mode: string): AgentDefinition => ({
    type:      "phase",
    lifecycle: "enterprise",
    serial:    true,
    workdir:   "target",
    state:     { incoming: "APPROVED", activity: "INTEGRATING", success: "INTEGRATED", failure: "DEFERRED", passed: "INTEGRATED" },
    tag:       { name: "ase-agent-integrator" },
    prompt:    {
        skill: "ase-task-integrate",
        args:  `--next DONE --mode ${mode}{?changeset-worktree: --worktree {changeset-worktree}} {id}`
    },
    success:   { criterion: [ "exit" ], match: [ "status:\\W*plan integrated\\b" ] }
})

/*  agent "ase agent integrator"  */
export default {
    kind: "integrator",
    description:
        "Drive the \"Integration\" phase of the \"enterprise\" task lifecycle model: claim every " +
        "\"APPROVED\" task unassigned or assigned to the integrator (by its name), without tag " +
        "\"ase-agent-integrator\", and with integrated \"After:\" predecessors into " +
        "\"INTEGRATING\", integrate its \"Changeset:\" into its \"Target:\" (a \"branch:\" " +
        "target not checked out yet in a temporary Git worktree) via the headless agent tool and " +
        "the \"ase-task-integrate\" skill (by a merge, rebase, or squash after \"--mode\"), tag " +
        "it with \"ase-agent-integrator\", and put it into \"INTEGRATED\" if integrated, or into " +
        "\"DEFERRED\" otherwise (or \"APPROVED\" untagged on interrupt, or left \"INTEGRATED\" " +
        "with tag \"ase-agent-integrator:failed\" if its integrated target branch could not be " +
        "published), processing the tasks serially (ignoring \"--parallel\") and logging to " +
        "stdout and to the \"agent:integrator\" attachment of the task",
    modeDesc:
        "\"merge\", \"rebase\", or \"squash\" to integrate the changeset " +
        "into the target by a merge commit, a rebase with fast-forward, or a squash commit",
    mode: "squash",
    modes: {
        /*  create a merge commit  */
        merge:  integrate("merge"),

        /*  rebase the changeset onto the target and fast-forward the target  */
        rebase: integrate("rebase"),

        /*  combine the changeset into one new commit on the target  */
        squash: integrate("squash")
    }
} satisfies AgentKind

