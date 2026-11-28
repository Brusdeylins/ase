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
import { ofetch }               from "ofetch"
import { isScalar }             from "yaml"
import { WebSocket, WebSocketServer } from "ws"

import type Log                 from "./ase-lib-log.js"
import { Config }               from "./ase-config-core.js"
import { configSchema }         from "./ase-config-schema.js"
import { parseRelayURL, redactURL } from "./ase-agent-relay-client.js"
import { PtyHost, ptyDimension, SIZE_MAX } from "./ase-lib-pty.js"
import { parseTool }            from "./ase-setup-common.js"
import type { Tool }            from "./ase-setup-common.js"
import * as TaskFormat          from "./ase-task-format.js"
import { chatSpec, chatSupported, chatBusyScan } from "./ase-task-chat-core.js"
import type { ChatBusy }        from "./ase-task-chat-core.js"

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

/*  the time a remote container may take to start a chat, and the largest message relayed
    to resp. from it (a pasted text, resp. the replay of the chat's output on attaching)  */
const REMOTE_START_MS = 60 * 1000
const REMOTE_MAX      = 4 * 1024 * 1024

/*  the remote of the task chats: the ASE container of "project.chat.url" ("ase[s]://<host>:<port>"),
    reached with the bearer token "project.chat.token", where all chats of the project then run (never
    locally, even if the container is not reachable), else null; read at every start and attach  */
type ChatRemote = { http: string, ws: string, token: string }
const chatRemote = (log: Log): ChatRemote | null => {
    const cfg = new Config("config", configSchema, log)
    cfg.read()
    const scoped = (key: string): string | undefined => {
        const entry = cfg.getScoped(key)
        return entry === undefined ? undefined : String(isScalar(entry.value) ? entry.value.value : entry.value)
    }
    const url = scoped("project.chat.url")
    if (url === undefined)
        return null
    const spec    = parseRelayURL(url)
    const token   = spec.embedded ?? scoped("project.chat.token") ?? ""
    const project = scoped("project.id") ?? ""
    if (token === "")
        throw new Error(`chat: no token for the remote chats of "${redactURL(url)}" (set "project.chat.token" on scope "user")`)
    if (project === "")
        throw new Error("chat: no \"project.id\" for the remote chats")
    if (spec.insecure)
        throw new Error("chat: \"?insecure\" is unsupported for the remote chats")
    const base = `${spec.url.host}/projects/${encodeURIComponent(project)}/chat`
    return { http: `${spec.secure ? "https" : "http"}://${base}`, ws: `${spec.secure ? "wss" : "ws"}://${base}`, token }
}

/*  register the routes of the task chats: the start of the chat of a task with the agent tool
    and at the terminal size of the requesting client (answering the path of its WebSocket with
    the capability <capability> of the service for the browsers), and the fonts of the chat in
    the web board, while its WebSocket is handed over by the service, which authenticates all
    handshakes  */
