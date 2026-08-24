/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                   from "node:path"
import os                     from "node:os"
import fs                     from "node:fs"
import { fileURLToPath }      from "node:url"
import { spawn }              from "node:child_process"

import { Command }            from "commander"
import { execaSync }          from "execa"
import { parse as yamlParse, stringify as yamlStringify, isScalar } from "yaml"
import Table                  from "cli-table3"
import lockfile               from "proper-lockfile"
import writeFileAtomic        from "write-file-atomic"

import type Log               from "./ase-log.js"
import { isLogLevel }         from "./ase-log.js"
import { Config, configSchema } from "./ase-config.js"
import { Task, taskStates }   from "./ase-task.js"
import { Service }            from "./ase-service.js"
import { writeStdout }        from "./ase-stdio.js"

/*  environment variables handing the daemon context from the spawning
    process to the detached "ase backlog serve" daemon process  */
const SERVE_ENV   = "ASE_BACKLOG_SERVE"
const PORT_ENV    = "ASE_BACKLOG_PORT"
const LEVEL_ENV   = "ASE_BACKLOG_LOG_LEVEL"

/*  port allocation range of the per-project board servers (deliberately
    disjoint from the 42000..44000 range of the ASE service)  */
const PORT_MIN    = 46000
const PORT_MAX    = 48000
const PORT_TRIES  = 20

/*  debounce interval of the file watchers  */
const DEBOUNCE_MS = 300

/*  a single board lane: its column name and the ASE task plan lifecycle
    states it groups, the first state being the lane's primary state  */
export interface Lane {
    name:   string
    states: string[]
}

/*  default lane specification: every ASE task plan lifecycle state is
    grouped into exactly one board lane  */
export const defaultLanes =
    "Crafting=DRAFTED+REJECTED;Ready=APPROVED;Deferred=DEFERRED;" +
    "Implementation=STARTED+BLOCKED;Code-Review=COMPLETED;Closed=CLOSED+CANCELLED"

/*  a single entry of the user-scope registry of running board servers  */
interface RegistryEntry {
    projectId: string
    root:      string
    port:      number
    pid:       number
}

/*  reusable functionality: Backlog.md mirror rendering, status
    write-back, and board server registry management  */
export class Backlog {
    /*  parse a lane specification of the form
        "Lane=STATE[+STATE...][;Lane=...]" into the lane list, enforcing
        that every lifecycle state is grouped into exactly one lane  */
    static parseLanes (spec: string): Lane[] {
        const lanes: Lane[] = []
        const seen = new Set<string>()
        for (const term of spec.split(";")) {
            const m = /^([A-Za-z0-9 _-]+)=([A-Z]+(?:\+[A-Z]+)*)$/.exec(term.trim())
            if (m === null)
                throw new Error(`backlog: invalid lane term "${term.trim()}" ` +
                    "(expected: \"<lane>=<STATE>[+<STATE>...]\")")
            const states = m[2].split("+")
            for (const state of states) {
                if (!taskStates.includes(state))
                    throw new Error(`backlog: invalid state "${state}" in lane "${m[1]}" ` +
                        `(expected one of: ${taskStates.join(", ")})`)
                if (seen.has(state))
                    throw new Error(`backlog: state "${state}" is grouped into more than one lane`)
                seen.add(state)
            }
            lanes.push({ name: m[1].trim(), states })
        }
        const missing = taskStates.filter((state) => !seen.has(state))
        if (missing.length > 0)
            throw new Error(`backlog: lane specification does not cover state(s): ${missing.join(", ")}`)
        return lanes
    }

    /*  map a lifecycle state onto its board lane name  */
    static stateToLane (lanes: Lane[], state: string): string {
        const lane = lanes.find((l) => l.states.includes(state))
        return lane !== undefined ? lane.name : lanes[0].name
    }

    /*  map a board lane name onto its primary lifecycle state  */
    static laneToState (lanes: Lane[], name: string): string | null {
        const lane = lanes.find((l) => l.name === name)
        return lane !== undefined ? lane.states[0] : null
    }

