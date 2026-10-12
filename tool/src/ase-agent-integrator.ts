/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                        from "commander"

import type { AgentOpts, AgentTask, AgentJob } from "./ase-agent-common.js"
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

    /*  a task is integrated only while its changeset and target are free for it (see "targetReady")  */
    protected async ready (task: AgentTask): Promise<boolean> {
        return this.targetReady(task)
    }

    /*  integrate the changeset of the task into its target (see "targetJob"), where the
        skill itself puts the task into "INTEGRATED" on success  */
    protected async prepare (task: AgentTask): Promise<AgentJob> {
        const work = await this.targetJob(task, this.kind)
        const opt  = work.changesetWorktree !== "" ? ` --worktree ${work.changesetWorktree}` : ""
        return { ...work, cmd: `ase-task-integrate --next DONE --mode ${this.mode}${opt} ${task.id}` }
    }

    /*  a task is integrated on the "plan integrated" status of the skill only  */
    protected outcome (ok: boolean, output: string[]): string {
        return ok && output.some((line) => /status:\W*plan integrated\b/.test(line)) ? "INTEGRATED" : "DEFERRED"
    }
}

