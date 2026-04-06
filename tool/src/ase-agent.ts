/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import type { CommandModule, Argv } from "yargs"

import bizCommand  from "./ase-agent-biz.js"
import devCommand  from "./ase-agent-dev.js"
import opsCommand  from "./ase-agent-ops.js"
import prdCommand  from "./ase-agent-prd.js"
import prjCommand  from "./ase-agent-prj.js"

interface AgentArgs {
    debug?:   boolean
    verbose?: boolean
}

const agentCommand: CommandModule<object, AgentArgs> = {
    command: "agent <subcommand>",
    describe: "Execute agent operations",
    builder: (yargs: Argv) => {
        return yargs
            .option("verbose", {
                alias:    "v",
                type:     "boolean",
                describe: "Enable verbose output",
                default:  false
            })
            .command(bizCommand)
            .command(devCommand)
            .command(opsCommand)
            .command(prdCommand)
            .command(prjCommand)
            .demandCommand(1, "You need to specify an agent subcommand")
    },
    handler: (argv) => {
        /*  this handler is not called when sub-commands are used  */
        if (argv.debug)
            console.log("DEBUG: agent command (no subcommand)")
    }
}

export default agentCommand

