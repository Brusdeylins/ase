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
import * as Core                from "./ase-task-store-core.js"
import * as TaskFormat          from "./ase-task-format.js"
import * as Relay               from "./ase-agent-relay-core.js"
import { ServerGuard, urlHost } from "./ase-lib-server-bind.js"
import type { ServerConfig }    from "./ase-lib-server-bind.js"

/*  the route path templates and the JSON payload route options (bounding the
    request body to the size of an announcement with all its lines at maximum)  */
const P    = "/projects/{prjId}/agents"
const json = { payload: { parse: true, allow: "application/json", maxBytes: 512 * 1024 } }

/*  the interval of the keepalive pings of the subscribers, the maximum size of
    the messages of the subscribers (which send none at all), and the maximum amount
    of not yet transmitted data of a subscriber (beyond which it cannot keep up)  */
const PING_MS     = 15 * 1000
const PAYLOAD_MAX = 4 * 1024
const BUFFER_MAX  = 1024 * 1024

/*  the agent relay endpoints, mountable onto a Hapi server which authenticates all
    requests and renders the thrown problems (the standalone agent relay server, or the
    task store server co-hosting the agent relay): the REST endpoints of the agents and
    the WebSocket event endpoint of the projects, which the hosting server delegates to  */
export class AgentRelayBinding {
    private core:       Relay.AgentRelayCore
    private wss        = new WebSocketServer({ noServer: true, maxPayload: PAYLOAD_MAX })
    private subs       = new Map<string, Set<WebSocket>>()
    private unanswered = new WeakSet<WebSocket>()
    private timer:      ReturnType<typeof setInterval> | null = null

    constructor (private log: Log) {
        this.core = new Relay.AgentRelayCore((prjId, frame) => { this.emit(prjId, frame) })
    }

    /*  whether a request path belongs to the agent relay  */
    static handles (path: string): boolean {
        return path === "/agents" || /^\/projects\/[^/]+\/agents(?:\/|$)/.test(path)
    }

    /*  start and stop the agent relay and the keepalive pings of the
        subscribers, closing all subscriptions with close code 1001  */
    start (): void {
        this.core.start()
        this.timer = setInterval(() => { this.keepalive() }, PING_MS)
    }
    stop (): void {
        if (this.timer !== null)
            clearInterval(this.timer)
        this.timer = null
        for (const subs of this.subs.values())
            for (const ws of subs)
                ws.close(1001, "server shutting down")
        this.subs.clear()
        this.wss.close()
        this.core.stop()
    }

    /*  ping all subscribers, terminating those which have not answered the previous
        ping (e.g. on a half-open connection after a network partition or a host crash)  */
    private keepalive (): void {
        for (const [ prjId, subs ] of this.subs)
            for (const ws of subs) {
                if (this.unanswered.has(ws)) {
                    this.log.write("debug", `relay: terminating unresponsive subscriber of project "${prjId}"`)
                    ws.terminate()
                    continue
                }
                this.unanswered.add(ws)
                ws.ping()
            }
    }

    /*  deliver an event frame to the subscribers of a project, terminating those which
        cannot keep up (as a skipped delta frame would corrupt their view of the agents,
        and they will receive a fresh snapshot on their reconnection anyway)  */
    private emit (prjId: string, frame: Relay.RelayFrame): void {
        const data = JSON.stringify(frame)
        for (const ws of this.subs.get(prjId) ?? []) {
            if (ws.readyState !== ws.OPEN)
                continue
            if (ws.bufferedAmount > BUFFER_MAX) {
                this.log.write("debug", `relay: terminating congested subscriber of project "${prjId}"`)
                ws.terminate()
                continue
            }
            ws.send(data)
        }
    }

