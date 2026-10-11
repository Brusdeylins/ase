/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import crypto                   from "node:crypto"
import net                      from "node:net"
import type { IncomingMessage } from "node:http"
import type { Duplex }          from "node:stream"

import type Hapi                from "@hapi/hapi"

import type Log                 from "./ase-lib-log.js"
import type { LogLevel }        from "./ase-lib-log.js"
import * as Core                from "./ase-task-store-core.js"

/*  the host part of an address for use in a URL (brackets for IPv6)  */
export const urlHost = (address: string): string =>
    net.isIPv6(address) ? `[${address}]` : address

/*  whether an address (or a WHATWG URL hostname, i.e. with brackets
    around an IPv6 address) denotes the loopback interface  */
export const isLoopback = (address: string): boolean =>
    /^(?:127(?:\.\d{1,3}){3}|\[?::1\]?|localhost)$/i.test(address)

/*  the resolved common configuration of a server to bind: its address and port,
    the bearer token to expect, the CORS origins, and the TLS certificate and key  */
export type ServerConfig = {
    address: string
    port:    number
    token:   string
    cors:    string[]
    tls:     { cert: Buffer, key: Buffer } | null
}

/*  the options of the common server extensions: the label of the server in the
    log lines (e.g. "task store"), the bearer token to expect, the problem detail
    exposed to the client on a server-side failure, the log level of a regular
    request by its path, and the handler of the WebSocket handshakes  */
export type ServerGuardOptions = {
    label:   string
    token:   string
    failure: string
    level:   (path: string) => LogLevel
    upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void> | void
}

/*  the response header identifying the server by its label on a rejected authentication
    (so a probe tells the different servers, sharing the same range of ports, apart)  */
export const serverHeader = "ASE-Server"

/*  the common extensions of the bearer token authenticated REST API servers (the task store
    and the agent relay server): the bearer token authentication, the problem details rendering,
    the request logging, and the hooking of the WebSocket handshakes  */
export class ServerGuard {
    private token: Buffer

    constructor (private log: Log, private options: ServerGuardOptions) {
        this.token = Buffer.from(options.token, "utf8")
    }

    /*  check a bearer token against the configured one in constant time  */
    authorized (header: string | undefined, query: string | undefined): boolean {
        let token: string | undefined
        if (typeof header === "string") {
            const m = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header)
            if (m === null)
                return false
            token = m[1]
        }
        else if (typeof query === "string")
            token = query
        if (token === undefined)
            return false
        const buf = Buffer.from(token, "utf8")
        return buf.length === this.token.length && crypto.timingSafeEqual(buf, this.token)
    }

    /*  reject a WebSocket handshake with a plain HTTP problem response  */
    rejectUpgrade (socket: Duplex, status: number, detail: string, instance: string): void {
        const body = JSON.stringify(Core.problemBody(status, detail, instance))
        socket.write(`HTTP/1.1 ${status} ${Core.problemTitles[status] ?? "Error"}\r\n` +
            "Content-Type: application/problem+json\r\n" +
            `Content-Length: ${Buffer.byteLength(body)}\r\n` +
            "Connection: close\r\n\r\n" + body)
        socket.end(() => { socket.destroy() })
    }

    /*  install the bearer token authentication, the request logging,
        the problem details rendering, and the WebSocket upgrade hook  */
    install (server: Hapi.Server): void {
        const { label, failure, level, upgrade } = this.options

        /*  authenticate every request except a CORS preflight, which
            carries no credentials by definition  */
        server.ext("onRequest", (request, h) => {
            if (request.method === "options")
                return h.continue
            if (!this.authorized(request.headers.authorization as string | undefined, undefined))
                return h.response(Core.problemBody(401, "missing or invalid bearer token", request.path))
                    .code(401).type("application/problem+json").header(serverHeader, label).takeover()
            return h.continue
        })

        /*  render thrown problems and framework errors as problem details  */
        server.ext("onPreResponse", (request, h) => {
            const response = request.response
            let status: number | null = null
            let detail  = ""
            if (response instanceof Core.Problem) {
                status = response.status
                detail = response.message
            }
            else if ("isBoom" in response && response.isBoom) {
                status = response.output.statusCode
                detail = response.message
            }
            if (status === null)
                return h.continue

            /*  log server-side failures in full, but expose no internals to the client  */
            if (status >= 500) {
                this.log.write("error", `${label}: ${request.method.toUpperCase()} ${request.path}: ${detail}`)
                detail = failure
            }
            else
                this.log.write("debug", `${label}: ${request.method.toUpperCase()} ${request.path}: ${status}: ${detail}`)
            return h.response(Core.problemBody(status, detail, request.path))
                .code(status).type("application/problem+json")
        })

        /*  log every regular request  */
        server.events.on("response", (request) => {
            const response = request.response as unknown
            let code = 0
            if (typeof response === "object" && response !== null) {
                if ("isBoom" in response && response.isBoom && "output" in response)
                    code = (response as { output: { statusCode: number } }).output.statusCode
                else if ("statusCode" in response && typeof response.statusCode === "number")
                    code = response.statusCode
            }
            this.log.write(level(request.path), `${label}: ${request.method.toUpperCase()} ${request.path} ${code}`)
        })

        /*  hook the WebSocket handshakes  */
        server.listener.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            socket.on("error", () => { socket.destroy() })
            Promise.resolve().then(() => upgrade(req, socket, head)).catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err)
                this.log.write("error", `${label}: WebSocket upgrade failed: ${message}`)
                socket.destroy()
            })
        })
    }
}

