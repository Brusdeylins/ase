/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { AgentDefinition } from "../ase-agent-definition-api.js"
import type { AgentKind }       from "../ase-agent-definition-core.js"

/*  review the changeset of the task (a "worktree" one staged, a "branch:" one against its
    base, an "attachment:" one staged in a temporary Git worktree) and tag the task with the
    verdict "APPROVE" resp. "REJECT" of the review (or plain without a verdict, e.g. on a
    failed or skipped review), where the task is put back into "IMPLEMENTED" for a human
    decision, except where the verdict decides on its resulting status  */
const review = (verdicts: string[]): AgentDefinition => ({
    type:      "phase",
    lifecycle: "enterprise",
    workdir:   "changeset-read",
    state:     {
        incoming: "IMPLEMENTED", activity: "APPROVING", success: "IMPLEMENTED", failure: "IMPLEMENTED",
        phase: "APPROVED", passed: "APPROVED", verdict: verdicts
    },
    tag:       { name: "ase-agent-approver" },
    prompt:    { skill: "ase-repo-review", args: "{?changeset-type=branch:--branch {changeset-name}}" },
    verdict:   { label: "REVIEW VERDICT", allow: [ "APPROVE", "REJECT" ] },
    success:   { criterion: [ "exit", "verdict" ] }
})

/*  agent "ase agent approver"  */
export default {
    kind: "approver",
    description:
        "Drive the \"Approval\" phase of the \"enterprise\" task lifecycle model: " +
        "claim every \"IMPLEMENTED\" task unassigned or assigned to the approver (by its name), without tag " +
        "\"ase-agent-approver\" (i.e., without its verdict yet), and with approved \"After:\" predecessors into " +
        "\"APPROVING\", review its \"Changeset:\" (a \"worktree\" one staged, a \"branch:\" one " +
        "against its base, an \"attachment:\" one staged in a temporary Git worktree) via the headless " +
        "agent tool and the \"ase-repo-review\" skill, tag it with its verdict \"ase-agent-approver:approve\" " +
        "or \"ase-agent-approver:reject\" (or plain \"ase-agent-approver\" without a verdict), and put it back " +
        "into \"IMPLEMENTED\" for a human decision (\"--mode judge\"), or into \"APPROVED\" resp. \"DECLINED\" by " +
        "its verdict (\"--mode approve\", and back into \"IMPLEMENTED\" without a verdict), " +
        "untagged into \"IMPLEMENTED\" on interrupt, " +
        "logging to stdout and to the \"agent:approver\" attachment of the task",
    modeDesc:
        "\"judge\" to just add the verdict tag, or \"approve\" to additionally " +
        "approve resp. decline the task by its verdict",
    mode: "judge",
    modes: {
        /*  just add the verdict  */
        judge:   review([]),

        /*  additionally decide on the resulting task status by the verdict  */
        approve: review([ "APPROVE=APPROVED", "REJECT=DECLINED" ])
    }
} satisfies AgentKind

