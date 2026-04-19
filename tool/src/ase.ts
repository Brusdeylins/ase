#!/usr/bin/env node
/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import { Command, CommanderError } from "commander"
import Log                         from "./ase-log.js"
import type { LogLevel }           from "./ase-log.js"
import registerConfigCommand       from "./ase-config.js"
import registerServiceCommand      from "./ase-service.js"

/*  type of top-level (global) options  */
export type GlobalOpts = {
    debug:    boolean
    logLevel: LogLevel
    logFile:  string
}

/*  parse CLI arguments  */
try {
    /*  establish top-level program  */
    const program = new Command()
    program
        .name("ase")
        .usage("<command> [options]")
        .option("-d, --debug",             "enable debug output", false)
        .option("-l, --log-level <level>", "log level (error, warning, info, debug)", "warning")
        .option("-L, --log-file  <file>",  "log file path, or \"-\" for stdout", "-")
        .showHelpAfterError()
        .enablePositionalOptions()
        .exitOverride()

    /*  establish shared logger with defaults and apply parsed global options
        to the logger before any subcommand action  */
    const log = new Log("warning", "-")
    await log.init()
    program.hook("preAction", async () => {
        const opts = program.opts<GlobalOpts>()
        log.logLevel(opts.logLevel)
        log.logFile(opts.logFile)
    })

    /*  register top-level commands  */
    registerConfigCommand(program, log)
    registerServiceCommand(program, log)

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
