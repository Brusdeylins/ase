/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                       from "node:fs"
import path                     from "node:path"
import crypto                   from "node:crypto"
import { fileURLToPath }        from "node:url"
import type { IncomingMessage } from "node:http"
import type { Duplex }          from "node:stream"

import type Hapi                from "@hapi/hapi"

import type Log                 from "./ase-lib-log.js"
import { PtyHost, ptyDimension, SIZE_MAX } from "./ase-lib-pty.js"
import { parseTool }            from "./ase-setup-common.js"
import type { Tool }            from "./ase-setup-common.js"
import * as TaskFormat          from "./ase-task-format.js"
import { chatSpec, chatSupported, chatBusyScan } from "./ase-task-chat-core.js"
import type { ChatBusy }        from "./ase-task-chat-core.js"
import * as Extras              from "./ase-task-chat-extras.js"

/*  the task chats of the ASE service: whether any of them is in use, their end, and the
    hand-over of a (by the service already authenticated) WebSocket handshake to the chat
    of its path, answering whether the path is the one of a chat at all  */
export type ChatBinding = {
    active:  () => boolean
    stop:    () => void
    upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer, path: string,
        reject: (status: number, message: string) => void) => boolean
}

/*  the fonts of the chat in the web board, as its terminal emulator takes TrueType fonts only:
    the code font of the board (as TrueType), with the fallbacks for the symbols,
    mathematical symbols, arrows, and emojis the agent tool draws (shipped by "build-font"),
    each loaded once on first use with its hash  */
const fonts = new Map<string, { data: Buffer, hash: string } | null>([
    [ "DejaVuSansMono.ttf",               null ],
    [ "DejaVuSansMono-Bold.ttf",          null ],
    [ "NotoSansSymbols_400Regular.ttf",   null ],
    [ "NotoSansSymbols2_400Regular.ttf",  null ],
    [ "NotoSansMath_400Regular.ttf",      null ],
    [ "NotoSansMono_400Regular.ttf",      null ],
    [ "NotoEmoji_400Regular.ttf",         null ]
])

/*  register the routes of the task chats: the start of the chat of a task with the agent tool
    and at the terminal size of the requesting client (answering the path of its WebSocket with
    the capability <capability> of the service for the browsers), and the fonts of the chat in
    the web board, while its WebSocket is handed over by the service, which authenticates all
    handshakes  */
