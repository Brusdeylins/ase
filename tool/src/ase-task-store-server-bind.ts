/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { IncomingMessage } from "node:http"
import type { Duplex }          from "node:stream"

import Hapi                     from "@hapi/hapi"
import { WebSocketServer }      from "ws"
import type { WebSocket }       from "ws"

import type Log                 from "./ase-lib-log.js"
import type * as Delegate       from "./ase-task-store-plugin-delegate.js"
import * as Core                from "./ase-task-store-core.js"
import * as TaskFormat          from "./ase-task-format.js"
import { AgentRelayBinding }    from "./ase-agent-relay-server-bind.js"
import { ServerGuard, urlHost } from "./ase-lib-server-bind.js"
import type { ServerConfig }    from "./ase-lib-server-bind.js"

/*  the options of the REST API server  */
export type TaskStoreServerOptions = ServerConfig & {
    store:   Delegate.TaskStore
    relay:   boolean
}

/*  a WebSocket subscription of a project's events, optionally
    restricted to a set of task ids  */
type Subscription = { ws: WebSocket, tasks: Set<string> | null }

/*  the route path templates and the JSON payload route options  */
const P    = "/projects/{prjId}"
const T    = `${P}/tasks/{taskId}`
const json = { payload: { parse: true, allow: "application/json" } }

/*  the interval of the keepalive pings of the subscribers, the maximum size of the
    messages of the subscribers (which send none at all), the maximum amount of not
    yet transmitted data of a subscriber (beyond which it cannot keep up, generously
    bounded as the frames carry entire task plans), and the maximum number of
    subscribers per project and in total  */
const PING_MS        = 15 * 1000
const PAYLOAD_MAX    = 4 * 1024
const BUFFER_MAX     = 16 * 1024 * 1024
const SUBS_MAX       = 128
const SUBS_TOTAL_MAX = 1024

/*  the HTTP binding of the REST API: bearer token authentication, CORS,
    the routes onto the core operations, problem details rendering, and
    the WebSocket event endpoint, optionally co-hosting the agent relay  */
export class TaskStoreServer {
    private server:     Hapi.Server
    private wss:        WebSocketServer
    private core:       Core.TaskStoreCore
    private subs       = new Map<string, Set<Subscription>>()
    private guard:      ServerGuard
    private relay:      AgentRelayBinding | null
    private unanswered = new WeakSet<WebSocket>()
    private timer:      ReturnType<typeof setInterval> | null = null

    constructor (private log: Log, private options: TaskStoreServerOptions) {
        this.relay  = options.relay ? new AgentRelayBinding(log) : null
        this.core   = new Core.TaskStoreCore(options.store, (prjId, frame) => this.emit(prjId, frame))
        this.server = Hapi.server({
            host:   options.address,
            port:   options.port,
            tls:    options.tls ?? undefined,
            routes: {
                cors: options.cors.length === 0 ? false : {
                    origin:         options.cors,
                    headers:        [ "Authorization", "Content-Type", "If-None-Match", "If-Match" ],
                    exposedHeaders: [ "Location", "ETag" ],
                    maxAge:         86400
                }
            }
        })
        this.wss = new WebSocketServer({ noServer: true, maxPayload: PAYLOAD_MAX })

        /*  install the common extensions, logging the requests of the co-hosted
            agent relay at debug level only (as the agents announce frequently)  */
        this.guard = new ServerGuard(log, {
            label:   "task store",
            token:   options.token,
            failure: "internal task store failure (see service log for details)",
            level:   (path) => this.relay !== null && AgentRelayBinding.handles(path) ? "debug" : "info",
            upgrade: (req, socket, head) => this.upgrade(req, socket, head)
        })
        this.guard.install(this.server)
        this.installRoutes()
    }

    /*  start the server: open the storage, start the co-hosted agent relay,
        bind the listener, and start the keepalive pings of the subscribers  */
    async start (): Promise<void> {
        await this.options.store.open()
        this.relay?.start()
        try {
            await this.server.start()
        }
        catch (err: unknown) {
            /*  ignore a close failure to not mask the original start failure  */
            this.relay?.stop()
            await this.options.store.close().catch(() => {})
            throw err
        }
        this.timer = setInterval(() => { this.keepalive() }, PING_MS)
        const scheme = this.options.tls !== null ? "https" : "http"
        this.log.write("info", `task store: listening on ${scheme}://${urlHost(this.options.address)}:${this.options.port} ` +
            `(storage plugin "${this.options.store.name}"${this.relay !== null ? ", with agent relay" : ""})`)
    }

