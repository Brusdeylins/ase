/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                      from "node:path"
import fs                        from "node:fs"
import crypto                    from "node:crypto"
import { createRequire }         from "node:module"
import type { IncomingMessage }  from "node:http"
import type { Duplex }           from "node:stream"

import which                     from "which"
import { WebSocketServer }       from "ws"
import type { WebSocket }        from "ws"
import type { IPty }             from "node-pty"

import type Log                  from "./ase-lib-log.js"
import { Task }                  from "./ase-task.js"
import * as TaskFormat           from "./ase-task-format.js"
import {
    terminalArgs, terminalChat, terminalConfigure, terminalReport, terminalEnv, terminalResumeFailed, terminalModels, terminalEfforts,
    terminalTasksNew, terminalTasksPoll
}                                from "./ase-task-board-terminal.js"
import type { TerminalTasks }    from "./ase-task-board-terminal.js"
import type { BoardAuth }        from "./ase-task-board-web-server.js"

/*  the environment of the terminals: the log, the authentication of the board, and its port  */
export type TerminalEnv = { log: Log, auth: BoardAuth, port: () => number }

/*  the route of the terminal WebSocket of a task, and of the guard hook of its agent tool  */
export const terminalRoute = (id: string): string =>
    `/task-board/terminal/${encodeURIComponent(id)}`
export const terminalGuardRoute = (id: string): string =>
    `/task-board/api/task/${encodeURIComponent(id)}/guard`

/*  the maximum size of the replayed output of a terminal, the maximum amount of not yet
    transmitted data of a client (beyond which it cannot keep up), the idle time without
    any client after which the process ends, and the size of a terminal until a client tells its own  */
const HISTORY_MAX = 64 * 1024 * 1024
const BUFFER_MAX  = 128 * 1024 * 1024
const IDLE_MS     = 30 * 60 * 1000
const COLS_INIT   = 120
const ROWS_INIT   = 32

/*  the size of a client, as the cell grid it shows  */
type Size = { cols: number, rows: number }

/*  the terminal of a task: its process (one for all clients), the complete output of it (to replay for
    late clients, as e.g. the data of terminal graphics is transmitted only once), the exit code of an ended
    process, and its clients with their sizes (the terminal being as small as the smallest of them)  */
type Terminal = {
    id:       string
    pty:      IPty | null
    starting: boolean
    exited:   number | null
    history:  Buffer[]
    size:     number
    clients:  Map<WebSocket, Size | null>
    cols:     number
    rows:     number
    idle:     ReturnType<typeof setTimeout> | null
    started:  number
    theme:    "dark" | "light" | null
    baseline: { model: string, effort: string } | null
    tasks:    TerminalTasks | null
}
const terminals = new Map<string, Terminal>()
const wss       = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })

/*  whether any terminal is in use (its process running or a client attached), which keeps the service from idling out  */
export const terminalsActive = (): boolean =>
    [ ...terminals.values() ].some((term) => term.pty !== null || term.clients.size > 0)

/*  send a control message resp. output to all clients of a terminal  */
const sendAll = (term: Terminal, data: string | Buffer): void => {
    for (const ws of term.clients.keys()) {
        if (ws.readyState !== ws.OPEN)
            continue
        if (ws.bufferedAmount > BUFFER_MAX)
            ws.terminate()
        else
            ws.send(data, { binary: typeof data !== "string" })
    }
}

/*  end the process of a terminal, and forget the terminal if requested  */
const end = (term: Terminal, forget: boolean): void => {
    if (term.idle !== null)
        clearTimeout(term.idle)
    term.idle = null
    const pty = term.pty
    term.pty   = null
    term.tasks = null
    pty?.kill()
    if (forget)
        terminals.delete(term.id)
}

/*  end the terminal after the idle time, while no client is attached  */
const idle = (env: TerminalEnv, term: Terminal): void => {
    if (term.idle !== null)
        clearTimeout(term.idle)
    term.idle = term.clients.size > 0 ? null : setTimeout(() => {
        env.log.write("info", `board: terminal of task "${term.id}" ended (idle)`)
        end(term, true)
    }, IDLE_MS)
}

/*  resize the terminal to the smallest size of its clients (as in tmux), so all of them show it entirely  */
const fit = (term: Terminal): void => {
    const sizes = [ ...term.clients.values() ].filter((size) => size !== null)
    if (sizes.length === 0)
        return
    const cols = Math.min(...sizes.map((size) => size.cols))
    const rows = Math.min(...sizes.map((size) => size.rows))
    if (cols === term.cols && rows === term.rows)
        return
    term.cols = cols
    term.rows = rows
    term.pty?.resize(cols, rows)
}

