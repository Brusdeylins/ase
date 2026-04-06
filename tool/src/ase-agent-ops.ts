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

/*  ops sub-commands  */
const opsSubCommands = [
    "deploy",
    "integrate",
    "operate",
    "monitor"
]

/*  create sub-command handler  */
const createSubCommandHandler = (subCommand: string) => {
    return (argv: BaseArgs & { _: (string | number)[], $0: string }) => {
        if (argv.debug)
            console.log(`DEBUG: agent ops ${subCommand} command`)
        if (argv.verbose)
            console.log(`VERBOSE: executing agent ops ${subCommand}...`)
        console.log(`Executing agent ops ${subCommand}...`)
        /*  TODO: implement agent ops sub-command logic  */
    }
}

/*  create and export ops command module  */
const opsCommand: CommandModule<object, BaseArgs> = {
    command: "ops <subcommand>",
    describe: "Execute operations agent operations",
    builder: (yargs: Argv) => {
        let builder = yargs
            .option("verbose", {
                alias:    "v",
                type:     "boolean",
                describe: "Enable verbose output",
                default:  false
            })
            .demandCommand(1, "You need to specify an ops subcommand")

        /*  register all sub-commands  */
        for (const subCmd of opsSubCommands) {
            builder = builder.command(
                subCmd,
                `Execute agent ops ${subCmd} operation`,
                () => {},
                createSubCommandHandler(subCmd)
            )
        }

        return builder
    },
    handler: (argv) => {
        /*  this handler is not called when sub-commands are used  */
        if (argv.debug)
            console.log("DEBUG: agent ops command (no subcommand)")
    }
}

export default opsCommand

