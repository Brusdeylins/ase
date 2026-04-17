#!/usr/bin/env node
/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import yargs                  from "yargs"
import { hideBin }            from "yargs/helpers"
import configCommand          from "./ase-config.js"
import setupCommand           from "./ase-setup.js"
import serviceCommand         from "./ase-service.js"

/*  parse CLI arguments  */
try {
    await yargs(hideBin(process.argv))
        .scriptName("ase")
        .usage("Usage: $0 <command> [options]")
        .option("debug", {
            alias:    "d",
            type:     "boolean",
            describe: "Enable debug output",
            default:  false
        })
        .command(configCommand)
        .command(setupCommand)
        .command(serviceCommand)
        .demandCommand(1, "You need to specify a command")
        .fail((msg, err, yargs) => {
            if (err)
                throw err
            yargs.showHelp()
            process.stderr.write(`\nase: ${msg}\n`)
            process.exit(1)
        })
        .help()
        .version()
        .strict()
        .parseAsync()
}
catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`ase: ERROR: ${message}\n`)
    process.exit(1)
}
