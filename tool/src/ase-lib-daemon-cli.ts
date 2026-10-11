/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                       from "node:path"
import fs                         from "node:fs"
import { fileURLToPath }          from "node:url"
import { spawn }                  from "node:child_process"
import type { ChildProcess }      from "node:child_process"

import type { Command }           from "commander"

import type Log                   from "./ase-lib-log.js"
import { Service }                from "./ase-service.js"

/*  the CLI command group managing a long-running process (a server, an agent, or a fleet
    of them) in the background or in the foreground: it registers the command group, spawns
    the process detached into its log file, awaits its startup, checks whether it is alive,
    shows its log file, and stops it, where the concrete command decides on its configuration and runtime state  */
export abstract class DaemonCommand {
    constructor (protected log: Log) {}

    /*  the label of the process in the messages (e.g. "agent relay"), its CLI command
        words (e.g. "agent relay"), and the description of its CLI command group  */
    protected abstract readonly label:       string
    protected abstract readonly words:       string
    protected abstract readonly description: string

    /*  register the CLI sub-command group below the CLI command <parent>,
        which shows its help on its own (as it requires a sub-command)  */
    protected group (parent: Command): Command {
        const group = parent
            .command(this.words.split(" ").at(-1)!)
            .description(this.description)
            .action(() => {
                group.outputHelp()
                process.exit(1)
            })
        return group
    }

    /*  register the CLI sub-command "log" below the CLI sub-command group <group>, showing the
        log file (resolved by <logFile> from the options of the sub-command) of the process run
        in the background, where <setup> adds further options to the sub-command and each shown
        line is passed through <transform> (e.g. to colorize parts of it)  */
    protected registerLog<T extends object> (group: Command, logFile: (opts: T) => string,
        setup: (cmd: Command) => void = () => {}, transform?: (line: string) => string): void {
        const cmd = group
            .command("log")
            .description(`Show the log of the ${this.label} run in the background`)
            .option("-f, --follow", "keep following the log for newly appended lines")
            .option("-n, --lines <n>", "show the last <n> lines only (default: all, or 10 with --follow)")
        setup(cmd)
        cmd.action(async (opts: T & { follow?: boolean, lines?: string }) => {
            const file = logFile(opts)
            if (!fs.existsSync(file)) {
                this.log.write("info", `${this.label}: no log file "${file}" ` +
                    "(not yet run in the background, as one run in the foreground logs to the terminal)")
                return
            }
            process.exitCode = await Service.showLog(file, opts, transform)
        })
    }

    /*  spawn the CLI with the arguments <args> detached, with the additional
        environment <env>, logging into the (trimmed) log file <logFile>  */
    protected spawnDetached (args: string[], env: NodeJS.ProcessEnv, logFile: string): ChildProcess {
        fs.mkdirSync(path.dirname(logFile), { recursive: true })
        Service.trimLog(logFile)
        const fd    = fs.openSync(logFile, "a")
        const entry = fileURLToPath(new URL("./ase.js", import.meta.url))
        const child = spawn(process.execPath, [ entry, ...args ], {
            detached: true,
            env:      { ...process.env, ...env },
            stdio:    [ "ignore", fd, fd ]
        })
        fs.closeSync(fd)
        return child
    }

    /*  await the readiness of a child process (checked every 100ms up to <timeout> milliseconds),
        resolving to null once ready, else to the reason of its failure, like "exited during
        startup (code 1)" (where a child process not ready within the timeout is terminated)  */
    protected async awaitChild (child: ChildProcess, ready: () => boolean, timeout: number): Promise<string | null> {
        let exited = false
        let exitCode: number | null = null
        child.once("exit", (code) => {
            exited   = true
            exitCode = code
        })
        for (let waited = 0; waited < timeout; waited += 100) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            if (exited)
                break
            if (ready())
                return null
        }
        if (!exited)
            child.kill("SIGTERM")
        return exited ?
            `exited during startup (code ${exitCode})` :
            "failed to start within timeout"
    }

    /*  await the readiness of the detached process, else fail with the tail of its log file  */
    protected async awaitDetached (child: ChildProcess, logFile: string, ready: () => boolean, timeout: number): Promise<void> {
        const failure = await this.awaitChild(child, ready, timeout)
        child.unref()
        if (failure === null)
            return
        const reason = `${this.label}: ${failure}`
        const tail   = Service.readLogTail(logFile, 20)
        throw new Error(tail.length > 0 ? `${reason}\n---- ${logFile} (tail) ----\n${tail}` : reason)
    }

    /*  check whether a process is still alive  */
    protected isAlive (pid: number): boolean {
        try {
            process.kill(pid, 0)
            return true
        }
        catch (err: unknown) {
            return (err as Error & { code?: string }).code === "EPERM"
        }
    }

    /*  terminate a process and wait (up to <timeout> milliseconds) until it is gone,
        resolving to false if it was already gone  */
    protected async terminate (pid: number, timeout: number): Promise<boolean> {
        try {
            process.kill(pid, "SIGTERM")
        }
        catch (err: unknown) {
            const e = err as Error & { code?: string }
            if (e.code !== "ESRCH")
                throw err
            return false
        }
        for (let waited = 0; waited < timeout; waited += 100) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            if (!this.isAlive(pid))
                return true
        }
        throw new Error(`${this.label}: process ${pid} did not stop within timeout`)
    }
}

