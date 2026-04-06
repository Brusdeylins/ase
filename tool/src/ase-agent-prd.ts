/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import type { CommandModule, Argv } from "yargs"

export interface BaseArgs {
    debug?:   boolean
    verbose?: boolean
}

/*  prd sub-commands  */
const prdSubCommands = [
    "envision",
    "configure",
    "release",
    "rollout"
]

/*  create sub-command handler  */
const createSubCommandHandler = (subCommand: string) => {
    return (argv: BaseArgs & { _: (string | number)[], $0: string }) => {
        if (argv.debug)
            console.log(`DEBUG: agent prd ${subCommand} command`)
        if (argv.verbose)
            console.log(`VERBOSE: executing agent prd ${subCommand}...`)
        console.log(`Executing agent prd ${subCommand}...`)
        /*  TODO: implement agent prd sub-command logic  */
    }
}

/*  create and export prd command module  */
const prdCommand: CommandModule<object, BaseArgs> = {
    command: "prd <subcommand>",
    describe: "Execute production agent operations",
    builder: (yargs: Argv) => {
        let builder = yargs
            .option("verbose", {
                alias:    "v",
                type:     "boolean",
                describe: "Enable verbose output",
                default:  false
            })
            .demandCommand(1, "You need to specify a prd subcommand")

        /*  register all sub-commands  */
        for (const subCmd of prdSubCommands) {
            builder = builder.command(
                subCmd,
                `Execute agent prd ${subCmd} operation`,
                () => {},
                createSubCommandHandler(subCmd)
            )
        }

        return builder
    },
    handler: (argv) => {
        /*  this handler is not called when sub-commands are used  */
        if (argv.debug)
            console.log("DEBUG: agent prd command (no subcommand)")
    }
}

export default prdCommand

