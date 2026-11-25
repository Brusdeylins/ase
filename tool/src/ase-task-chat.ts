/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { fileURLToPath }                    from "node:url"
import { StringDecoder }                    from "node:string_decoder"

import { Command }                          from "commander"
import { execa }                            from "execa"
import { ofetch }                           from "ofetch"
import WebSocket                            from "ws"

import type Log                             from "./ase-lib-log.js"
import * as TaskFormat                      from "./ase-task-format.js"
import { loadServiceContext, SERVICE_HOST, serviceAuth } from "./ase-service.js"

/*  the key to detach from the chat (Ctrl+Q, which the agent tool does not bind, and which reaches
    the program in raw mode, as flow control is off), as the control character resp. as a key of
    the kitty keyboard protocol, which the agent tool may have enabled in the terminal  */
/*  eslint-disable-next-line no-control-regex  */
const DETACH = /\x11|\x1b\[113;5(?::\d+)?u/

/*  the modes the agent tool sets in the terminal, which are reset again on leaving it  */
const RESET = "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[?1004l\x1b[<u\x1b[0m\x1b[?25h"

/*  the state of the chat of a task as answered by the ASE service  */
type ChatState = {
    exited:   number | null
    model:    string
    effort:   string
    defaults: { model: string, effort: string }
    url:      string
}

/*  CLI sub-command "ase task chat"  */
export default class TaskChatCommand {
    constructor (private log: Log) {}

    /*  ensure the ASE service of the project runs and serves the board, and start the chat process
        of the task (if it does not run yet, resp. restart it if it ended), returning the base URL
        of the service, its token, and the state of the chat with the URL of its WebSocket  */
    private async connect (id: string): Promise<{ port: number, state: ChatState }> {
        const entry = fileURLToPath(new URL("./ase.js", import.meta.url))
        await execa(process.execPath, [ entry, "service", "start" ], { stdin: "ignore" })
        const { port, token } = loadServiceContext(this.log)
        if (port === null)
            throw new Error("chat: ASE service did not report a port")
        const url     = `http://${SERVICE_HOST}:${port}/task-board/api/task/${encodeURIComponent(id)}/terminal`
        const request = async (method: "PUT" | "POST", body?: { model: string, effort: string }): Promise<ChatState> => {
            const res = await ofetch.raw<ChatState>(url, {
                method, headers: serviceAuth(token), body, ignoreResponseError: true, timeout: 30 * 1000
            }).catch((err: unknown) => {
                throw new Error(`chat: ASE service not reachable on port ${port}`, { cause: err })
            })
            if (res.status === 404 || res.status === 405)
                throw new Error("chat: ASE service runs older ASE code without the task chat " +
                    "(restart it with \"ase service stop\" once no agent session uses it)")
            if (res.status === 401)
                throw new Error(`chat: ASE service on port ${port} rejects the token`)
            if (res.status !== 200)
                throw new Error(`chat: ASE service failed (${(res._data as { error?: string } | undefined)?.error ?? res.status})`)
            return res._data!
        }
        let state = await request("PUT")

        /*  an ended chat is started again, keeping its model and effort (where the defaults stay unset)  */
        if (state.exited !== null)
            state = await request("POST", {
                model:  state.model === state.defaults.model ? "" : state.model,
                effort: state.effort === state.defaults.effort ? "" : state.effort
            })
        return { port, state }
    }

    /*  attach the terminal to the chat process of the task, passing the bytes through in both directions
        (resp. the size of the terminal to it), until the user detaches (key or closing the terminal), or
        the chat process ends, in which case its exit code is returned  */
    private attach (id: string, port: number, state: ChatState): Promise<number | null> {
        return new Promise((resolve) => {
            const ws       = new WebSocket(`ws://${SERVICE_HOST}:${port}${state.url}`)
            const decoder  = new StringDecoder("utf8")
            let   settled  = false
            let   cleaned  = false
            let   altered  = false
            const send     = (msg: object) => {
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify(msg))
            }
            const size = () => send({ type: "resize", cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 })

            /*  leave the chat: restore the terminal, and report how  */
            const finish = (code: number | null, message?: string) => {
                if (settled)
                    return
                settled = true
                process.stdin.off("data", onInput)
                process.stdout.off("resize", size)
                process.stdin.setRawMode(false)
                process.stdin.pause()
                if (!cleaned) {
                    cleaned = true
                    process.stdout.write(RESET + (altered ? "\x1b[?1049l" : "") + "\r\n\x1b[J")
                }
                if (message !== undefined)
                    process.stdout.write(`${message}\n`)
                ws.close()
                resolve(code)
            }

            /*  pass the input on, up to the detach key  */
            const onInput = (chunk: Buffer) => {
                const data = decoder.write(chunk)
                const hit  = DETACH.exec(data)
                if (hit !== null) {
                    if (hit.index > 0)
                        send({ type: "input", data: data.slice(0, hit.index) })
                    finish(null, `detached from the chat of task ${id} (still running)`)
                    return
                }
                send({ type: "input", data })
            }
            ws.on("open", () => {
                process.stdin.setRawMode(true)
                process.stdin.resume()
                process.stdin.on("data", onInput)
                process.stdout.on("resize", size)
                process.stdout.write("\x1b[2J\x1b[H")
                size()
            })
            ws.on("message", (data: WebSocket.RawData, binary: boolean) => {
                const raw = Buffer.isBuffer(data) ? data : Buffer.concat(data as Buffer[])
                if (binary) {
                    if (!altered && raw.includes("\x1b[?1049h"))
                        altered = true
                    process.stdout.write(raw)
                    return
                }
                const msg = JSON.parse(raw.toString()) as { type?: string, code?: number, message?: string }
                if (msg.type === "exit")
                    finish(msg.code ?? 0, `the chat of task ${id} ended (exit code ${msg.code ?? 0})`)
                else if (msg.type === "error")
                    process.stderr.write(`chat: ${msg.message ?? "failed"}\n`)
            })
            ws.on("close", () => {
                finish(1, "connection to the ASE service lost (the chat keeps running there, if it does)")
            })
            ws.on("error", (err: Error) => {
                finish(1, `chat: connection to the ASE service failed: ${err.message}`)
            })
            for (const signal of [ "SIGHUP", "SIGTERM" ] as const)
                process.once(signal, () => { finish(null) })
        })
    }

    /*  register CLI sub-command "ase task chat"  */
    register (task: Command): void {
        task
            .command("chat")
            .description("Chat with the agent tool about a task, attached to the chat process the ASE service of the " +
                "project keeps running for it (shared with the web board, and kept running when detached with Ctrl+Q " +
                "or by closing the terminal); <id> defaults to $ASE_TASK_ID")
            .argument("[<id>]", "Task identifier")
            .action(async (idArg?: string) => {
                const id = idArg ?? process.env.ASE_TASK_ID ?? "default"
                if (!TaskFormat.TASK_ID_RE.test(id))
                    throw new Error(`chat: invalid task id "${id}"`)
                if (!process.stdin.isTTY || !process.stdout.isTTY)
                    throw new Error("chat: needs a terminal on standard input and output")
                const { port, state } = await this.connect(id)
                const code = await this.attach(id, port, state)
                process.exit(code ?? 0)
            })
    }
}