/*  the node-pty helper of the platform may lack its execute permission after the installation  */
const helperFix = (): void => {
    const root   = path.dirname(createRequire(import.meta.url).resolve("node-pty/package.json"))
    const helper = path.join(root, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper")
    if (fs.existsSync(helper))
        fs.chmodSync(helper, 0o755)
}

/*  the terminal of a task, created on demand  */
const terminalOf = (env: TerminalEnv, id: string): Terminal => {
    let term = terminals.get(id)
    if (term === undefined) {
        term = {
            id, pty: null, starting: false, exited: null, history: [], size: 0,
            clients: new Map(), cols: COLS_INIT, rows: ROWS_INIT, idle: null, started: 0, theme: null, baseline: null, tasks: null
        }
        terminals.set(id, term)
        idle(env, term)
    }
    return term
}

/*  start the agent tool of a terminal in the project directory (at its current size, until a client tells
    its own), resuming the session of the task, which is created if it turns out not to exist after all  */
const start = async (env: TerminalEnv, term: Terminal, theme?: "dark" | "light", create = false): Promise<void> => {
    if (term.starting || term.pty !== null)
        return
    term.starting = true
    try {
        const pty = await import("node-pty")
        const cli = await which("claude").catch(() => "")
        if (cli === "") {
            term.exited = 127
            sendAll(term, JSON.stringify({ type: "error", message: "agent tool \"claude\" not found" }))
            sendAll(term, JSON.stringify({ type: "exit", code: 127 }))
            return
        }
        helperFix()

        /*  graphics are enabled by the terminal program, which the browser terminal emulates ("ghostty"), and
            the hook of the agent tool guarding the task asks the board by its token  */
        const childEnv = Object.assign(terminalEnv(term.id, process.env, true), {
            TERM: "xterm-256color", TERM_PROGRAM: "ghostty", COLORTERM: "truecolor", ASE_GUARD_TOKEN: env.auth.token
        })
        const args  = terminalArgs(term.id, { create, theme, guard: `http://127.0.0.1:${env.port()}${terminalGuardRoute(term.id)}` })
        const began = Date.now()
        term.started = began
        term.theme   = theme ?? null
        term.baseline = null
        term.tasks    = terminalTasksNew(term.id)
        const child = pty.spawn(cli, args, {
            name: "xterm-256color", cols: term.cols, rows: term.rows, cwd: Task.projectRoot(), env: childEnv, encoding: null
        })
        env.log.write("info", `board: started terminal of task "${term.id}" (pid ${child.pid})`)
        term.pty    = child
        term.exited = null
        child.onData((data) => {
            const buf = Buffer.from(data)
            term.history.push(buf)
            term.size += buf.length
            while (term.size > HISTORY_MAX && term.history.length > 1)
                term.size -= term.history.shift()!.length
            sendAll(term, buf)
        })
        child.onExit(({ exitCode }) => {
            if (term.pty !== child)
                return
            term.pty   = null
            term.tasks = null

            /*  resuming a session which does not exist ends at once: create it instead (once)  */
            if (terminalResumeFailed(term.id, args, exitCode, Date.now() - began, Buffer.concat(term.history).toString("utf8"))) {
                env.log.write("info", `board: session of task "${term.id}" not found, creating it`)
                term.history = []
                term.size    = 0
                sendAll(term, Buffer.from("\x1bc"))
                start(env, term, theme, true).catch((err: unknown) => {
                    env.log.write("error", `board: terminal of task "${term.id}" failed: ${err instanceof Error ? err.message : String(err)}`)
                })
                return
            }
            env.log.write("info", `board: terminal of task "${term.id}" ended (exit code ${exitCode})`)
            term.exited = exitCode
            sendAll(term, JSON.stringify({ type: "exit", code: exitCode }))
        })
    }
    finally {
        term.starting = false
    }
}

/*  the state of the terminal of a task, with its model and effort, the number of its running background tasks, and the WebSocket URL with its capability  */
export const terminalState = (env: TerminalEnv, id: string) => {
    const term   = terminals.get(id)
    const route  = terminalRoute(id)
    const report = term?.pty != null ? terminalReport(id, term.started) : null

    /*  keep the model and effort of the chat of the task as the user changes them within the agent tool (by its "/model"
        and "/effort" commands, which it then also saves as the defaults of the user), relative to those it reported first  */
    if (term !== undefined && report !== null) {
        const now = { model: report.model, effort: report.effort }
        if (term.baseline === null)
            term.baseline = now
        else if (now.model !== term.baseline.model || now.effort !== term.baseline.effort) {
            const chat = terminalChat(id)
            terminalConfigure(id, now.model !== term.baseline.model ? now.model : chat.model, now.effort !== term.baseline.effort ? now.effort : chat.effort)
            term.baseline = now
        }
    }
    const chat = terminalChat(id)
    return {
        running: term?.pty != null, exited: term?.exited ?? null, model: chat.model, effort: chat.effort, theme: term?.theme ?? null,
        background: term?.pty != null && term.tasks !== null ? terminalTasksPoll(term.tasks) : 0,
        context: report !== null ? { pct: report.pct, tokens: report.tokens, size: report.size } : null,
        url: `${route}?cap=${env.auth.capability(route)}`
    }
}

/*  start the process of the terminal of a task right away, if it neither runs nor ended, so it is
    already running once a client attaches (and tells its size)  */
export const terminalStart = async (env: TerminalEnv, id: string, theme?: "dark" | "light"): Promise<void> => {
    if (!TaskFormat.TASK_ID_RE.test(id))
        throw new Error(`invalid task id "${id}"`)
    const term = terminalOf(env, id)
    if (term.pty === null && term.exited === null)
        await start(env, term, theme)
}

/*  change the model and effort of the terminal of a task and (re)start its process with them, resuming its
    session, where a restart without change also restarts an ended process  */
export const terminalRestart = async (env: TerminalEnv, id: string, model: string, effort: string, theme?: "dark" | "light"): Promise<void> => {
    if (!TaskFormat.TASK_ID_RE.test(id))
        throw new Error(`invalid task id "${id}"`)
    if (!terminalModels.includes(model) || !terminalEfforts.includes(effort))
        throw new Error("invalid model or effort")
    terminalConfigure(id, model, effort)
    const term = terminalOf(env, id)
    const pty  = term.pty
    term.pty   = null
    term.tasks = null
    pty?.kill()
    term.history = []
    term.size    = 0
    term.exited  = null
    sendAll(term, Buffer.from("\x1bc"))
    await start(env, term, theme)
}

/*  handle a WebSocket handshake on the terminal route of a task, authenticated by the capability of the path, attaching
    the client to the terminal of the task (started, if not yet), answering whether the path is a terminal route  */
export const terminalUpgrade = (env: TerminalEnv, req: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const m   = /^\/task-board\/terminal\/([^/]+)$/.exec(url.pathname)
    if (m === null)
        return false
    const reject = (status: number, text: string) => {
        socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
    }

    /*  accept only loopback "Host" headers of the service and the same origin of the page (as a
        WebSocket handshake is not restricted by the same-origin policy of the browser)  */
    const host   = (req.headers.host ?? "").toLowerCase()
    const origin = req.headers.origin
    const port   = env.port()
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host) || (origin !== undefined && new URL(origin).host.toLowerCase() !== host)) {
        reject(421, "Misdirected Request")
        return true
    }

    /*  require the capability of the path (as a browser cannot send headers with a WebSocket)  */
    const given    = Buffer.from(url.searchParams.get("cap") ?? "", "utf8")
    const expected = Buffer.from(env.auth.capability(url.pathname), "utf8")
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        reject(401, "Unauthorized")
        return true
    }
    const id = decodeURIComponent(m[1])
    if (!TaskFormat.TASK_ID_RE.test(id)) {
        reject(400, "Bad Request")
        return true
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        const term = terminalOf(env, id)
        term.clients.set(ws, null)
        idle(env, term)
        fit(term)
        ws.send(JSON.stringify({ type: "status", shell: "claude" }))
        if (term.history.length > 0)
            ws.send(Buffer.concat(term.history), { binary: true })
        if (term.exited !== null)
            ws.send(JSON.stringify({ type: "exit", code: term.exited }))
        else
            terminalStart(env, id).catch((err: unknown) => {
                env.log.write("error", `board: terminal of task "${id}" failed: ${err instanceof Error ? err.message : String(err)}`)
            })
        ws.on("message", (raw) => {
            let msg: { type?: unknown, data?: unknown, cols?: unknown, rows?: unknown }
            try {
                msg = JSON.parse(raw.toString())
            }
            catch {
                return
            }
            if (msg.type === "input" && typeof msg.data === "string")
                term.pty?.write(msg.data)
            else if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number"
                && msg.cols >= 2 && msg.rows >= 1 && msg.cols <= 1000 && msg.rows <= 1000) {
                term.clients.set(ws, { cols: Math.floor(msg.cols), rows: Math.floor(msg.rows) })
                fit(term)
            }
        })
        ws.on("close", () => {
            term.clients.delete(ws)
            fit(term)
            idle(env, term)
        })
    })
    return true
}

/*  end all terminals (on stopping the service)  */
export const terminalsEnd = (): void => {
    for (const term of terminals.values())
        end(term, true)
}
