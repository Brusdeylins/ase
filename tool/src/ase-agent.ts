/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }                  from "commander"

import type Log                          from "./ase-lib-log.js"
import type { Agent }                    from "./ase-agent-common.js"
import AgentPlannerCommand               from "./ase-agent-planner.js"
import AgentImplementerCommand           from "./ase-agent-implementer.js"
import AgentApproverCommand              from "./ase-agent-approver.js"
import AgentIntegratorCommand            from "./ase-agent-integrator.js"
import AgentEditorCommand                from "./ase-agent-editor.js"
import AgentInstanceCommand              from "./ase-agent-instance.js"
import AgentRelayCommand                 from "./ase-agent-relay-server-cli.js"
import AgentFleetCommand                 from "./ase-agent-fleet.js"

/*  CLI command "ase agent"  */
export default class AgentCommand {
    constructor (private log: Log) {}

    /*  register command  */
    register (program: Command): void {
        /*  the available agent kinds, each with the creation of a fresh agent  */
        const kinds = new Map<string, () => Agent>([
            () => new AgentPlannerCommand(this.log),
            () => new AgentImplementerCommand(this.log),
            () => new AgentApproverCommand(this.log),
            () => new AgentIntegratorCommand(this.log),
            () => new AgentEditorCommand(this.log)
        ].map((create) => [ create().kind, create ]))

        /*  register CLI top-level command "ase agent"  */
        const cmd = program
            .command("agent")
            .description("Autonomous agents driving the task lifecycle phases (planner, implementer, approver, integrator) " +
                "and processing the edit requests of tasks (editor), each running in its own process, " +
                "individually or as a fleet, optionally reporting to the agent relay")
            .action(() => {
                cmd.outputHelp()
                process.exit(1)
            })

        /*  register CLI sub-command groups "ase agent <kind>",
            "ase agent relay", and "ase agent fleet"  */
        for (const create of kinds.values())
            new AgentInstanceCommand(this.log, create(), [ ...kinds.keys() ]).register(cmd)
        new AgentRelayCommand(this.log).register(cmd)
        new AgentFleetCommand(this.log, kinds).register(cmd)
    }
}