    /*  stop the server: stop the keepalive pings, close all subscriptions with close code
        1001, stop the co-hosted agent relay, unbind the listener, and close the storage  */
    async stop (): Promise<void> {
        if (this.timer !== null)
            clearInterval(this.timer)
        this.timer = null
        for (const subs of this.subs.values())
            for (const sub of subs)
                sub.ws.close(1001, "server shutting down")
        this.subs.clear()
        this.relay?.stop()
        this.wss.close()
        await this.server.stop({ timeout: 1000 })
        await this.options.store.close()
        this.log.write("info", "task store: stopped")
    }

    /*  read the path parameters and a single-valued query parameter  */
    private params (request: Hapi.Request): Record<string, string> {
        return request.params as Record<string, string>
    }
    private query (request: Hapi.Request, name: string): string | undefined {
        const value = request.query[name] as string | string[] | undefined
        if (Array.isArray(value))
            return value[value.length - 1]
        return value
    }

    /*  the lifecycle model, task id scheme, and sequence number
        high-water mark as exposed by the project endpoints  */
    private projectView (project: Core.ProjectView) {
        return {
            id: project.id,
            lifecycle: {
                name:        project.lifecycle.name,
                states:      project.lifecycle.states,
                initial:     project.lifecycle.initial,
                finished:    project.lifecycle.finished,
                transitions: project.lifecycle.transitions
            },
            idscheme: project.idscheme,
            seqmark:  project.seqmark
        }
    }

    /*  strip the "created" flag of a core result and map it onto the status code  */
    private created (h: Hapi.ResponseToolkit, result: { created: boolean }) {
        const { created, ...body } = result
        return h.response(body).code(created ? 201 : 200)
    }

    /*  ==== events ====  */

    /*  ping all subscribers, terminating those which have not answered the previous
        ping (e.g. on a half-open connection after a network partition or a host crash)  */
    private keepalive (): void {
        for (const [ prjId, subs ] of this.subs)
            for (const sub of subs) {
                if (this.unanswered.has(sub.ws)) {
                    this.log.write("debug", `task store: terminating unresponsive subscriber of project "${prjId}"`)
                    sub.ws.terminate()
                    continue
                }
                this.unanswered.add(sub.ws)
                sub.ws.ping()
            }
    }

    /*  deliver an event frame to the subscribers of a project, each
        restricted to the task ids it subscribed to (except for a
        lifecycle model or task id scheme change, which concerns all task plans),
        terminating the subscribers which cannot keep up (as they would miss
        events, and are notified of a change on their reconnection anyway)  */
    private emit (prjId: string, frame: Core.EventFrame): void {
        const subs = this.subs.get(prjId)
        if (subs === undefined)
            return
        for (const sub of subs) {
            if (sub.ws.readyState !== sub.ws.OPEN)
                continue
            if (sub.ws.bufferedAmount > BUFFER_MAX) {
                this.log.write("debug", `task store: terminating congested subscriber of project "${prjId}"`)
                sub.ws.terminate()
                continue
            }
            const out: Core.EventFrame = {}
            const keep = (id: string) => sub.tasks === null || sub.tasks.has(id)
            if (frame.added !== undefined) {
                const added = Object.fromEntries(Object.entries(frame.added).filter(([ id ]) => keep(id)))
                if (Object.keys(added).length > 0)
                    out.added = added
            }
            if (frame.updated !== undefined) {
                const updated = Object.fromEntries(Object.entries(frame.updated).filter(([ id ]) => keep(id)))
                if (Object.keys(updated).length > 0)
                    out.updated = updated
            }
            if (frame.deleted !== undefined) {
                const deleted = frame.deleted.filter((id) => keep(id))
                if (deleted.length > 0)
                    out.deleted = deleted
            }
            if (frame.lifecycle !== undefined)
                out.lifecycle = frame.lifecycle
            if (frame.idscheme !== undefined)
                out.idscheme = frame.idscheme
            if (Object.keys(out).length > 0)
                sub.ws.send(JSON.stringify(out))
        }
    }

