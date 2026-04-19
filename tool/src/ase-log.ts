/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import fs              from "node:fs"

import chalk           from "chalk"
import { DateTime }    from "luxon"

const levels = [
    { name: "ERROR",   style: chalk.red.bold },
    { name: "WARNING", style: chalk.yellow.bold },
    { name: "INFO",    style: chalk.blue },
    { name: "DEBUG",   style: chalk.green }
] as const

type LogLevel = typeof levels[number]["name"]

export default class Log {
    private stream:      fs.WriteStream | null = null
    private logLevelIdx: number                = 0
    constructor (
        private logLevel: LogLevel,
        private logFile:  string
    ) {}
    async init () {
        /*  log messages  */
        this.logLevelIdx = levels.findIndex((l) => l.name === this.logLevel)
        if (this.logFile !== "-")
            this.stream = fs.createWriteStream(this.logFile, { flags: "a", encoding: "utf8" })
    }
    log (level: number, msg: string) {
        if (level <= this.logLevelIdx) {
            const timestamp = DateTime.now().toFormat("yyyy-LL-dd hh:mm:ss.SSS")
            let line = `[${timestamp}]: `
            if (this.logFile === "-" && process.stdout.isTTY)
                line += `${levels[level].style("[" + levels[level].name + "]")}`
            else
                line += `[${levels[level].name}]`
            line += `: ${msg}\n`
            if (this.logFile === "-")
                process.stdout.write(line)
            else if (this.stream !== null)
                this.stream.write(line)
        }
    }
}

