#!/usr/bin/env node
/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import { Command, CommanderError } from "commander"
import registerConfigCommand       from "./ase-config.js"
import registerServiceCommand      from "./ase-service.js"

/*  parse CLI arguments  */
try {
    /*  establish top-level program  */
    const program = new Command()
    program
        .name("ase")
        .usage("<command> [options]")
        .option("-d, --debug", "enable debug output", false)
        .showHelpAfterError()
        .enablePositionalOptions()
        .exitOverride()

    /*  register top-level commands  */
    registerConfigCommand(program)
    registerServiceCommand(program)

    /*  parse program arguments  */
    await program.parseAsync(process.argv)

    /*  gracefully terminate  */
    process.exit(0)
}
catch (err: unknown) {
    if (err instanceof CommanderError) {
        if (err.exitCode !== 0)
            process.exit(err.exitCode)
        else
            process.exit(0)
    }
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`ase: ERROR: ${message}\n`)
    process.exit(1)
}
