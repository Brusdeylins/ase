/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import type { CommandModule } from "yargs"

interface SetupArgs {
    debug?: boolean
}

const setupCommand: CommandModule<object, SetupArgs> = {
    command: "setup",
    describe: "Setup ASE",
    builder: (yargs) => {
        return yargs
    },
    handler: (argv) => {
        if (argv.debug)
            console.log("DEBUG: setup command")
        console.log("Setup ASE...")
        /*  TODO: implement setup logic  */
    }
}

export default setupCommand

