/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { Worktree }                              from "./ase-util-worktree.js"
import type { AgentTask, AgentJob, AgentLog }    from "./ase-agent-common.js"
import {
    taskFlow, worktreeId,
    gitWorktreeRemove, gitWorktreeDetached
}                                                from "./ase-agent-common.js"
import { RequestAgent }                          from "./ase-agent-common-request.js"
import { edits }                                 from "./ase-task-request.js"

/*  agent "ase agent editor"  */
export default class AgentEditorCommand extends RequestAgent {
    readonly kind = "editor"

    protected readonly description =
        "Process the edit requests of tasks in any task lifecycle model, as requested with key " +
        "\"E\" on the task board: claim every task tagged with \"ase-agent-editor:pending\" " +
        "(except in an activity status, until it changes) by turning its oldest \"edit\" " +
        "attachment into \"edit-running\" and assigning the task to the agent (keeping all " +
        "other agents off it), edit its plan by the prompt of the request via the headless " +
        "agent tool and the \"ase-task-edit\" skill (grounded in its \"Source:\", a " +
        "\"branch:\" one checked out in a temporary Git worktree, and saved only if not " +
        "changed meanwhile), restore its previous assignee, and remove the request if the plan " +
        "was changed (else turn it into \"edit-failed\", or back into \"edit\" on interrupt), " +
        "logging to stdout and to the \"agent:editor\" attachment of the task"

    protected readonly requests = edits
    protected readonly worktree = true
    protected mode              = "edit"

    /*  edit the plan of the task by the prompt of the request in the working copy,
        grounded in the "Source:" of the task: a "worktree" one in the working copy
        itself, and a "branch:" one in a temporary, detached Git worktree of the
        branch (passed to the skill and the agent tool), which is removed afterwards  */
    protected async prepare (task: AgentTask): Promise<AgentJob> {
        const { prompt } = this.claims.get(task.id)!
        const source = taskFlow(this.log, task, "Source")
        const root   = await this.workdir(task, [ source ])
        const edit   = (opt: string) => `ase-task-edit --plan REFINE --next DONE${opt} ${task.id}: ${prompt.replace(/\s+/g, " ")}`
        if (source.type !== "branch")
            return { cmd: edit(""), cwd: root }
        const dir = Worktree.dir(`${worktreeId(task.id)}-editor`, true, true, root)
        await gitWorktreeDetached(root, dir, source.name)
        return {
            cmd:  edit(` --int-source-dir "${dir}"`),
            cwd:  root,
            dirs: [ dir ],
            cleanup: async (log: AgentLog) => {
                await gitWorktreeRemove(root, dir)
                await log("info", `temporary worktree of source branch "${source.name}" removed`)
            }
        }
    }
}

