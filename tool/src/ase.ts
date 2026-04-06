#!/usr/bin/env node
/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import yargs                  from "yargs"
import { hideBin }            from "yargs/helpers"
import initCommand            from "./ase-init.js"
import configCommand          from "./ase-config.js"
import agentCommand           from "./ase-agent.js"

/*  parse CLI arguments  */
yargs(hideBin(process.argv))
    .scriptName("ase")
    .usage("Usage: $0 <command> [options]")
    .option("debug", {
        alias:    "d",
        type:     "boolean",
        describe: "Enable debug output",
        default:  false
    })
    .command(initCommand)
    .command(configCommand)
    .command(agentCommand)
    .demandCommand(1, "You need to specify a command")
    .help()
    .version()
    .strict()
    .parse()

