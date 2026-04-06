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

/*  create agent command module  */
export const createAgentCommandModule = (
    category:     string,
    description:  string,
    subCommands:  string[]
): CommandModule<object, BaseArgs> => {
    /*  create sub-command handler  */
    const createSubCommandHandler = (subCommand: string) => {
        return (argv: BaseArgs & { _: (string | number)[], $0: string }) => {
            if (argv.debug)
                console.log(`DEBUG: agent ${category} ${subCommand} command`)
            if (argv.verbose)
                console.log(`VERBOSE: executing agent ${category} ${subCommand}...`)
            console.log(`Executing agent ${category} ${subCommand}...`)
            /*  TODO: implement agent ${category} sub-command logic  */
        }
    }

    return {
        command: `${category} <subcommand>`,
        describe: `Execute ${description} agent operations`,
        builder: (yargs: Argv) => {
            let builder = yargs
                .option("verbose", {
                    alias:    "v",
                    type:     "boolean",
                    describe: "Enable verbose output",
                    default:  false
                })
                .demandCommand(1, `You need to specify a ${category} subcommand`)

            /*  register all sub-commands  */
            for (const subCmd of subCommands) {
                builder = builder.command(
                    subCmd,
                    `Execute agent ${category} ${subCmd} operation`,
                    () => {},
                    createSubCommandHandler(subCmd)
                )
            }

            return builder
        },
        handler: (argv) => {
            /*  this handler is not called when sub-commands are used  */
            if (argv.debug)
                console.log(`DEBUG: agent ${category} command (no subcommand)`)
        }
    }
}

