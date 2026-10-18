/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { AgentKind } from "../ase-agent-definition-core.js"

/*  agent "ase agent planner", processing a plan only on explicit request,
    i.e., once a human assigned the task to the planner (by its name)  */
export default {
    kind: "planner",
    description:
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
        "attachment of the task",
    modeDesc:
        "\"reboot\" to re-create the plan of the task from scratch, or \"condense\" " +
        "to just compress the wording of its plan",
    mode: "reboot",
    modes: {
        /*  re-create the plan of a task from scratch, where the skill itself resets the task
            into "DRAFTED" on success, while a task left in "PLANNING" is shelved, and where
            the tag is one per mode, so a rebooted task can still be condensed later  */
        reboot: {
            title:     "Reboot the plans of drafted tasks",
            description:
                "Claims every DRAFTED task explicitly assigned to the planner, not yet rebooted, and with " +
                "planned After: predecessors into PLANNING. Re-creates its plan from scratch via the " +
                "ase-task-reboot skill, tags it as rebooted, unassigns it, and puts it back into DRAFTED " +
                "for its final review by a human, or into SHELVED if it was not rebooted.",
            type:      "phase",
            lifecycle: "enterprise",
            workdir:   "project",
            state:     { incoming: "DRAFTED", activity: "PLANNING", success: "DRAFTED", failure: "SHELVED", passed: "PLANNED" },
            tag:       { name: "ase-agent-planner-reboot" },
            assign:    { required: true },
            prompt:    { skill: "ase-task-reboot", args: "--next DONE {id}" },
            success:   { criterion: [ "status" ] }
        },

        /*  compress the wording of the plan of a task, where the skill leaves the task in
            "PLANNING", so it is put back into "DRAFTED" only if the agent tool succeeded and
            the skill reported no error (as the agent tool still exits successfully then)  */
        condense: {
            title:     "Condense the plans of drafted tasks",
            description:
                "Claims every DRAFTED task explicitly assigned to the planner, not yet condensed, and with " +
                "planned After: predecessors into PLANNING. Compresses the wording of its plan via the " +
                "ase-task-condense skill, tags it as condensed, and puts it back into DRAFTED, or into " +
                "SHELVED if it was not condensed.",
            type:      "phase",
            lifecycle: "enterprise",
            workdir:   "project",
            state:     { incoming: "DRAFTED", activity: "PLANNING", success: "DRAFTED", failure: "SHELVED", passed: "PLANNED" },
            tag:       { name: "ase-agent-planner-condense" },
            assign:    { required: true },
            prompt:    { skill: "ase-task-condense", args: "--next DONE {id}" },
            success:   { criterion: [ "exit", "clean" ] }
        }
    }
} satisfies AgentKind

