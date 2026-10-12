/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }             from "commander"

import type { AgentOpts, AgentTask, AgentJob } from "./ase-agent-common.js"
import { taskFlow, verdictOf }      from "./ase-agent-common.js"
import { PhaseAgent }               from "./ase-agent-common-phase.js"

/*  agent "ase agent approver"  */
export default class AgentApproverCommand extends PhaseAgent {
    readonly kind = "approver"

    protected readonly description =
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
        "logging to stdout and to the \"agent:approver\" attachment of the task"

    protected readonly states = {
        incoming: "IMPLEMENTED",
        activity: "APPROVING",
        success:  "APPROVED",
        passed:   "APPROVED"
    }

    protected readonly worktree = true

    /*  the mode of "--mode": "judge" just adds the verdict, while "approve"
        additionally decides on the resulting task status by the verdict  */
    protected mode = "judge"

    protected options (cmd: Command): void {
        cmd.option("-m, --mode <mode>", "\"judge\" to just add the verdict tag, or \"approve\" to additionally " +
            "approve resp. decline the task by its verdict", "judge")
    }
    protected async init (opts: AgentOpts): Promise<void> {
        const mode = (opts as AgentOpts & { mode?: string }).mode ?? "judge"
        if (mode !== "judge" && mode !== "approve")
            throw new Error(`agent: ${this.name}: invalid mode "${mode}" (expected "judge" or "approve")`)
        this.mode = mode
    }

    /*  a task is reviewed only while its changeset is free for it (see "changesetReadReady")  */
    protected async ready (task: AgentTask): Promise<boolean> {
        return this.changesetReadReady(task)
    }

    /*  review the changeset of the task (see "changesetReadJob")  */
    protected async prepare (task: AgentTask): Promise<AgentJob> {
        const work      = await this.changesetReadJob(task, this.kind)
        const changeset = taskFlow(this.log, task, "Changeset")
        return { ...work, cmd: changeset.type === "branch" ? `ase-repo-review --branch ${changeset.name}` : "ase-repo-review" }
    }

    /*  the verdict of a successful review ("APPROVE" or "REJECT"), or empty if none
        (e.g. on a failed or skipped review)  */
    private verdict (ok: boolean, output: string[]): string {
        const verdict = ok ? verdictOf(output, "REVIEW VERDICT") : ""
        return verdict === "APPROVE" || verdict === "REJECT" ? verdict : ""
    }

    /*  a task is tagged with the verdict of the review, if any  */
    protected label (ok: boolean, output: string[]): string | undefined {
        const verdict = this.verdict(ok, output)
        return verdict !== "" ? verdict.toLowerCase() : undefined
    }

    /*  a task is put back into "IMPLEMENTED" for a human decision, except in
        mode "approve", where it is approved resp. declined by the verdict  */
    protected outcome (ok: boolean, output: string[]): string {
        const verdict = this.verdict(ok, output)
        if (this.mode === "approve" && verdict === "APPROVE")
            return "APPROVED"
        else if (this.mode === "approve" && verdict === "REJECT")
            return "DECLINED"
        else
            return "IMPLEMENTED"
    }
}

