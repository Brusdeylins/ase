/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path                   from "node:path"
import { fileURLToPath }      from "node:url"

import { Command }            from "commander"
import axios                  from "axios"
import type { AxiosError }    from "axios"
import * as v                 from "valibot"
import { execa }              from "execa"

import { StdioServerTransport }          from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { JSONRPCMessage }           from "@modelcontextprotocol/sdk/types.js"

import { Config, configSchema } from "./ase-config.js"
import type Log                 from "./ase-log.js"

const HOST = "127.0.0.1"

/*  schema for ".ase/service.yaml" (same shape as in ase-service.ts)  */
const serviceSchema = v.nullish(v.strictObject({
    port: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1024), v.maxValue(65535)))
}))

/*  distinguish ECONNREFUSED from other Axios transport errors  */
const isConnRefused = (err: unknown): boolean => {
    const e = err as AxiosError & { code?: string, cause?: { code?: string } }
    return e?.code === "ECONNREFUSED" || e?.cause?.code === "ECONNREFUSED"
}

/*  probe the service and verify ASE identity banner  */
const probe = async (port: number, projectId: string): Promise<boolean | null> => {
    try {
        const r = await axios.request({
            method:         "OPTIONS",
            url:            `http://${HOST}:${port}/`,
            timeout:        2000,
            validateStatus: () => true
        })
        if (r.status < 200 || r.status >= 300)
            return false
        const d = r.data as { ase?: boolean, projectId?: string } | null
        return d?.ase === true && d?.projectId === projectId
    }
    catch (err: unknown) {
        if (isConnRefused(err))
            return null
        throw err
    }
}

/*  CLI command "ase mcp"  */
export default class MCPCommand {
    constructor (private log: Log) {}

    /*  load service identity context  */
    private loadContext (): { projectId: string, port: number | null, svc: Config } {
        const cfg = new Config("config", configSchema, this.log)
        cfg.read()
        const svc = new Config("service", serviceSchema, this.log)
        svc.read()
        const rawId     = cfg.get("project.id") as string | null | undefined
        const projectId = rawId ?? path.basename(process.cwd())
        const rawPort   = svc.get("port") as number | null | undefined
        const port: number | null = rawPort ?? null
        return { projectId, port, svc }
    }

    /*  spawn "ase service start" detached and wait for it to come up  */
    private async ensureService (): Promise<{ projectId: string, port: number }> {
        let ctx = this.loadContext()

        /*  fast path: already running  */
        if (ctx.port !== null) {
            const match = await probe(ctx.port, ctx.projectId)
            if (match === true)
                return { projectId: ctx.projectId, port: ctx.port }
        }

        /*  spawn "ase service start" using the same node entry point  */
        const entry = fileURLToPath(new URL("./ase.js", import.meta.url))
        await execa(process.execPath, [ entry, "service", "start" ], {
            stdio:    "ignore",
            detached: false
        })

        /*  re-load context to pick up the freshly persisted port  */
        ctx = this.loadContext()
        if (ctx.port === null)
            throw new Error("mcp: service did not register a port after start")
        const match = await probe(ctx.port, ctx.projectId)
        if (match !== true)
            throw new Error(`mcp: service not responding on port ${ctx.port} after start`)
        return { projectId: ctx.projectId, port: ctx.port }
    }

    /*  bridge stdio to a Streamable HTTP MCP endpoint on the local service  */
    private async runBridge (): Promise<number> {
        /*  ensure the service is running  */
        const { port } = await this.ensureService()

        /*  create MCP HTTP client  */
        const url    = new URL(`http://${HOST}:${port}/mcp`)
        const client = new StreamableHTTPClientTransport(url)

        /*  create MCP STDIO server  */
        const server = new StdioServerTransport()

        /*  handle shutdown  */
        let closed = false
        const shutdown = async () => {
            if (closed)
                return
            closed = true
            await Promise.allSettled([
                server.close(),
                client.close()
            ])
        }

        /*  connect server to client (forward transport)  */
        server.onmessage = (msg: JSONRPCMessage) => {
            client.send(msg).catch((_err: unknown) => {
                const err = _err instanceof Error ? _err : new Error(String(_err))
                this.log.write("error", `mcp: http send: ${err.message}`)
            })
        }
        server.onerror = (_err: Error) => {
            const err = _err instanceof Error ? _err : new Error(String(_err))
            this.log.write("error", `mcp: stdio: ${err.message}`)
        }
        server.onclose = () => {
            shutdown().catch(() => {})
        }

        /*  connect client to server (backward transport)  */
        client.onmessage = (msg: JSONRPCMessage) => {
            server.send(msg).catch((_err: unknown) => {
                const err = _err instanceof Error ? _err : new Error(String(_err))
                this.log.write("error", `mcp: stdout send: ${err.message}`)
            })
        }
        client.onerror = (_err: Error) => {
            const err = _err instanceof Error ? _err : new Error(String(_err))
            this.log.write("error", `mcp: http: ${err.message}`)
        }
        client.onclose = () => {
            shutdown().catch(() => {})
        }

        /*  start server and client  */
        await server.start()
        await client.start()

        /*  await stdio to be closed  */
        await new Promise<void>((resolve) => {
            const done = () => resolve()
            process.stdin.once("end",   done)
            process.stdin.once("close", done)
        })

        /*  shutdown services  */
        await shutdown()
        return 0
    }

    /*  register commands  */
    register (program: Command): void {
        program
            .command("mcp")
            .description("Bridge stdio MCP to the per-project background service over Streamable HTTP")
            .action(async () => {
                process.exit(await this.runBridge())
            })
    }
}