export const registerChatRoutes = (server: Hapi.Server, log: Log, capability: (path: string) => string): ChatBinding => {
    /*  the running chats (extras): their start time, arguments, whether they draw for a client mapping
        the palette, first reported model and effort, background tasks, and busy state, vetoing the
        idle end of a chat  */
    type Run = {
        started: number, args: string[], palette: boolean,
        baseline: { model: string, effort: string } | null, tasks: Extras.ChatTasks, busy: ChatBusy
    }
    const runs = new Map<string, Run>()
    const locked = (id: string): boolean => {
        const run = runs.get(id)
        return run !== undefined && (run.busy.busy || Extras.chatTasksPoll(run.tasks) > 0)
    }
    const host = new PtyHost(log, "chat", locked)

    /*  start resp. restart the chat of a task, tracking its run (extras)  */
    const launch = async (id: string, tool: Tool, cols: number, rows: number,
        palette: boolean, again: boolean): Promise<void> => {
        const spec = await chatSpec(log, id, tool, cols, rows, palette)
        const run: Run = {
            started: Date.now(), args: spec.args, palette, baseline: null,
            tasks: Extras.chatTasksNew(spec.session), busy: { busy: false, tail: Buffer.alloc(0) }
        }
        runs.set(id, run)
        const exit = spec.exit
        spec.output = (data) => { chatBusyScan(run.busy, data) }
        spec.exit   = (code, output) => {
            if (runs.get(id) === run)
                runs.delete(id)
            exit(code, output)
        }
        if (again)
            await host.restart(id, spec)
        else
            await host.start(id, spec)
    }

    /*  the state of the chat of a task (extras): its model and effort (the reported ones, else the
        chosen ones, else the defaults, where a change within the agent tool is taken over as the
        chosen one), the defaults, whether it is busy, its background tasks, its context
        usage, and its WebSocket  */
    const state = (id: string) => {
        const run    = runs.get(id)
        const report = run !== undefined ? Extras.chatReport(id, run.started) : null
        if (run !== undefined && report !== null) {
            const now = { model: report.model, effort: report.effort }
            if (run.baseline === null) {
                run.baseline = now
                Extras.chatLearn(run.args, report)
            }
            else if (now.model !== run.baseline.model || now.effort !== run.baseline.effort) {
                const config = Extras.chatConfig(id)
                Extras.chatConfigure(id, now.model !== run.baseline.model ? now.model : config.model,
                    now.effort !== run.baseline.effort ? now.effort : config.effort)
                run.baseline = now
            }
        }
        const config   = Extras.chatConfig(id)
        const defaults = Extras.chatDefaults("")
        const model    = report !== null && report.model !== "" ? report.model : config.model !== "" ? config.model : defaults.model
        const effort   = report !== null && report.effort !== "" ? report.effort :
            config.effort !== "" ? config.effort : Extras.chatDefaults(model).effort
        const route    = `/task-chat/${encodeURIComponent(id)}/pty`
        return {
            running:    host.running(id),
            exited:     host.exited(id),
            model,
            effort,
            defaults:   { model: defaults.model, effort: Extras.chatDefaults(model).effort },
            busy:       run !== undefined && run.busy.busy,
            background: run !== undefined ? Extras.chatTasksPoll(run.tasks) : 0,
            context:    report !== null ? { pct: report.pct, tokens: report.tokens, size: report.size } : null,
            url:        `${route}?cap=${capability(route)}`
        }
    }

    /*  the fonts of the chat in the web board (public like all page assets, as they carry
        no task data)  */
    server.route({
        method:  "GET",
        path:    "/task-chat/font/{file}",
        options: { app: { public: true } },
        handler: (request, h) => {
            const name = String(request.params.file)
            const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "font-chat", name)
            if (!/^[A-Za-z0-9_-]+\.ttf$/.test(name) || !fs.existsSync(file))
                return h.response({ error: `chat: no font "${name}"` }).code(404)
            let font = fonts.get(name) ?? null
            if (font === null) {
                const data = fs.readFileSync(file)
                font = { data, hash: crypto.createHash("sha1").update(data).digest("hex") }
                fonts.set(name, font)
            }
            return h.response(font.data).type("font/ttf").etag(font.hash).header("Cache-Control", "no-cache")
        }
    })

    /*  the state of the chat of a task (extras)  */
    server.route({
        method:  "GET",
        path:    "/task-chat/{id}",
        handler: (request, h) => {
            const id = String(request.params.id)
            if (!TaskFormat.TASK_ID_RE.test(id))
                return h.response({ error: `chat: invalid task id "${id}"` }).code(400)
            return h.response(state(id))
        }
    })

    /*  restart the chat of a task with another model or effort (extras), answering its state  */
    server.route({
        method:  "PUT",
        path:    "/task-chat/{id}",
        options: { payload: { parse: true, allow: "application/json" } },
        handler: async (request, h) => {
            const id   = String(request.params.id)
            const p    = request.payload as { model?: unknown, effort?: unknown, palette?: unknown, cols?: unknown, rows?: unknown } | null
            const cols = ptyDimension(p?.cols)
            const rows = ptyDimension(p?.rows)
            if (!TaskFormat.TASK_ID_RE.test(id) || cols === null || rows === null)
                return h.response({ error: `chat: invalid task id "${id}" or terminal size` }).code(400)
            if (typeof p?.model !== "string" || !Extras.chatModels.includes(p.model)
                || typeof p.effort !== "string" || !Extras.chatEfforts.includes(p.effort))
                return h.response({ error: "chat: invalid model or effort" }).code(400)
            try {
                Extras.chatConfigure(id, p.model, p.effort)
                await launch(id, "claude", cols, rows, p.palette === true, true)
            }
            catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                log.write("warning", message)
                return h.response({ error: message }).code(500)
            }
            return h.response(state(id))
        }
    })

    /*  start the chat of a task (unless it runs already), with the agent tool of "$ASE_TOOL" of the
        service (else "claude") for a client which knows no agent tool of the user (the web board),
        drawing with the 256-color palette only for a client mapping it onto its own colors (the web
        board, see "chatSpec"), answering the path of its WebSocket  */
    const envTool  = process.env.ASE_TOOL ?? ""
    const toolDflt = envTool !== "" ? envTool : "claude"
    server.route({
        method:  "POST",
        path:    "/task-chat/{id}",
        options: { payload: { parse: true, allow: "application/json" } },
        handler: async (request, h) => {
            const id   = String(request.params.id)
            const p    = request.payload as { tool?: unknown, cols?: unknown, rows?: unknown, palette?: unknown } | null
            const cols = ptyDimension(p?.cols)
            const rows = ptyDimension(p?.rows)
            if (!TaskFormat.TASK_ID_RE.test(id))
                return h.response({ error: `chat: invalid task id "${id}"` }).code(400)
            if (cols === null || rows === null)
                return h.response({ error: `chat: invalid terminal size (expected 1 to ${SIZE_MAX})` }).code(400)
            let tool: Tool
            try {
                tool = parseTool(typeof p?.tool === "string" ? p.tool : toolDflt)
            }
            catch (err: unknown) {
                return h.response({ error: `chat: ${err instanceof Error ? err.message : String(err)}` }).code(400)
            }
            if (!chatSupported(tool))
                return h.response({ error: `chat: agent tool "${tool}" is unsupported` }).code(400)
            if (host.running(id))
                return h.response(state(id))
            if (host.full())
                return h.response({ error: "chat: too many running chats" }).code(429)
            try {
                await launch(id, tool, cols, rows, p?.palette === true, false)
            }
            catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                log.write("warning", message)
                return h.response({ error: message }).code(500)
            }
            return h.response(state(id))
        }
    })
    return {
        active:  () => host.active(),
        stop:    () => { host.stop() },
        upgrade: (req, socket, head, path, reject) => {
            const m = /^\/task-chat\/([^/]+)\/pty$/.exec(path)
            if (m === null)
                return false
            const id = decodeURIComponent(m[1])
            if (!TaskFormat.TASK_ID_RE.test(id))
                reject(400, `chat: invalid task id "${id}"`)
            else
                host.upgrade(req, socket, head, id, reject)
            return true
        }
    }
}

