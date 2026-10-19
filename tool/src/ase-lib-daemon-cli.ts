/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                       from "node:path"
import fs                         from "node:fs"
import net                        from "node:net"
import { fileURLToPath }          from "node:url"
import { spawn }                  from "node:child_process"
import type { ChildProcess }      from "node:child_process"

import type { Command }           from "commander"
import { Tail }                   from "tail"

import type Log                   from "./ase-lib-log.js"

/*  the loopback host to probe the ports on, the range and the number of attempts
    of the random port allocation, and the bounds of the append-only log files:
    maximum tolerated size and number of tail lines surviving a trim  */
const HOST           = "127.0.0.1"
const PORT_MIN       = 42000
const PORT_MAX       = 44000
const PORT_TRIES     = 20
const LOG_MAX_SIZE   = 1024 * 1024
const LOG_KEEP_LINES = 2000

/*  reusable functionality: port allocation and log file handling of the background processes  */
export class Daemon {
    /*  try binding a single candidate port to verify availability  */
    static tryBind (port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const s = net.createServer()
            s.once("error", () => {
                resolve(false)
            })
            s.once("listening", () => {
                s.close(() => resolve(true))
            })
            s.listen(port, HOST)
        })
    }

    /*  allocate the preferred port, if given and available,
        else a fresh random port in PORT_MIN..PORT_MAX  */
    static async allocatePort (pref: number | null = null): Promise<number> {
        if (pref !== null && await Daemon.tryBind(pref))
            return pref
        for (let i = 0; i < PORT_TRIES; i++) {
            const p = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1))
            if (await Daemon.tryBind(p))
                return p
        }
        throw new Error(`failed to allocate a port in ${PORT_MIN}..${PORT_MAX} after ${PORT_TRIES} attempts`)
    }

    /*  trim the log file down to its tail if it grew beyond the size limit  */
    static trimLog (logFile: string): void {
        try {
            if (!fs.existsSync(logFile) || fs.statSync(logFile).size <= LOG_MAX_SIZE)
                return
            const tail = Daemon.readLogTail(logFile, LOG_KEEP_LINES)
            fs.writeFileSync(logFile, tail.length > 0 ? `${tail}\n` : "")
        }
        catch {
            /*  intentionally ignore all trimming errors, as a
                non-trimmable log file must never block the service  */
        }
    }

    /*  read the last N non-empty lines of a log file for diagnostics  */
    static readLogTail (logFile: string, lines: number): string {
        let fd: number | null = null
        try {
            fd = fs.openSync(logFile, "r")
            const size  = fs.fstatSync(fd).size
            const CHUNK = 8192
            const chunks: Buffer[] = []
            let pos     = size
            let count   = 0
            while (pos > 0 && count <= lines) {
                const n   = Math.min(CHUNK, pos)
                const buf = Buffer.alloc(n)
                pos -= n
                fs.readSync(fd, buf, 0, n, pos)
                chunks.unshift(buf)
                for (let i = 0; i < n; i++)
                    if (buf[i] === 10) count++
            }

            /*  decode once after re-assembly to avoid splitting
                multi-byte UTF-8 sequences at chunk boundaries  */
            const all = Buffer.concat(chunks).toString("utf8")
                .split("\n").filter((l) => l.length > 0)
            return all.slice(-lines).join("\n")
        }
        catch {
            return ""
        }
        finally {
            if (fd !== null)
                fs.closeSync(fd)
        }
    }

    /*  show a log file on stdout, either completely or its last <lines> lines only, and
        optionally follow it for newly appended lines (default: the last 10 lines first),
        where each line is passed through <transform> (e.g. to colorize parts of it)  */
    static async showLog (logFile: string, opts: { follow?: boolean, lines?: string },
        transform: (line: string) => string = (line) => line): Promise<number> {
        const lines = opts.lines !== undefined ? Number(opts.lines) : null
        if (lines !== null && (!Number.isInteger(lines) || lines < 1))
            throw new Error(`invalid number of lines: ${opts.lines}`)
        if (!fs.existsSync(logFile))
            return 0
        if (opts.follow) {
            /*  follow until interrupted (on log trimming,
                "tail" continues at the new end of the file)  */
            const tail = new Tail(logFile, { nLines: lines ?? 10 })
            tail.on("line", (line: string) => {
                process.stdout.write(`${transform(line)}\n`)
            })
            return await new Promise<number>((_resolve, reject) => {
                tail.on("error", (err: unknown) => {
                    reject(err instanceof Error ? err : new Error(String(err)))
                })
            })
        }
        const text = lines !== null ?
            Daemon.readLogTail(logFile, lines) :
            fs.readFileSync(logFile, "utf8").replace(/\n$/, "")
        process.stdout.write(text.length > 0 ? `${text.split("\n").map(transform).join("\n")}\n` : "")
        return 0
    }
}

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
            process.exitCode = await Daemon.showLog(file, opts, transform)
        })
    }

    /*  spawn the CLI with the arguments <args> detached, with the additional
        environment <env>, logging into the (trimmed) log file <logFile>  */
    protected spawnDetached (args: string[], env: NodeJS.ProcessEnv, logFile: string): ChildProcess {
        fs.mkdirSync(path.dirname(logFile), { recursive: true })
        Daemon.trimLog(logFile)
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
        const tail   = Daemon.readLogTail(logFile, 20)
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

