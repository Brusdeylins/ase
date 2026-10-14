/*
**  ASE Agent Example Definition (TypeScript, with hooks)
**  a reviewer of the "branch:" changesets of the security-relevant tasks
**  usage: cp docs/agent-definition/reviewer.mts .ase/agents/ && ase agent reviewer start [--params severity=MEDIUM]
*/

import type { AgentDefinition } from "@rse/ase"

export default {
    type:      "phase",
    lifecycle: "enterprise",
    workdir:   "changeset-read",
    state: {
        incoming: "IMPLEMENTED",
        activity: "APPROVING",
        phase:    "APPROVED"
    },
    tag: {
        name:    "ase-agent-reviewer",
        require: "security"
    },
    prompt: {
        skill: "ase-repo-review",
        args:  "{?changeset-type=branch:--branch {changeset-name}}"
    },
    verdict: {
        label: "REVIEW VERDICT",
        allow: [ "APPROVE", "REJECT" ]
    },
    success: {
        criterion: [ "exit", "verdict" ]
    },
    params: {
        severity: {
            desc:    "severity of the findings a rejecting review has to cite",
            default: "HIGH",
            allow:   [ "LOW", "MEDIUM", "HIGH" ]
        }
    },
    hooks: {
        /*  review a task only once its changeset is a branch  */
        ready: (task, ctx) =>
            ctx.flow(task, "Changeset")?.type === "branch" ? true : "a \"branch:\" changeset",

        /*  require a rejecting review to cite at least one finding of the configured severity  */
        success: (_task, result, ctx) =>
            result.verdict !== "REJECT" || result.output.some((line) => new RegExp(`\\b${ctx.params.severity}\\b`).test(line)) ||
            `rejecting review without ${ctx.params.severity} findings`
    }
} satisfies AgentDefinition

