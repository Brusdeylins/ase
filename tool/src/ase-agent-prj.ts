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

/*  prj sub-commands  */
const prjSubCommands = [
    "initiate",
    "define",
    "plan",
    "steer"
]

/*  create sub-command handler  */
const createSubCommandHandler = (subCommand: string) => {
    return (argv: BaseArgs & { _: (string | number)[], $0: string }) => {
        if (argv.debug)
            console.log(`DEBUG: agent prj ${subCommand} command`)
        if (argv.verbose)
            console.log(`VERBOSE: executing agent prj ${subCommand}...`)
        console.log(`Executing agent prj ${subCommand}...`)
        /*  TODO: implement agent prj sub-command logic  */
    }
}

/*  create and export prj command module  */
const prjCommand: CommandModule<object, BaseArgs> = {
    command: "prj <subcommand>",
    describe: "Execute project agent operations",
    builder: (yargs: Argv) => {
        let builder = yargs
            .option("verbose", {
                alias:    "v",
                type:     "boolean",
                describe: "Enable verbose output",
                default:  false
            })
            .demandCommand(1, "You need to specify a prj subcommand")

        /*  register all sub-commands  */
        for (const subCmd of prjSubCommands) {
            builder = builder.command(
                subCmd,
                `Execute agent prj ${subCmd} operation`,
                () => {},
                createSubCommandHandler(subCmd)
            )
        }

        return builder
    },
    handler: (argv) => {
        /*  this handler is not called when sub-commands are used  */
        if (argv.debug)
            console.log("DEBUG: agent prj command (no subcommand)")
    }
}

export default prjCommand

