/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                        from "commander"

import { Worktree }                            from "./ase-util-worktree.js"
import type { AgentOpts, AgentTask, AgentJob, FlowValue } from "./ase-agent-common.js"
import {
    taskFlow, contextDir, worktreeId,
    gitWorktree, gitWorktreeAdd,
    gitWorktreeRemove, worktreeOpt, execaJob
}                                              from "./ase-agent-common.js"
import { PhaseAgent }                          from "./ase-agent-common-phase.js"

/*  agent "ase agent integrator"  */
export default class AgentIntegratorCommand extends PhaseAgent {
    readonly kind = "integrator"

    protected readonly description =
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
        "stdout and to the \"agent:integrator\" attachment of the task"

    protected readonly states = {
        incoming: "APPROVED",
        activity: "INTEGRATING",
        success:  "INTEGRATED",
        passed:   "INTEGRATED"
    }

    protected readonly serial    = true
    protected readonly worktree  = true
    protected readonly finishing = true

    /*  the mode of "--mode": "merge" creates a merge commit, "rebase" rebases the
        changeset onto the target and fast-forwards the target, and "squash"
        combines the changeset into one new commit on the target  */
    protected mode = "squash"

    protected options (cmd: Command): void {
        cmd.option("-m, --mode <mode>", "\"merge\", \"rebase\", or \"squash\" to integrate the changeset " +
            "into the target by a merge commit, a rebase with fast-forward, or a squash commit", "squash")
    }
    protected async init (opts: AgentOpts): Promise<void> {
        const mode = (opts as AgentOpts & { mode?: string }).mode ?? "squash"
        if (mode !== "merge" && mode !== "rebase" && mode !== "squash")
            throw new Error(`agent: ${this.name}: invalid mode "${mode}" (expected "merge", "rebase", or "squash")`)
        this.mode = mode
    }

    /*  a task integrated from or into the working copy the agent is started in directly (an
        uncommitted "worktree" change set located in it, a "branch:" changeset checked out in
        it, whose uncommitted changes the skill commits and which it rebases in place, a
        "worktree" target, or a "branch:" target checked out in it) is integrated only while
        the working copy is held for it alone (see "holdRoot"), and a task with a "branch:"
        changeset or target is integrated only while these branches are held for it alone (see
        "holdBranch"), as another task (e.g. one implemented into the same changeset branch, or
        into this target branch) would otherwise be processed in the same worktree at once (mixing
        their change sets, and merging, rebasing, or removing the worktree under each other),
        else it is deferred  */
    protected async ready (task: AgentTask): Promise<boolean> {
        let changeset: FlowValue
        let target:    FlowValue
        try {
            changeset = taskFlow(this.log, task, "Changeset")
            target    = taskFlow(this.log, task, "Target")
        }
        catch (_err) {
            /*  an invalid value fails the processing of the task  */
            return true
        }
        const root = this.localRoot([ changeset, target ])
        if (changeset.type === "branch" && !this.holdBranch(task, root, changeset.name))
            return this.defer(task, `the changeset branch "${changeset.name}" used by another task`)
        else if (target.type === "branch" && !this.holdBranch(task, root, target.name))
            return this.defer(task, `the target branch "${target.name}" used by another task`)
        else if (root === "")
            return true
        const direct = target.type === "worktree"
            || (changeset.type === "worktree" && (await contextDir(root, task).catch(() => "")) === root)
            || (changeset.type === "branch" && (await gitWorktree(root, changeset.name).catch(() => "")) === root)
            || (target.type === "branch" && (await gitWorktree(root, target.name).catch(() => "")) === root)
        if (direct && !this.holdRoot(task, root))
            return this.defer(task, "the working copy used by another task")
        return true
    }

    /*  integrate the changeset of the task into its target, where the skill
        itself puts the task into "INTEGRATED" on success, granting access to the
        worktrees in which the changeset and target branches are checked out  */
    protected async prepare (task: AgentTask): Promise<AgentJob> {
        const changeset = taskFlow(this.log, task, "Changeset")
        const target    = taskFlow(this.log, task, "Target")
        const root      = await this.workdir(task, [ changeset, target ])
        const dirs: string[] = []
        let opt = ""
        if (changeset.type === "worktree") {
            const dir = await contextDir(root, task)
            opt = worktreeOpt(root, dir)
            dirs.push(dir)
        }
        else if (changeset.type === "branch")
            dirs.push(await gitWorktree(root, changeset.name))

        /*  check out a target branch not checked out anywhere yet in a temporary
            worktree, into which the merge commits, and afterwards publish the
            target branch to the origin of a temporarily cloned repository (deleting
            there a changeset branch which the merge deleted) and remove the
            temporary worktree again in any case, where a target branch not moved by
            the skill is not published (as it carries nothing to publish, but might be
            outdated by the origin meanwhile, whose rejected push would then needlessly
            fail the task and preserve the clone), a target branch which could
            not be published is rescued (as the skill already recorded the task as
            integrated, see "settle"), so its merge is not lost, while a changeset
            branch which could not be deleted is only reported (as the merge itself
            was already published)  */
        const tip = async (branch: string): Promise<string> =>
            (await execaJob("git", [ "rev-parse", "--verify", "--quiet", `refs/heads/${branch}` ],
                { cwd: root, reject: false })).stdout.trim()
        let temp = ""
        let base = ""
        if (target.type === "branch") {
            let dir = await gitWorktree(root, target.name)
            if (dir === "") {
                temp = Worktree.dir(`${worktreeId(task.id)}-integrator`, true, true, root)
                await gitWorktreeAdd(root, temp, target.name)
                dir = temp
            }
            dirs.push(dir)
            base = await tip(target.name)
        }
        return {
            cmd:  `ase-task-integrate --next DONE --mode ${this.mode}${opt} ${task.id}`,
            cwd:  root,
            dirs: dirs.filter((dir) => dir !== ""),
            finish: async (log) => {
                const reason = (err: unknown) => err instanceof Error ? err.message : String(err)
                if (target.type === "branch" && await tip(target.name) === base)
                    await log("info", `target branch "${target.name}" unchanged -- nothing to publish`)
                else if (target.type === "branch")
                    await this.publish(root, target.name, log).catch(async (err: unknown) => {
                        await this.rescue(root, target.name, task, log).catch((err2: unknown) =>
                            log("error", `rescuing branch "${target.name}" failed: ${reason(err2)}`))
                        throw err
                    })
                if (changeset.type === "branch")
                    await this.unpublish(root, changeset.name, log).catch((err: unknown) =>
                        log("warning", `changeset branch "${changeset.name}" not deleted from origin: ${reason(err)}`))
            },
            cleanup: async () => {
                if (temp !== "")
                    await gitWorktreeRemove(root, temp)
            }
        }
    }

    /*  a task is integrated on the "plan integrated" status of the skill only  */
    protected outcome (ok: boolean, output: string[]): string {
        return ok && output.some((line) => /status:\W*plan integrated\b/.test(line)) ? "INTEGRATED" : "DEFERRED"
    }
}