    /*  read the effective backlog settings from the layered configuration  */
    static settings (log: Log): { projectId: string, port: number | null, lanes: Lane[] } {
        const cfg = new Config("config", configSchema, log)
        cfg.read()
        const read = (key: string): string => {
            const val = cfg.get(key)
            if (val === undefined)
                return ""
            return String(isScalar(val) ? val.value : val)
        }
        const projectId = read("project.id") || path.basename(Task.projectRoot())
        const rawPort   = read("project.backlog.port")
        const port      = rawPort !== "" ? Number(rawPort) : null
        const lanes     = Backlog.parseLanes(read("project.backlog.lanes") || defaultLanes)
        return { projectId, port, lanes }
    }

    /*  resolve the mirror directory holding the generated Backlog.md
        project of the current ASE project  */
    static mirrorDir (): string {
        return path.join(Task.projectRoot(), ".ase", "backlog")
    }

    /*  resolve the directory holding the mirrored Backlog.md task files  */
    static tasksDir (): string {
        return path.join(Backlog.mirrorDir(), "backlog", "tasks")
    }

    /*  resolve the file persisting the stable ASE-id-to-ordinal mapping  */
    static mappingFile (): string {
        return path.join(Backlog.mirrorDir(), "mapping.yaml")
    }

    /*  resolve the log file of the detached board server daemon  */
    static logFile (): string {
        return path.join(Backlog.mirrorDir(), "serve.log")
    }

    /*  resolve the user-scope registry file of running board servers  */
    static registryFile (): string {
        return path.join(os.homedir(), ".ase", "backlog", "registry.yaml")
    }