    /*  handle a WebSocket handshake on the event endpoint (or, after its
        authentication, on the event endpoint of the co-hosted agent relay)  */
    private async upgrade (req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const url  = new URL(req.url ?? "/", "http://localhost")
        const path = url.pathname
        if (this.relay !== null && AgentRelayBinding.handles(path)) {
            if (!this.guard.authorized(req.headers.authorization, url.searchParams.get("token") ?? undefined))
                this.guard.rejectUpgrade(socket, 401, "missing or invalid bearer token", path)
            else
                this.relay.upgrade(req, socket, head, path, (status, detail) => {
                    this.guard.rejectUpgrade(socket, status, detail, path)
                })
            return
        }
        const m    = /^\/projects\/([^/]+)\/events$/.exec(path)
        if (m === null) {
            this.guard.rejectUpgrade(socket, 404, `no WebSocket endpoint "${path}"`, path)
            return
        }
        if (!this.guard.authorized(req.headers.authorization, url.searchParams.get("token") ?? undefined)) {
            this.guard.rejectUpgrade(socket, 401, "missing or invalid bearer token", path)
            return
        }
        const prjId = m[1]
        if (!TaskFormat.ID_RE.test(prjId)) {
            this.guard.rejectUpgrade(socket, 422, `invalid project id "${prjId}" (expected: [A-Za-z0-9_-]+)`, path)
            return
        }
        if (!await this.core.projectExists(prjId)) {
            this.guard.rejectUpgrade(socket, 404, `no project "${prjId}" registered`, path)
            return
        }
        let tasks: Set<string> | null = null
        const list = url.searchParams.get("tasks")
        if (list !== null) {
            tasks = new Set<string>()
            for (const id of list.split(",").map((token) => token.trim()).filter((token) => token !== "")) {
                if (!TaskFormat.TASK_ID_RE.test(id)) {
                    this.guard.rejectUpgrade(socket, 422, `invalid task id "${id}" (expected: [A-Za-z0-9#][A-Za-z0-9#_-]*)`, path)
                    return
                }
                tasks.add(id)
            }
        }

        /*  reject a subscriber beyond the maximum numbers  */
        let total = 0
        for (const subs of this.subs.values())
            total += subs.size
        if ((this.subs.get(prjId)?.size ?? 0) >= SUBS_MAX) {
            this.guard.rejectUpgrade(socket, 429, `too many subscribers of project "${prjId}" (maximum: ${SUBS_MAX})`, path)
            return
        }
        if (total >= SUBS_TOTAL_MAX) {
            this.guard.rejectUpgrade(socket, 429, `too many subscribers in total (maximum: ${SUBS_TOTAL_MAX})`, path)
            return
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            const sub: Subscription = { ws, tasks }
            let subs = this.subs.get(prjId)
            if (subs === undefined) {
                subs = new Set<Subscription>()
                this.subs.set(prjId, subs)
            }
            subs.add(sub)
            this.log.write("debug", `task store: subscribed to events of project "${prjId}"` +
                (tasks !== null ? ` (tasks: ${[ ...tasks ].join(", ")})` : ""))
            ws.on("pong", () => {
                this.unanswered.delete(ws)
            })
            ws.on("close", () => {
                const subs = this.subs.get(prjId)
                if (subs !== undefined) {
                    subs.delete(sub)
                    if (subs.size === 0)
                        this.subs.delete(prjId)
                }
            })
            ws.on("error", (err) => {
                this.log.write("debug", `task store: WebSocket error on events of project "${prjId}": ${err.message}`)
            })
        })
    }

    /*  ==== routes ====  */

    /*  install the routes onto the core operations (and of the co-hosted agent relay)  */
    private installRoutes (): void {
        this.installProjectRoutes()
        this.installTaskRoutes()
        this.installPartRoutes()
        this.installAttachmentRoutes()
        this.relay?.install(this.server)
    }

    /*  install the project endpoints (and the plain HTTP fallback of the event endpoint)  */
    private installProjectRoutes (): void {
        const core = this.core
        const p    = (request: Hapi.Request) => this.params(request)

        /*  the project endpoints  */
        this.server.route({
            method:  "GET",
            path:    "/projects",
            handler: async () =>
                ({ projects: await core.projectList() })
        })
        this.server.route({
            method:  "GET",
            path:    P,
            handler: async (request) =>
                this.projectView(await core.projectGet(p(request).prjId))
        })
        this.server.route({
            method:  "PUT",
            path:    P,
            options: json,
            handler: async (request, h) => {
                const payload = request.payload as unknown
                if (payload !== null && payload !== undefined && !Core.isObject(payload))
                    throw Core.problem(400, "request body has to be an object")

                /*  "If-None-Match: *" registers the project only if not yet registered  */
                const createOnly = request.headers["if-none-match"] === "*"
                const result = await core.projectSet(p(request).prjId, Core.isObject(payload) ?
                    { lifecycle: payload.lifecycle, idscheme: payload.idscheme } : {}, createOnly)
                return h.response(this.projectView(result.project)).code(result.created ? 201 : 200)
            }
        })
        this.server.route({
            method:  "DELETE",
            path:    P,
            handler: async (request, h) => {
                const prjId = p(request).prjId
                await core.projectDelete(prjId)
                const subs = this.subs.get(prjId)
                if (subs !== undefined) {
                    for (const sub of subs)
                        sub.ws.close(1001, "project unregistered")
                    this.subs.delete(prjId)
                }
                return h.response().code(204)
            }
        })

        /*  a plain HTTP request on the event endpoint (the WebSocket
            handshakes are intercepted on the listener's "upgrade" event)  */
        this.server.route({
            method:  "GET",
            path:    `${P}/events`,
            handler: async (request) => {
                await core.projectGet(p(request).prjId)
                throw Core.problem(426, "the event endpoint requires a WebSocket handshake")
            }
        })
    }

    /*  install the task plan endpoints  */
    private installTaskRoutes (): void {
        const core = this.core
        const p    = (request: Hapi.Request) => this.params(request)

        /*  the task plan endpoints  */
        this.server.route({
            method:  "GET",
            path:    `${P}/tasks`,
            handler: async (request) => ({
                tasks: await core.taskList(p(request).prjId, this.query(request, "include"),
                    this.query(request, "exclude"), this.query(request, "fields"))
            })
        })
        this.server.route({
            method:  "DELETE",
            path:    `${P}/tasks`,
            handler: async (request) =>
                ({ purged: await core.taskPurge(p(request).prjId, this.query(request, "age")) })
        })
        this.server.route({
            method:  "POST",
            path:    `${P}/newid`,
            options: json,
            handler: async (request) => {
                const payload = request.payload as unknown
                if (payload !== null && payload !== undefined && !Core.isObject(payload))
                    throw Core.problem(400, "request body has to be an object")
                return core.taskNewId(p(request).prjId, Core.isObject(payload) ? payload : {})
            }
        })
        this.server.route({
            method:  "GET",
            path:    T,
            handler: async (request, h) => {
                const plan = await core.taskLoad(p(request).prjId, p(request).taskId)
                return h.response(plan).etag(Core.taskTag(plan))
            }
        })
        this.server.route({
            method:  "PUT",
            path:    T,
            options: json,
            handler: async (request, h) => {
                /*  "If-Match: <tag>" saves only if the plan is still the one with this entity tag
                    (ignoring the content encoding suffix hapi appends to the tag of a compressed response),
                    and "If-None-Match: *" saves only if the plan does not exist yet  */
                const tag = request.headers["if-match"]
                return this.created(h, await core.taskSave(p(request).prjId, p(request).taskId, request.payload,
                    typeof tag === "string" ? tag.replace(/^(?:W\/)?"(.*?)(?:-(?:gzip|deflate))?"$/, "$1") : undefined,
                    request.headers["if-none-match"] === "*"))
            }
        })
        this.server.route({
            method:  "PATCH",
            path:    T,
            options: json,
            handler: async (request) =>
                core.taskPatch(p(request).prjId, p(request).taskId, request.payload)
        })
        this.server.route({
            method:  "DELETE",
            path:    T,
            handler: async (request, h) => {
                await core.taskDelete(p(request).prjId, p(request).taskId)
                return h.response().code(204)
            }
        })
    }

    /*  install the header and body part endpoints  */
    private installPartRoutes (): void {
        const core = this.core
        const p    = (request: Hapi.Request) => this.params(request)

        /*  the header part endpoints  */
        this.server.route({
            method:  "GET",
            path:    `${T}/header`,
            handler: async (request) =>
                core.headerGet(p(request).prjId, p(request).taskId)
        })
        this.server.route({
            method:  "PUT",
            path:    `${T}/header`,
            options: json,
            handler: async (request) => {
                const { created, ...body } = await core.headerSet(p(request).prjId, p(request).taskId, request.payload)
                return body
            }
        })
        this.server.route({
            method:  "GET",
            path:    `${T}/header/content`,
            handler: async (request, h) =>
                h.response(await core.headerContent(p(request).prjId, p(request).taskId)).type("text/plain; charset=utf-8")
        })
        this.server.route({
            method:  "GET",
            path:    `${T}/header/key/{key}`,
            handler: async (request) =>
                ({ value: await core.headerKeyGet(p(request).prjId, p(request).taskId, p(request).key) })
        })
        this.server.route({
            method:  "PUT",
            path:    `${T}/header/key/{key}`,
            options: json,
            handler: async (request, h) =>
                this.created(h, await core.headerKeySet(p(request).prjId, p(request).taskId, p(request).key, request.payload))
        })
        this.server.route({
            method:  "DELETE",
            path:    `${T}/header/key/{key}`,
            handler: async (request, h) => {
                await core.headerKeyDelete(p(request).prjId, p(request).taskId, p(request).key)
                return h.response().code(204)
            }
        })

        /*  the body part endpoints  */
        this.server.route({
            method:  "GET",
            path:    `${T}/body`,
            handler: async (request) =>
                ({ body: await core.bodyGet(p(request).prjId, p(request).taskId) })
        })
        this.server.route({
            method:  "PUT",
            path:    `${T}/body`,
            options: json,
            handler: async (request, h) => {
                await core.bodySet(p(request).prjId, p(request).taskId, request.payload)
                return h.response().code(204)
            }
        })
    }

    /*  install the attachment part endpoints  */
    private installAttachmentRoutes (): void {
        const core = this.core
        const p    = (request: Hapi.Request) => this.params(request)

        /*  the attachment part endpoints  */
        this.server.route({
            method:  "GET",
            path:    `${T}/attachment`,
            handler: async (request) => {
                const type = this.query(request, "type")
                if (type === undefined)
                    return core.attachmentList(p(request).prjId, p(request).taskId)
                return { found: await core.attachmentFind(p(request).prjId, p(request).taskId, type) }
            }
        })
        this.server.route({
            method:  "POST",
            path:    `${T}/attachment`,
            options: json,
            handler: async (request, h) => {
                const append = this.query(request, "append") === "true"
                const { index, created } = await core.attachmentAdd(p(request).prjId, p(request).taskId, request.payload, append)
                return h.response({ index }).code(created ? 201 : 200).header("Location", `${request.path}/${index}`)
            }
        })
        this.server.route({
            method:  "GET",
            path:    `${T}/attachment/{index}`,
            handler: async (request) =>
                core.attachmentGet(p(request).prjId, p(request).taskId, p(request).index)
        })
        this.server.route({
            method:  "PUT",
            path:    `${T}/attachment/{index}`,
            options: json,
            handler: async (request, h) => {
                await core.attachmentSet(p(request).prjId, p(request).taskId, p(request).index, request.payload)
                return h.response().code(204)
            }
        })
        this.server.route({
            method:  "DELETE",
            path:    `${T}/attachment/{index}`,
            handler: async (request, h) => {
                await core.attachmentDelete(p(request).prjId, p(request).taskId, p(request).index)
                return h.response().code(204)
            }
        })
        this.server.route({
            method:  "GET",
            path:    `${T}/attachment/{index}/content`,
            handler: async (request, h) => {
                const { type, content } = await core.attachmentContent(p(request).prjId, p(request).taskId, p(request).index)
                return h.response(content).type(type)
            }
        })
        this.server.route({
            method:  "GET",
            path:    `${T}/attachment/{index}/key/{key}`,
            handler: async (request) =>
                ({ value: await core.attachmentKeyGet(p(request).prjId, p(request).taskId, p(request).index, p(request).key) })
        })
        this.server.route({
            method:  "PUT",
            path:    `${T}/attachment/{index}/key/{key}`,
            options: json,
            handler: async (request, h) =>
                this.created(h, await core.attachmentKeySet(p(request).prjId, p(request).taskId,
                    p(request).index, p(request).key, request.payload))
        })
        this.server.route({
            method:  "DELETE",
            path:    `${T}/attachment/{index}/key/{key}`,
            handler: async (request, h) => {
                await core.attachmentKeyDelete(p(request).prjId, p(request).taskId, p(request).index, p(request).key)
                return h.response().code(204)
            }
        })
    }
}

