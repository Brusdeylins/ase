/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs              from "node:fs"

import chalk           from "chalk"
import { DateTime }    from "luxon"

/*  the supported log levels (in ascending verbosity order) and their terminal styles  */
const levels = [
    { name: "error",   style: chalk.red.bold },
    { name: "warning", style: chalk.yellow.bold },
    { name: "info",    style: chalk.blue },
    { name: "debug",   style: chalk.green }
] as const

/*  name of a supported log level  */
export type LogLevel = typeof levels[number]["name"]

/*  check whether an arbitrary string is a valid log level  */
export const isLogLevel = (level: string): level is LogLevel =>
    levels.some((l) => l.name === level)

/*  logger with level-based filtering, writing to stderr ("-") or a log file  */
export default class Log {
    private stream: fs.WriteStream | null = null
    private logLevelIdx = 0
    private deferred: string[] | null = null

    /*  creation  */
    constructor (
        private _program:  string,
        private _logLevel: LogLevel,
        private _logFile:  string
    ) {}

    /*  initialize the logger with the initially configured level and file  */
    async init () {
        this.logLevel(this._logLevel)
        if (this._logFile !== "-")
            this.stream = this.openStream(this._logFile)
    }

    /*  open a log file stream for appending, reporting write errors on stderr  */
    private openStream (file: string): fs.WriteStream {
        const stream = fs.createWriteStream(file, { flags: "a", encoding: "utf8" })
        stream.on("error", (err) => {
            process.stderr.write(`${this._program}: ERROR: cannot write log file "${file}": ${err.message}\n`)
        })
        return stream
    }

    /*  get the current log level or set a new one  */
    logLevel (level?: LogLevel): LogLevel {
        if (level === undefined)
            return this._logLevel
        const idx = levels.findIndex((l) => l.name === level)
        if (idx === -1)
            throw new RangeError(`invalid log level "${level}" (expected one of: ${levels.map((l) => l.name).join(", ")})`)
        this._logLevel   = level
        this.logLevelIdx = idx
        return this._logLevel
    }

    /*  switch the log file ("-" for stderr), closing any previous log file stream  */
    logFile (file: string) {
        if (file === this._logFile)
            return
        this._logFile = file
        if (this.stream !== null) {
            this.stream.end()
            this.stream = null
        }
        if (file !== "-")
            this.stream = this.openStream(file)
    }

    /*  write a message on a log level, if enabled by the current log level  */
    write (level: LogLevel, msg: string) {
        const idx = levels.findIndex((l) => l.name === level)
        if (idx !== -1 && idx <= this.logLevelIdx) {
            const timestamp = DateTime.now().toFormat("yyyy-LL-dd HH:mm:ss.SSS")
            let line = `${this._program}: [${timestamp}]: `
            if (this._logFile === "-" && process.stderr.isTTY)
                line += `${levels[idx].style("[" + levels[idx].name.toUpperCase() + "]")}`
            else
                line += `[${levels[idx].name.toUpperCase()}]`
            line += `: ${msg}\n`
            if (this._logFile === "-" && this.deferred !== null)
                this.deferred.push(line)
            else if (this._logFile === "-")
                process.stderr.write(line)
            else if (this.stream !== null)
                this.stream.write(line)
        }
    }

    /*  defer stderr output (e.g. while a TUI owns the terminal) and flush it once re-enabled  */
    defer (enable: boolean) {
        if (enable && this.deferred === null)
            this.deferred = []
        else if (!enable && this.deferred !== null) {
            const lines   = this.deferred
            this.deferred = null
            for (const line of lines)
                process.stderr.write(line)
        }
    }

    /*  close the log file stream, flushing all pending writes  */
    async close (): Promise<void> {
        if (this.stream === null)
            return
        const stream = this.stream
        this.stream  = null
        await new Promise<void>((resolve) => {
            stream.end(() => {
                resolve()
            })
        })
    }
}
