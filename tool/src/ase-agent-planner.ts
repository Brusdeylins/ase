/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                        from "commander"

import { Task }                                from "./ase-task.js"
import type { AgentOpts, AgentTask, AgentJob } from "./ase-agent-common.js"
import { skillErrored }                        from "./ase-agent-common.js"
import { PhaseAgent }                          from "./ase-agent-common-phase.js"

/*  agent "ase agent planner"  */
export default class AgentPlannerCommand extends PhaseAgent {
    readonly kind = "planner"

    protected readonly description =
        "Drive the \"Planning\" phase of the \"enterprise\" task lifecycle model: claim every " +
        "\"DRAFTED\" task explicitly assigned to the planner (by its name), without tag " +
        "\"ase-agent-planner-reboot\", and with planned \"After:\" predecessors into " +
        "\"PLANNING\", reboot its plan via the headless agent tool and the \"ase-task-reboot\" " +
        "skill, tag it with \"ase-agent-planner-reboot\", unassign it, and put it back into " +
        "\"DRAFTED\" for its final review (or into \"SHELVED\" if not rebooted, or \"DRAFTED\" " +
        "untagged on interrupt), or, with \"--mode condense\", claim only those tasks without " +
        "tag \"ase-agent-planner-condense\", condense their plan via the \"ase-task-condense\" " +
        "skill, tag them with \"ase-agent-planner-condense\", and put them back into \"DRAFTED\" " +
        "(or into \"SHELVED\" if not condensed), logging to stdout and to the \"agent:planner\" " +
        "attachment of the task"

    protected readonly states = {
        incoming: "DRAFTED",
        activity: "PLANNING",
        success:  "DRAFTED",
        passed:   "PLANNED"
    }

    /*  process a plan only on explicit request, i.e., once a human assigned the task to the planner  */
    protected readonly assigned = true

    /*  the mode of "--mode": "reboot" re-creates the plan of a task from scratch,
        while "condense" just compresses the wording of its plan  */
    protected mode = "reboot"

    protected options (cmd: Command): void {
        cmd.option("-m, --mode <mode>", "\"reboot\" to re-create the plan of the task from scratch, or \"condense\" " +
            "to just compress the wording of its plan", "reboot")
    }
    protected async init (opts: AgentOpts): Promise<void> {
        const mode = (opts as AgentOpts & { mode?: string }).mode ?? "reboot"
        if (mode !== "reboot" && mode !== "condense")
            throw new Error(`agent: ${this.name}: invalid mode "${mode}" (expected "reboot" or "condense")`)
        this.mode = mode
    }

    /*  the tag per mode, so a condensed task can still be rebooted later and vice versa  */
    protected get tag (): string {
        return `ase-agent-${this.kind}-${this.mode}`
    }

    /*  reboot the plan of the task, which the skill itself resets into "DRAFTED" on success,
        or condense the plan of the task, which the skill leaves in "PLANNING"  */
    protected async prepare (task: AgentTask): Promise<AgentJob> {
        return {
            cmd: `ase-task-${this.mode} --next DONE ${task.id}`,
            cwd: Task.projectRoot()
        }
    }

    /*  a task not rebooted by the skill is shelved, while a task condensed by the skill
        is put back into "DRAFTED", where a condensing counts as such only if the agent
        tool succeeded and the skill reported no error (as the agent tool still exits
        successfully then, and the tag would otherwise mark the task as condensed)  */
    protected outcome (ok: boolean, output: string[]): string {
        return this.mode === "condense" && ok && !skillErrored(output) ? "DRAFTED" : "SHELVED"
    }
}

