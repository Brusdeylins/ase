/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                        from "commander"

import { Task }                                from "./ase-task.js"
import type { AgentOpts, AgentTask, AgentItem, AgentJob } from "./ase-agent-common.js"
import { taskFlow, tagsOf }                    from "./ase-agent-common.js"
import { PhaseAgent }                          from "./ase-agent-common-phase.js"

/*  agent "ase agent implementer"  */
export default class AgentImplementerCommand extends PhaseAgent {
    readonly kind = "implementer"

    protected readonly description =
        "Drive the \"Implementation\" phase of the \"enterprise\" task lifecycle model: claim " +
        "every \"PLANNED\" task unassigned or assigned to the implementer, not yet tagged " +
        "\"ase-agent-implementer\", and with integrated \"After:\" predecessors (or implemented ones, " +
        "if stacked onto their \"branch:\" changeset by its \"Source:\") into " +
        "\"IMPLEMENTING\", implement it from its \"Source:\" into its \"Changeset:\" via the " +
        "\"ase-task-implement\" skill (in a Git worktree where needed), tag it, and put it into " +
        "\"STALLED\" unless it became \"IMPLEMENTED\" (tagged \"ase-agent-implementer:failed\" " +
        "if its branch could not be published), or, with \"--mode draft\", only draft the " +
        "implementation of tasks without a draft yet into their \"draft\" attachment and put " +
        "them back into \"PLANNED\", logging to stdout and to the \"agent:implementer\" " +
        "attachment of the task"

    protected readonly states = {
        incoming: "PLANNED",
        activity: "IMPLEMENTING",
        success:  "IMPLEMENTED",
        passed:   "IMPLEMENTED"
    }

    protected readonly worktree = true

    /*  the mode of "--mode": "implement" implements a task into its changeset,
        while "draft" just drafts its implementation into its "draft" attachment  */
    protected mode = "implement"

    protected options (cmd: Command): void {
        cmd.option("-m, --mode <mode>", "\"implement\" to implement the task into its changeset, or \"draft\" " +
            "to just draft its implementation into its \"draft\" attachment", "implement")
    }
    protected async init (opts: AgentOpts): Promise<void> {
        const mode = (opts as AgentOpts & { mode?: string }).mode ?? "implement"
        if (mode !== "implement" && mode !== "draft")
            throw new Error(`agent: ${this.name}: invalid mode "${mode}" (expected "implement" or "draft")`)
        this.mode = mode

        /*  the job of an implementing finishes the result of the skill (by committing and
            publishing a "branch:" changeset), while a draft has nothing to finish  */
        this.finishing = mode === "implement"
    }

    /*  the tag of the drafting, separate from the one of the implementing,
        so a drafted task is still implemented later  */
    protected get tag (): string {
        return `ase-agent-${this.kind}${this.mode === "draft" ? "-draft" : ""}`
    }

    /*  a predecessor passed the implementation phase for its successor only once its change
        set is contained in the "Source:" of the successor, from which the successor is
        implemented resp. drafted, i.e., once integrated (and its integrated target branch
        published, i.e., not still held by the integrator or failed there), or, for a
        successor stacked onto it (with the "branch:" changeset of the predecessor as its
        "Source:"), already once implemented (and its changeset branch committed and
        published, i.e., not still held by the implementer or failed there), where an
        invalid "Source:" or "Changeset:" value never stacks  */
    protected passes (pred: AgentItem, status: string, item: AgentItem): boolean {
        const tags = tagsOf(pred.keys)
        const held = (tag: string) => tags.includes(`${tag}:active`) || tags.includes(`${tag}:failed`)
        let stacked = false
        try {
            const changeset = taskFlow(this.log, pred, "Changeset")
            const source    = taskFlow(this.log, item, "Source")
            stacked = changeset.type === "branch" && source.type === "branch" && changeset.name === source.name
        }
        catch (_err) {
            /*  an invalid value never stacks  */
        }
        const states = this.lifecycle!.states
        if (stacked)
            return states.indexOf(status) >= states.indexOf("IMPLEMENTED")
                && !(status === "IMPLEMENTED" && held("ase-agent-implementer"))
        else
            return status === "INTEGRATED" && !held("ase-agent-integrator")
    }

    /*  whether the task carries an implementation draft attachment  */
    private async drafted (id: string): Promise<boolean> {
        return (await Task.attachments(this.log, id))
            .some((att) => /^text\/x-diff\s*;.*\bkind\s*=\s*"?draft"?\s*(?:;|$)/i.test(att.type))
    }

    /*  a task is drafted only if it carries no implementation draft yet, and a task is
        implemented only while its changeset is free for it (see "changesetReady")  */
    protected async ready (task: AgentTask): Promise<boolean> {
        if (this.mode === "draft")
            return !(await this.drafted(task.id))
        return this.changesetReady(task)
    }

    /*  implement the task from its source into its changeset (see "changesetJob"),
        which the skill itself puts into "IMPLEMENTED" on success,
        or draft its implementation into its "draft" attachment only,
        where the skill leaves the task status untouched  */
    protected async prepare (task: AgentTask, parallel: boolean): Promise<AgentJob> {
        if (this.mode === "draft") {
            /*  the skill drafts in a temporary worktree of its own (from the source commit,
                without uncommitted changes), so the working copy is used as-is and the
                drafts are parallel-safe  */
            const work = await this.sourceJob(task, this.kind, false)
            return {
                ...work,
                cmd: `ase-task-implement --next DONE --draft --stateless ${task.id}`,
                finish: async (log) => {
                    if (!(await this.drafted(task.id)))
                        throw new Error("agent: no implementation draft attachment created")
                    await log("info", "implementation draft attached to task")
                }
            }
        }
        /*  a "branch:" changeset is implemented in place in the worktree carrying its
            branch, while the "Source:" of the plan stays in effect, so the skill bases
            the change set snapshot on the fork point of the branch from its source
            (and hence shows the entire branch, also on a re-run of a declined task)  */
        const work      = await this.changesetJob(task, this.kind, parallel, true)
        const changeset = taskFlow(this.log, task, "Changeset")
        return {
            ...work,
            cmd: "ase-task-implement --next DONE" +
                (changeset.type === "branch" ? " --changeset worktree" : "") +
                (work.changesetWorktree !== "" ? ` --worktree ${work.changesetWorktree}` : "") +
                ` ${task.id}`
        }
    }

    /*  a drafted task is untagged, as its draft attachment itself keeps it
        from being drafted again, while a task not drafted keeps the tag  */
    protected label (ok: boolean): string | null | undefined {
        return this.mode === "draft" && ok ? null : undefined
    }

    /*  a task not implemented by the skill is stalled,
        while a drafted (or not drafted) task is planned again  */
    protected outcome (): string {
        return this.mode === "draft" ? "PLANNED" : "STALLED"
    }
}