    /*  handle a (by the hosting server already authenticated) WebSocket handshake on the
        event endpoint of a project, starting the subscription with the snapshot of its agents  */
    upgrade (req: IncomingMessage, socket: Duplex, head: Buffer, path: string,
        reject: (status: number, detail: string) => void): void {
        const m = /^\/projects\/([^/]+)\/agents\/events$/.exec(path)
        if (m === null) {
            reject(404, `no WebSocket endpoint "${path}"`)
            return
        }
        const prjId = m[1]
        if (!TaskFormat.ID_RE.test(prjId)) {
            reject(422, `invalid project id "${prjId}" (expected: [A-Za-z0-9_-]+)`)
            return
        }

        /*  reject a subscriber beyond the maximum numbers  */
        let total = 0
        for (const subs of this.subs.values())
            total += subs.size
        if ((this.subs.get(prjId)?.size ?? 0) >= Relay.SUBS_MAX) {
            reject(429, `too many subscribers of project "${prjId}" (maximum: ${Relay.SUBS_MAX})`)
            return
        }
        if (total >= Relay.SUBS_TOTAL_MAX) {
            reject(429, `too many subscribers in total (maximum: ${Relay.SUBS_TOTAL_MAX})`)
            return
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            let subs = this.subs.get(prjId)
            if (subs === undefined) {
                subs = new Set<WebSocket>()
                this.subs.set(prjId, subs)
            }
            subs.add(ws)
            this.log.write("debug", `relay: subscribed to agents of project "${prjId}"`)
            const agents = Object.fromEntries(this.core.list(prjId).map((agent) => [ agent.id, agent ]))
            ws.send(JSON.stringify({ reset: true, agents } satisfies Relay.RelayFrame))
            ws.on("pong", () => {
                this.unanswered.delete(ws)
            })
            ws.on("close", () => {
                const subs = this.subs.get(prjId)
                if (subs !== undefined) {
                    subs.delete(ws)
                    if (subs.size === 0)
                        this.subs.delete(prjId)
                }
            })
            ws.on("error", (err) => {
                this.log.write("debug", `relay: WebSocket error on agents of project "${prjId}": ${err.message}`)
            })
        })
    }

    /*  install the REST endpoints (and the plain HTTP fallback of the event endpoint)  */
    install (server: Hapi.Server): void {
        const core = this.core
        const p    = (request: Hapi.Request) => request.params as Record<string, string>
        server.route({
            method:  "GET",
            path:    "/agents",
            handler: () =>
                ({ projects: core.projectList() })
        })
        server.route({
            method:  "GET",
            path:    P,
            handler: (request) =>
                ({ agents: core.list(p(request).prjId) })
        })
        server.route({
            method:  "PUT",
            path:    `${P}/{agentId}`,
            options: json,
            handler: (request, h) => {
                core.announce(p(request).prjId, p(request).agentId, request.payload)
                return h.response().code(204)
            }
        })
        server.route({
            method:  "DELETE",
            path:    `${P}/{agentId}`,
            handler: (request, h) => {
                core.remove(p(request).prjId, p(request).agentId)
                return h.response().code(204)
            }
        })
        server.route({
            method:  "GET",
            path:    `${P}/events`,
            handler: () => {
                throw Core.problem(426, "the event endpoint requires a WebSocket handshake")
            }
        })
    }
}

/*  the options of the standalone agent relay server  */
export type AgentRelayServerOptions = ServerConfig

/*  the standalone agent relay server: bearer token authentication, CORS,
    problem details rendering, and the agent relay endpoints  */
export class AgentRelayServer {
    private server:  Hapi.Server
    private binding: AgentRelayBinding

    constructor (private log: Log, private options: AgentRelayServerOptions) {
        this.binding = new AgentRelayBinding(log)
        this.server  = Hapi.server({
            host:   options.address,
            port:   options.port,
            tls:    options.tls ?? undefined,
            routes: {
                cors: options.cors.length === 0 ? false : {
                    origin:  options.cors,
                    headers: [ "Authorization", "Content-Type" ],
                    maxAge:  86400
                }
            }
        })

        /*  install the common extensions, logging the requests at debug level
            only (as the agents announce frequently), and the agent relay endpoints  */
        const guard = new ServerGuard(log, {
            label:   "relay",
            token:   options.token,
            failure: "internal agent relay failure (see relay log for details)",
            level:   () => "debug",
            upgrade: (req, socket, head) => {
                const url  = new URL(req.url ?? "/", "http://localhost")
                const path = url.pathname
                if (!guard.authorized(req.headers.authorization, url.searchParams.get("token") ?? undefined))
                    guard.rejectUpgrade(socket, 401, "missing or invalid bearer token", path)
                else
                    this.binding.upgrade(req, socket, head, path, (status, detail) => {
                        guard.rejectUpgrade(socket, status, detail, path)
                    })
            }
        })
        guard.install(this.server)
        this.binding.install(this.server)
    }

    /*  start the server: start the agent relay and bind the listener  */
    async start (): Promise<void> {
        this.binding.start()
        try {
            await this.server.start()
        }
        catch (err: unknown) {
            this.binding.stop()
            throw err
        }
        const scheme = this.options.tls !== null ? "https" : "http"
        this.log.write("info", `relay: listening on ${scheme}://${urlHost(this.options.address)}:${this.options.port}`)
    }

    /*  stop the server: stop the agent relay and unbind the listener  */
    async stop (): Promise<void> {
        this.binding.stop()
        await this.server.stop({ timeout: 1000 })
        this.log.write("info", "relay: terminated")
    }
}

