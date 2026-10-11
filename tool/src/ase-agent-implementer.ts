/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                        from "commander"

import { Task }                                from "./ase-task.js"
import { Worktree }                            from "./ase-util-worktree.js"
import type { AgentOpts, AgentTask, AgentJob, FlowValue } from "./ase-agent-common.js"
import {
    taskFlow, gitWorktree,
    gitWorktreeAdd, gitWorktreeRemove,
    worktreeOpt, worktreeId, execaJob, gitClean
}                                              from "./ase-agent-common.js"
import { PhaseAgent }                          from "./ase-agent-common-phase.js"

/*  agent "ase agent implementer"  */
export default class AgentImplementerCommand extends PhaseAgent {
    readonly kind = "implementer"

    protected readonly description =
        "Drive the \"Implementation\" phase of the \"enterprise\" task lifecycle model: claim " +
        "every \"PLANNED\" task unassigned or assigned to the implementer, not yet tagged " +
        "\"ase-agent-implementer\", and with implemented \"After:\" predecessors into " +
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

    protected readonly worktree  = true
    protected readonly finishing = true

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
    }

    /*  the tag of the drafting, separate from the one of the implementing,
        so a drafted task is still implemented later  */
    protected get tag (): string {
        return `ase-agent-${this.kind}${this.mode === "draft" ? "-draft" : ""}`
    }

    /*  whether the task carries an implementation draft attachment  */
    private async drafted (id: string): Promise<boolean> {
        return (await Task.attachments(this.log, id))
            .some((att) => /^text\/x-diff\s*;.*\bkind\s*=\s*"?draft"?\s*(?:;|$)/i.test(att.type))
    }

    /*  a task is drafted only if it carries no implementation draft yet, a task with a
        "branch:" changeset is implemented only while its changeset branch is held for it
        alone (see "holdBranch"), as two tasks with the same changeset branch would otherwise
        be implemented in the same worktree at once (mixing their change sets into the commit,
        and removing the worktree under each other), and a task is
        implemented directly in the working copy the agent is started in (a serially
        processed "worktree" changeset, or a "branch:" changeset checked out in it) only
        while the working copy is held for it alone (see "holdRoot") and while it carries
        no uncommitted changes (except the ASE state), as otherwise the uncommitted change
        set of an earlier task (e.g. one still to be reviewed and integrated) or the
        uncommitted work of a human would mix into the one of this task (and, for a
        "branch:" changeset, even be committed onto its branch), so the task is deferred
        (and not claimed) until then (re-checked on the next change of the tasks, e.g.
        once the earlier task was integrated)  */
    protected async ready (task: AgentTask): Promise<boolean> {
        if (this.mode === "draft")
            return !(await this.drafted(task.id))
        let source:    FlowValue
        let changeset: FlowValue
        try {
            source    = taskFlow(this.log, task, "Source")
            changeset = taskFlow(this.log, task, "Changeset")
        }
        catch (_err) {
            /*  an invalid value fails the processing of the task  */
            return true
        }
        const root = this.localRoot([ source, changeset ])
        if (changeset.type === "branch" && !this.holdBranch(task, root, changeset.name))
            return this.defer(task, `the changeset branch "${changeset.name}" used by another task`)
        else if (root === "")
            return true
        else if ((changeset.type === "worktree" && !this.parallelized)
            || (changeset.type === "branch" && (await gitWorktree(root, changeset.name).catch(() => "")) === root)) {
            if (!this.holdRoot(task, root))
                return this.defer(task, "the working copy used by another task")
            else if (!(await gitClean(root).catch(() => true))) {
                this.unhold(task.id)
                return this.defer(task, "the working copy without uncommitted changes (e.g. of an earlier task)")
            }
        }
        return true
    }

    /*  implement the task from its source into its changeset,
        which the skill itself puts into "IMPLEMENTED" on success,
        or draft its implementation into its "draft" attachment only,
        where the skill leaves the task status untouched  */
    protected async prepare (task: AgentTask, parallel: boolean): Promise<AgentJob> {
        const source    = taskFlow(this.log, task, "Source")
        if (this.mode === "draft") {
            /*  the skill drafts in a temporary worktree of its own (from the source commit,
                without uncommitted changes), so the working copy is used as-is and the
                drafts are parallel-safe  */
            const cwd = await this.workdir(task, [ source ])
            return {
                cmd: `ase-task-implement --next DONE --draft --stateless ${task.id}`,
                cwd,
                finish: async (log) => {
                    if (!(await this.drafted(task.id)))
                        throw new Error("agent: no implementation draft attachment created")
                    await log("info", "implementation draft attached to task")
                }
            }
        }
        const changeset = taskFlow(this.log, task, "Changeset")
        const cwd       = await this.workdir(task, [ source, changeset ])
        const cmd       = `ase-task-implement --next DONE${changeset.type === "worktree" && parallel ? ` --worktree ${worktreeId(task.id)}` : ""}`
        if (changeset.type === "branch") {
            /*  check out the changeset branch (created from the source if missing) in a
                worktree of the agent, unless it is already checked out in the working copy
                or an ASE worktree (which then has to be without uncommitted changes, as
                they would be committed onto the branch, too), implement the task inside it
                in place, and afterwards commit the result onto the branch (also a partial
                one, as the plan tracks it) and publish it to the origin of a temporarily
                cloned repository, where the worktree of the agent is removed only if clean
                and a branch which could not be published is rescued (as the commit would
                otherwise be lost with the clone, see "settle"), so the change set is not lost  */
            let dir   = await gitWorktree(cwd, changeset.name)
            const own = dir === ""
            if (own) {
                dir = Worktree.dir(`${worktreeId(task.id)}-implementer`, true, false, cwd)
                await gitWorktreeAdd(cwd, dir, changeset.name, source.type === "branch" ? source.name : "HEAD")
            }
            else if (!(await gitClean(dir)))
                throw new Error(`agent: working copy "${dir}" with branch "${changeset.name}" checked out has ` +
                    "uncommitted changes (e.g. the change set of an earlier task) -- cannot implement task into it")
            return {
                cmd: `${cmd} --source worktree --changeset worktree${worktreeOpt(cwd, dir)} ${task.id}`,
                cwd,
                finish: async (log) => {
                    /*  the ASE state (e.g. the local task store) is never committed  */
                    await execaJob("git", [ "add", "--all", "--", ".", ":(exclude).ase" ], { cwd: dir })
                    if ((await execaJob("git", [ "diff", "--cached", "--quiet" ], { cwd: dir, reject: false })).exitCode !== 0) {
                        const message = `${task.keys.get("Kind") || "CRAFTING"}: ${task.title} (${task.id})`
                        await execaJob("git", [ "commit", "--quiet", "-m", message ], { cwd: dir })
                        await log("info", `change set committed onto branch "${changeset.name}"`)
                    }
                    else
                        await log("warning", `no change set to commit onto branch "${changeset.name}"`)
                    await this.publish(cwd, changeset.name, log).catch(async (err: unknown) => {
                        await this.rescue(cwd, changeset.name, task, log).catch((err2: unknown) =>
                            log("error", `rescuing branch "${changeset.name}" failed: ` +
                                (err2 instanceof Error ? err2.message : String(err2))))
                        throw err
                    })
                },
                cleanup: async (log) => {
                    /*  a worktree nested inside the working directory of the task in the
                        temporary clone of "--repo" is kept only by preserving the clone  */
                    if (own && await gitClean(dir).catch(() => false))
                        await gitWorktreeRemove(cwd, dir)
                    else if (own && !(await this.preserve(cwd, task, `worktree "${dir}" with uncommitted change set`, log)))
                        await log("warning", `worktree "${dir}" with uncommitted change set kept for a manual recovery`)
                }
            }
        }
        else if (changeset.type === "worktree" && !parallel) {
            /*  implement into the working copy (held for this task, see "ready") only if it
                still carries no uncommitted changes (except the ASE state), and switch the
                working copy to the source branch  */
            if (!(await gitClean(cwd)))
                throw new Error("agent: working copy has uncommitted changes (e.g. the change set of an earlier task) " +
                    "-- cannot implement task into it")
            if (source.type === "branch") {
                const { stdout: branch } = await execaJob("git", [ "branch", "--show-current" ], { cwd })
                if (branch.trim() !== source.name)
                    await execaJob("git", [ "switch", "--quiet", source.name ], { cwd })
            }
        }
        return { cmd: `${cmd} ${task.id}`, cwd }
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