export const registerChatRoutes = (server: Hapi.Server, log: Log, capability: (path: string) => string): ChatBinding => {
    /*  the busy state of the running chats, which keeps a working chat running without a client
        beyond the idle time of its session  */
    const busy = new Map<string, ChatBusy>()
    const host = new PtyHost(log, "chat", (id) => busy.get(id)?.busy === true)

    /*  the fonts of the chat in the web board (public like all page assets, as they carry
        no task data)  */
    server.route({
        method:  "GET",
        path:    "/task-chat/font/{file}",
        options: { app: { public: true } },
        handler: (request, h) => {
            const name = String(request.params.file)
            if (!fonts.has(name))
                return h.response({ error: `chat: no font "${name}"` }).code(404)
            let font = fonts.get(name) ?? null
            if (font === null) {
                const data = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "font-chat", name))
                font = { data, hash: crypto.createHash("sha1").update(data).digest("hex") }
                fonts.set(name, font)
            }
            return h.response(font.data).type("font/ttf").etag(font.hash).header("Cache-Control", "no-cache")
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
            const route = `/task-chat/${encodeURIComponent(id)}/pty`
            const state = { running: true, url: `${route}?cap=${capability(route)}` }

            /*  a remote chat starts in the container, the client still attaches here (see "bridge")  */
            let remote: ChatRemote | null
            try {
                remote = chatRemote(log)
            }
            catch (err: unknown) {
                return h.response({ error: err instanceof Error ? err.message : String(err) }).code(400)
            }
            if (remote !== null) {
                const res = await ofetch.raw<{ detail?: string, error?: string }>(`${remote.http}/${encodeURIComponent(id)}`, {
                    method:  "POST",
                    headers: { Authorization: `Bearer ${remote.token}` },
                    body:    { tool, cols, rows, palette: p?.palette === true },
                    timeout: REMOTE_START_MS,
                    ignoreResponseError: true
                }).catch(() => null)
                if (res === null)
                    return h.response({ error: "chat: remote chat service not reachable" }).code(502)
                if (!res.ok) {
                    const why = res._data?.detail ?? res._data?.error ?? ""
                    return h.response({ error: `chat: remote chat service failed (HTTP status ${res.status}${why !== "" ? `: ${why}` : ""})` }).code(502)
                }
                return h.response(state)
            }
            if (host.running(id))
                return h.response(state)
            if (host.full())
                return h.response({ error: "chat: too many running chats" }).code(429)
            try {
                const spec  = await chatSpec(log, id, tool, cols, rows, p?.palette === true)
                const state = { busy: false, tail: Buffer.alloc(0) }
                const exit  = spec.exit
                spec.output = (data) => { chatBusyScan(state, data) }
                spec.exit   = (code, output) => {
                    if (busy.get(id) === state)
                        busy.delete(id)
                    exit(code, output)
                }
                busy.set(id, state)
                await host.start(id, spec)
            }
            catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                log.write("warning", message)
                return h.response({ error: message }).code(500)
            }
            return h.response(state)
        }
    })

    /*  attach a client to a remote chat: the WebSocket of the container (with the token, which so
        never reaches a browser) is opened first, then the client's handshake is accepted and both
        relay each other's messages unchanged, until either side closes  */
    const bridges = new Set<WebSocket>()
    const wss     = new WebSocketServer({ noServer: true, maxPayload: REMOTE_MAX })
    const bridge = (remote: ChatRemote, id: string, req: IncomingMessage, socket: Duplex, head: Buffer,
        reject: (status: number, message: string) => void): void => {
        const upstream = new WebSocket(`${remote.ws}/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${remote.token}` }, perMessageDeflate: false, maxPayload: REMOTE_MAX
        })
        let answered = false
        upstream.once("unexpected-response", (_request, res) => {
            answered = true
            res.resume()
            upstream.terminate()
            reject(502, `chat: remote chat service failed (HTTP status ${res.statusCode ?? 0})`)
        })
        upstream.once("error", () => {
            if (!answered) {
                answered = true
                reject(502, "chat: remote chat service not reachable")
            }
        })
        upstream.once("open", () => {
            answered = true
            wss.handleUpgrade(req, socket, head, (client) => {
                bridges.add(client)
                const end = () => {
                    bridges.delete(client)
                    client.close()
                    upstream.close()
                }
                client.on("message", (data: Buffer, binary: boolean) => { upstream.send(data, { binary }) })
                upstream.on("message", (data: Buffer, binary: boolean) => { client.send(data, { binary }) })
                client.once("close", end)
                upstream.once("close", end)
                client.on("error", end)
                upstream.on("error", end)
            })
        })
    }

    return {
        active:  () => host.active() || bridges.size > 0,
        stop:    () => {
            host.stop()
            for (const client of bridges)
                client.terminate()
        },
        upgrade: (req, socket, head, path, reject) => {
            const m = /^\/task-chat\/([^/]+)\/pty$/.exec(path)
            if (m === null)
                return false
            const id = decodeURIComponent(m[1])
            if (!TaskFormat.TASK_ID_RE.test(id)) {
                reject(400, `chat: invalid task id "${id}"`)
                return true
            }
            let remote: ChatRemote | null
            try {
                remote = chatRemote(log)
            }
            catch (err: unknown) {
                reject(400, err instanceof Error ? err.message : String(err))
                return true
            }
            if (remote !== null)
                bridge(remote, id, req, socket, head, reject)
            else
                host.upgrade(req, socket, head, id, reject)
            return true
        }
    }
}