    /*  ensure the mirror directory exists as a minimal Backlog.md
        project: task directory, Git repository (Backlog.md expects
        one), and generated "config.yml" carrying the lane names as its
        board statuses  */
    static ensureMirror (log: Log, projectId: string, lanes: Lane[], port: number | null): void {
        const mirror = Backlog.mirrorDir()
        fs.mkdirSync(Backlog.tasksDir(), { recursive: true })
        if (!fs.existsSync(path.join(mirror, ".git"))) {
            try {
                execaSync("git", [ "init", "--quiet" ], { cwd: mirror, stderr: "ignore" })
            }
            catch {
                /*  tolerate a missing Git, Backlog.md still works read-only  */
                log.write("warning", "backlog: cannot \"git init\" the mirror directory")
            }
        }
        const config: Record<string, unknown> = {
            project_name:      projectId,
            statuses:          lanes.map((l) => l.name),
            default_status:    lanes[0].name,
            auto_open_browser: false,
            remote_operations: false,
            auto_commit:       false
        }
        if (port !== null)
            config.default_port = port
        const file = path.join(mirror, "backlog", "config.yml")
        const text = yamlStringify(config)
        if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text)
            writeFileAtomic.sync(file, text, { encoding: "utf8" })
    }

    /*  load and save the stable ASE-id-to-ordinal mapping, which pins
        every ASE task id to its numeric Backlog.md task id  */
    static loadMapping (): Record<string, number> {
        const file = Backlog.mappingFile()
        if (!fs.existsSync(file))
            return {}
        const data = yamlParse(fs.readFileSync(file, "utf8")) as Record<string, unknown> | null
        const mapping: Record<string, number> = {}
        if (data !== null && typeof data === "object")
            for (const [ id, n ] of Object.entries(data))
                if (typeof n === "number" && Number.isInteger(n))
                    mapping[id] = n
        return mapping
    }
    static saveMapping (mapping: Record<string, number>): void {
        fs.mkdirSync(Backlog.mirrorDir(), { recursive: true })
        writeFileAtomic.sync(Backlog.mappingFile(), yamlStringify(mapping), { encoding: "utf8" })
    }

    /*  read the "Status:" frontmatter key of an ASE task plan text,
        falling back to the "DRAFTED" default of the task plan format  */
    static statusOf (text: string): string {
        const fm = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/.exec(text)
        if (fm === null)
            return "DRAFTED"
        const m = /^Status:[ \t]*(\S+)[ \t]*$/m.exec(fm[1])
        if (m === null)
            return "DRAFTED"
        return m[1]
    }

    /*  read the "#   TASK: <title>" heading of an ASE task plan text  */
    static titleOf (text: string, id: string): string {
        const m = /^#[ \t]+TASK[ \t]*:[ \t]*(.*)$/m.exec(text)
        return m !== null && m[1].trim() !== "" ? m[1].trim() : id
    }

    /*  sanitize a task title for use inside a mirror task filename  */
    static safeTitle (title: string): string {
        const safe = title.replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60).trim()
        return safe !== "" ? safe : "untitled"
    }

    /*  forward sync: render every ASE task plan into its mirrored
        Backlog.md task file and sweep mirror files of vanished plans;
        only physically writes files whose content actually changed
        (the echo guard against watcher-driven sync loops); returns the
        number of written or removed mirror files  */
    static syncForward (log: Log, lanes: Lane[]): number {
        fs.mkdirSync(Backlog.tasksDir(), { recursive: true })
        const mapping = Backlog.loadMapping()
        const ids     = Task.list(log).map((entry) => entry.id)
        let   next    = Object.values(mapping).reduce((a, b) => Math.max(a, b), 0) + 1
        let   grown   = false
        let   changed = 0
        const expected = new Map<number, string>()
        for (const id of ids) {
            if (mapping[id] === undefined) {
                mapping[id] = next++
                grown = true
            }
            const n     = mapping[id]
            const text  = Task.load(log, id)
            const state = taskStates.includes(Backlog.statusOf(text)) ? Backlog.statusOf(text) : "DRAFTED"
            const title = Backlog.titleOf(text, id)
            const body  = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n\s*/, "")
            const front = yamlStringify({
                id:     `task-${n}`,
                title,
                status: Backlog.stateToLane(lanes, state),
                labels: [ `ase:${id}` ]
            })
            const content = `---\n${front}---\n\n## Description\n\n${body}`
            const file    = path.join(Backlog.tasksDir(), `task-${n} - ${Backlog.safeTitle(title)}.md`)
            expected.set(n, file)
            if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
                writeFileAtomic.sync(file, content, { encoding: "utf8" })
                changed++
            }
        }
        if (grown)
            Backlog.saveMapping(mapping)

        /*  sweep: drop mirror files whose ordinal maps to a vanished
            plan or whose filename drifted (e.g. after a title change);
            foreign files without a "task-<n>" prefix are left alone  */
        for (const entry of fs.readdirSync(Backlog.tasksDir())) {
            const m = /^task-(\d+) - .*\.md$/.exec(entry)
            if (m === null)
                continue
            const file = path.join(Backlog.tasksDir(), entry)
            if (expected.get(Number(m[1])) !== file) {
                fs.rmSync(file, { force: true })
                changed++
            }
        }
        return changed
    }

    /*  write-back sync: propagate a lane change made on the board
        (drag&drop in the web UI or TUI) back into the "Status:"
        frontmatter key of the corresponding ASE task plan -- and
        nothing else; returns the ids of the updated plans  */
    static writeBack (log: Log, lanes: Lane[]): string[] {
        const dir = Backlog.tasksDir()
        if (!fs.existsSync(dir))
            return []
        const mapping = Backlog.loadMapping()
        const reverse = new Map<number, string>()
        for (const [ id, n ] of Object.entries(mapping))
            reverse.set(n, id)
        const changed: string[] = []
        for (const entry of fs.readdirSync(dir)) {
            const m = /^task-(\d+) - .*\.md$/.exec(entry)
            if (m === null)
                continue
            const id = reverse.get(Number(m[1]))
            if (id === undefined)
                continue
            const fm = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/.exec(fs.readFileSync(path.join(dir, entry), "utf8"))
            if (fm === null)
                continue
            const front = yamlParse(fm[1]) as Record<string, unknown> | null
            const lane  = typeof front?.status === "string" ? front.status : null
            if (lane === null)
                continue
            const state = Backlog.laneToState(lanes, lane)
            if (state === null)
                continue
            const file = Task.path(log, id)
            if (!fs.existsSync(file))
                continue
            const text = fs.readFileSync(file, "utf8")
            if (Backlog.stateToLane(lanes, Backlog.statusOf(text)) === lane)
                continue
            const updated = Backlog.replaceStatus(text, state)
            if (updated === null) {
                log.write("warning", `backlog: task "${id}" carries no frontmatter -- skipping write-back`)
                continue
            }
            fs.writeFileSync(file, updated, "utf8")
            changed.push(id)
            log.write("info", `backlog: task "${id}" moved to lane "${lane}" -- status set to "${state}"`)
        }
        return changed
    }

    /*  rewrite (or insert) the "Status:" frontmatter key of an ASE task
        plan text, leaving every other line untouched; returns null if
        the plan carries no frontmatter block at all  */
    static replaceStatus (text: string, state: string): string | null {
        const fm = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/.exec(text)
        if (fm === null)
            return null
        if (/^Status:[ \t]*\S+[ \t]*$/m.test(fm[1])) {
            const front = fm[1].replace(/^(Status:[ \t]*)\S+[ \t]*$/m, `$1${state}`)
            return text.replace(fm[1], front)
        }
        const lines = fm[1].replace(/\r?\n$/, "").split(/\r?\n/)
        let   at    = 0
        for (let i = 0; i < lines.length; i++)
            if (/^(Id|Created|Modified):/.test(lines[i]))
                at = i + 1
        lines.splice(at, 0, `${"Status:".padEnd(12)}${state}`)
        return text.replace(fm[1], `${lines.join("\n")}\n`)
    }

    /*  check whether a process id is still alive  */
    static pidAlive (pid: number): boolean {
        try {
            process.kill(pid, 0)
            return true
        }
        catch (err: unknown) {
            return (err as NodeJS.ErrnoException).code === "EPERM"
        }
    }

    /*  load the registry of running board servers, dropping dead entries  */
    static registryLoad (): RegistryEntry[] {
        const file = Backlog.registryFile()
        if (!fs.existsSync(file))
            return []
        const data = yamlParse(fs.readFileSync(file, "utf8")) as unknown
        if (!Array.isArray(data))
            return []
        const entries: RegistryEntry[] = []
        for (const e of data as Array<Record<string, unknown>>)
            if (typeof e?.projectId === "string" && typeof e?.root === "string"
                && typeof e?.port  === "number" && typeof e?.pid  === "number")
                entries.push({ projectId: e.projectId, root: e.root, port: e.port, pid: e.pid })
        return entries.filter((e) => Backlog.pidAlive(e.pid))
    }

    /*  update the registry of running board servers under a
        cross-process advisory lock  */
    static registryUpdate (cb: (entries: RegistryEntry[]) => RegistryEntry[]): void {
        const file = Backlog.registryFile()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        if (!fs.existsSync(file))
            fs.writeFileSync(file, "", "utf8")
        const release = lockfile.lockSync(file)
        try {
            const entries = cb(Backlog.registryLoad())
            writeFileAtomic.sync(file, yamlStringify(entries), { encoding: "utf8" })
        }
        finally {
            release()
        }
    }

    /*  allocate a fresh random board server port in PORT_MIN..PORT_MAX  */
    static async allocatePort (): Promise<number> {
        for (let i = 0; i < PORT_TRIES; i++) {
            const p = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1))
            if (await Service.tryBind(p))
                return p
        }
        throw new Error(`backlog: failed to allocate a port in ${PORT_MIN}..${PORT_MAX} after ${PORT_TRIES} attempts`)
    }

    /*  resolve the Backlog.md CLI executable: prefer the pinned local
        dependency, fall back to a "backlog" from the PATH  */
    static bin (): string {
        const name = process.platform === "win32" ? "backlog.cmd" : "backlog"
        let dir = path.dirname(fileURLToPath(import.meta.url))
        for (;;) {
            const candidate = path.join(dir, "node_modules", ".bin", name)
            if (fs.existsSync(candidate))
                return candidate
            const parent = path.dirname(dir)
            if (parent === dir)
                return "backlog"
            dir = parent
        }
    }

    /*  open a URL in the default browser of the platform  */
    static openBrowser (url: string): void {
        let cmd:  string
        let args: string[]
        if (process.platform === "darwin") {
            cmd  = "open"
            args = [ url ]
        }
        else if (process.platform === "win32") {
            cmd  = "cmd"
            args = [ "/c", "start", "", url ]
        }
        else {
            cmd  = "xdg-open"
            args = [ url ]
        }
        const child = spawn(cmd, args, { detached: true, stdio: "ignore" })
        child.unref()
    }
}

