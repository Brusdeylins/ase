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

/*  biz sub-commands  */
const bizSubCommands = [
    "understand",
    "ideate",
    "explore",
    "specify"
]

/*  create sub-command handler  */
const createSubCommandHandler = (subCommand: string) => {
    return (argv: BaseArgs & { _: (string | number)[], $0: string }) => {
        if (argv.debug)
            console.log(`DEBUG: agent biz ${subCommand} command`)
        if (argv.verbose)
            console.log(`VERBOSE: executing agent biz ${subCommand}...`)
        console.log(`Executing agent biz ${subCommand}...`)
        /*  TODO: implement agent biz sub-command logic  */
    }
}

/*  create and export biz command module  */
const bizCommand: CommandModule<object, BaseArgs> = {
    command: "biz <subcommand>",
    describe: "Execute business agent operations",
    builder: (yargs: Argv) => {
        let builder = yargs
            .option("verbose", {
                alias:    "v",
                type:     "boolean",
                describe: "Enable verbose output",
                default:  false
            })
            .demandCommand(1, "You need to specify a biz subcommand")

        /*  register all sub-commands  */
        for (const subCmd of bizSubCommands) {
            builder = builder.command(
                subCmd,
                `Execute agent biz ${subCmd} operation`,
                () => {},
                createSubCommandHandler(subCmd)
            )
        }

        return builder
    },
    handler: (argv) => {
        /*  this handler is not called when sub-commands are used  */
        if (argv.debug)
            console.log("DEBUG: agent biz command (no subcommand)")
    }
}

export default bizCommand