/*  CLI command "ase backlog"  */
export default class BacklogCommand {
    constructor (private log: Log) {}

    /*  daemon-side: run the board server of the current project in the
        foreground -- the spawned Backlog.md web UI plus the two file
        watchers bridging ".ase/task" and the mirror directory  */
    private async runServe (port: number): Promise<void> {
        const { projectId, lanes } = Backlog.settings(this.log)
        const root = Task.projectRoot()
        Backlog.ensureMirror(this.log, projectId, lanes, port)
        Backlog.syncForward(this.log, lanes)

        /*  register this daemon, replacing any dead sibling of the project  */
        Backlog.registryUpdate((entries) => [
            ...entries.filter((e) => e.root !== root),
            { projectId, root, port, pid: process.pid }
        ])
        const unregister = (): void => {
            try {
                Backlog.registryUpdate((entries) => entries.filter((e) => e.pid !== process.pid))
            }
            catch {
                /*  a dead entry is pruned by the next registry reader anyway  */
            }
        }

        /*  spawn the Backlog.md web UI as a foreground child  */
        this.log.write("info", `backlog: board server for project "${projectId}" listening on port ${port}`)
        const child = spawn(Backlog.bin(), [ "browser", "--port", String(port), "--no-open" ],
            { cwd: Backlog.mirrorDir(), stdio: "inherit" })
        child.on("exit", (code) => {
            this.log.write("info", `backlog: web UI exited (code ${code ?? 0})`)
            unregister()
            process.exit(code ?? 0)
        })
        for (const signal of [ "SIGINT", "SIGTERM" ] as const)
            process.on(signal, () => {
                child.kill("SIGTERM")
                unregister()
                process.exit(0)
            })

        /*  watch both sides, debounced and re-entrancy guarded; the
            content comparison inside the sync primitives keeps the two
            watchers from ping-ponging each other  */
        let timer: NodeJS.Timeout | null = null
        let busy  = false
        const kick = (): void => {
            if (timer !== null)
                clearTimeout(timer)
            timer = setTimeout(() => {
                timer = null
                if (busy)
                    return
                busy = true
                try {
                    Backlog.writeBack(this.log, lanes)
                    Backlog.syncForward(this.log, lanes)
                }
                catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err)
                    this.log.write("error", `backlog: sync failed: ${message}`)
                }
                finally {
                    busy = false
                }
            }, DEBOUNCE_MS)
        }
        fs.mkdirSync(Task.baseDir(this.log), { recursive: true })
        fs.watch(Task.baseDir(this.log), kick)
        fs.watch(Backlog.tasksDir(), kick)
        return new Promise<void>(() => { /*  never resolves  */ })
    }

    /*  ensure the board server daemon of the current project is
        running, spawning it detached if needed; returns its port  */
    private async doStart (): Promise<number> {
        const root = Task.projectRoot()
        const live = Backlog.registryLoad().find((e) => e.root === root)
        if (live !== undefined)
            return live.port
        const { port: configured } = Backlog.settings(this.log)
        const port    = configured ?? await Backlog.allocatePort()
        const logFile = Backlog.logFile()
        fs.mkdirSync(path.dirname(logFile), { recursive: true })
        Service.trimLog(logFile)
        const fd    = fs.openSync(logFile, "a")
        const entry = fileURLToPath(new URL("./ase.js", import.meta.url))
        const child = spawn(process.execPath, [ entry, "backlog", "serve" ], {
            detached: true,
            cwd:      root,
            env:      { ...process.env, [SERVE_ENV]: "1", [PORT_ENV]: String(port), [LEVEL_ENV]: this.log.logLevel() },
            stdio:    [ "ignore", fd, fd ]
        })
        fs.closeSync(fd)
        for (let i = 0; i < 50; i++) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            const e = Backlog.registryLoad().find((x) => x.root === root)
            if (e !== undefined) {
                this.log.write("info", `backlog: board server started on port ${e.port}`)
                child.unref()
                return e.port
            }
        }
        child.kill("SIGTERM")
        const tail   = Service.readLogTail(logFile, 20)
        const detail = tail.length > 0 ? `\n---- ${logFile} (tail) ----\n${tail}` : ""
        throw new Error(`backlog: board server failed to start within timeout${detail}`)
    }

    /*  web flow: ensure the daemon and open the board web UI  */
    private async doWeb (): Promise<number> {
        const port = await this.doStart()
        const url  = `http://127.0.0.1:${port}/`
        Backlog.openBrowser(url)
        await writeStdout(`backlog: board web UI: ${url}\n`)
        return 0
    }

    /*  board flow: sync, run the interactive TUI, write back  */
    private doBoard (): number {
        const { projectId, lanes } = Backlog.settings(this.log)
        Backlog.ensureMirror(this.log, projectId, lanes, null)
        Backlog.syncForward(this.log, lanes)
        execaSync(Backlog.bin(), [ "board" ], { cwd: Backlog.mirrorDir(), stdio: "inherit" })
        Backlog.writeBack(this.log, lanes)
        return 0
    }

    /*  sync flow: one-shot bidirectional synchronization  */
    private async doSync (): Promise<number> {
        const { projectId, lanes } = Backlog.settings(this.log)
        Backlog.ensureMirror(this.log, projectId, lanes, null)
        const back    = Backlog.writeBack(this.log, lanes)
        const forward = Backlog.syncForward(this.log, lanes)
        await writeStdout(`backlog: synced (${forward} mirror file(s) updated, ` +
            `${back.length} plan status(es) written back)\n`)
        return 0
    }

    /*  status flow: list all running board servers as a jump list  */
    private async doStatus (): Promise<number> {
        const entries = Backlog.registryLoad()
        if (entries.length === 0) {
            await writeStdout("backlog: no board servers running\n")
            return 1
        }
        const table = new Table({
            head:  [ "PROJECT", "PORT", "PID", "URL" ],
            chars: { "mid": "", "left-mid": "", "mid-mid": "", "right-mid": "" },
            style: { head: [ "blue" ] }
        })
        for (const e of entries)
            table.push([ e.projectId, String(e.port), String(e.pid), `http://127.0.0.1:${e.port}/` ])
        await writeStdout(`${table.toString()}\n`)
        return 0
    }

    /*  stop flow: terminate the board server(s)  */
    private async doStop (all: boolean): Promise<number> {
        const root    = Task.projectRoot()
        const entries = Backlog.registryLoad()
        const targets = all ? entries : entries.filter((e) => e.root === root)
        if (targets.length === 0) {
            await writeStdout("backlog: no matching board server running\n")
            return 0
        }
        for (const e of targets) {
            try {
                process.kill(e.pid, "SIGTERM")
            }
            catch {
                /*  the daemon died in between, the registry is pruned below  */
            }
            await writeStdout(`backlog: stopped board server of project "${e.projectId}" (port ${e.port})\n`)
        }
        const pids = new Set(targets.map((e) => e.pid))
        Backlog.registryUpdate((current) => current.filter((e) => !pids.has(e.pid)))
        return 0
    }

    /*  register commands  */
    register (program: Command): void {
        /*  register CLI top-level command "ase backlog"  */
        const backlog = program
            .command("backlog")
            .description("Visualize ASE task plans on a Backlog.md Kanban board")
            .action(() => {
                backlog.outputHelp()
                process.exit(1)
            })

        /*  register CLI sub-command "ase backlog board"  */
        backlog
            .command("board")
            .description("Show the interactive Kanban board in the terminal")
            .action(() => {
                process.exit(this.doBoard())
            })

        /*  register CLI sub-command "ase backlog web"  */
        backlog
            .command("web")
            .description("Run the board server in the background and open the web UI")
            .action(async () => {
                process.exit(await this.doWeb())
            })

        /*  register the hidden CLI sub-command "ase backlog serve":
            the user-facing surface is deliberately just "board" and
            "web" -- everything else is internal machinery  */
        backlog
            .command("serve", { hidden: true })
            .description("Run the board server in the foreground (internal)")
            .action(async () => {
                /*  adopt the log level of the spawning process, as the
                    detached daemon is started without any CLI options  */
                const level = process.env[LEVEL_ENV]
                if (process.env[SERVE_ENV] === "1" && level !== undefined && isLogLevel(level))
                    this.log.logLevel(level)
                const raw  = process.env[PORT_ENV]
                const port = raw !== undefined ? Number(raw) : await Backlog.allocatePort()
                await this.runServe(port)
            })

        /*  register the hidden CLI sub-command "ase backlog sync"  */
        backlog
            .command("sync", { hidden: true })
            .description("Synchronize task plans and board mirror once")
            .action(async () => {
                process.exit(await this.doSync())
            })

        /*  register the hidden CLI sub-command "ase backlog status"  */
        backlog
            .command("status", { hidden: true })
            .description("List all running board servers across all projects")
            .action(async () => {
                process.exit(await this.doStatus())
            })

        /*  register the hidden CLI sub-command "ase backlog stop"  */
        backlog
            .command("stop", { hidden: true })
            .description("Stop the board server of the current project")
            .option("-a, --all", "stop the board servers of all projects")
            .action(async (opts: { all?: boolean }) => {
                process.exit(await this.doStop(opts.all ?? false))
            })
    }
}
