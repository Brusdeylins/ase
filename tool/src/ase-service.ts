/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path                   from "node:path"
import fs                     from "node:fs"
import net                    from "node:net"
import { spawn }              from "node:child_process"

import { Command }            from "commander"
import Hapi                   from "@hapi/hapi"
import axios                  from "axios"
import type { AxiosError }    from "axios"
import * as v                 from "valibot"

import { Config, configSchema } from "./ase-config.js"

interface Context {
    projectId: string
    port:      number | null
    svc:       Config
    aseDir:    string
}

const SERVE_ENV  = "ASE_SERVICE_SERVE"
const HOST       = "127.0.0.1"
const IDLE_MS    = 30 * 60 * 1000
const TICK_MS    = 60 * 1000
const PORT_MIN   = 42000
const PORT_MAX   = 44000
const PORT_TRIES = 20

/*  schema for ".ase/service.yaml"  */
const serviceSchema = v.nullish(v.strictObject({
    port: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1024), v.maxValue(65535)))
}))

/*  load optional ".ase/config.yaml" and ".ase/service.yaml" files  */
const loadContext = (): Context => {
    /*  load files  */
    const cfg = new Config("config", configSchema)
    cfg.read()
    const svc = new Config("service", serviceSchema)
    svc.read()

    /*  determine project id  */
    const rawId = cfg.get("project.id")
    const projectId = (rawId === undefined || rawId === null) ? path.basename(process.cwd()) : rawId as string

    /*  determine service port  */
    const rawPort = svc.get("port")
    const port: number | null = (rawPort === undefined || rawPort === null) ? null : rawPort as number

    /*  determine path to ".ase" directory  */
    const aseDir = path.dirname(svc.filename)

    /*  return context information  */
    return {
        projectId,
        port,
        svc,
        aseDir
    }
}

/*  try binding a single candidate port to verify availability  */
const tryBind = (port: number): Promise<boolean> => {
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

/*  allocate a fresh random port in PORT_MIN..PORT_MAX  */
const allocatePort = async (): Promise<number> => {
    for (let i = 0; i < PORT_TRIES; i++) {
        const p = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1))
        if (await tryBind(p))
            return p
    }
    throw new Error(`failed to allocate a port in ${PORT_MIN}..${PORT_MAX} after ${PORT_TRIES} attempts`)
}

/*  persist an allocated port into ".ase/service.yaml"  */
const persistPort = (svc: Config, port: number): void => {
    svc.set("port", port)
    svc.write()
}

/*  distinguish ECONNREFUSED from other Axios transport errors  */
const isConnRefused = (err: unknown): boolean => {
    const e = err as AxiosError & { code?: string, cause?: { code?: string } }
    return e?.code === "ECONNREFUSED" || e?.cause?.code === "ECONNREFUSED"
}

/*  probe the service  */
const probe = async (port: number): Promise<number | null> => {
    try {
        const r = await axios.request({
            method:         "OPTIONS",
            url:            `http://${HOST}:${port}/`,
            timeout:        2000,
            validateStatus: () => true
        })
        return r.status
    }
    catch (err: unknown) {
        if (isConnRefused(err))
            return null
        throw err
    }
}

/*  service-side: bind HAPI server until "/stop" command is received or idle timeout happens  */
const runService = async (ctx: Context & { port: number }): Promise<void> => {
    /*  establish HAPI HTTP/REST service  */
    const server = Hapi.server({ host: HOST, port: ctx.port })

    /*  track last activity  */
    let lastActivity = Date.now()
    server.ext("onRequest", (_request, h) => {
        lastActivity = Date.now()
        return h.continue
    })

    /*  listen to HTTP/REST endpoints  */
    server.route({
        method:  "OPTIONS",
        path:    "/",
        handler: (_request, h) => {
            return h.response().code(204)
        }
    })
    server.route({
        method:  "GET",
        path:    "/stop",
        handler: (_request, h) => {
            setImmediate(async () => {
                await server.stop({ timeout: 1000 })
                process.exit(0)
            })
            return h.response({ ok: true }).code(200)
        }
    })
    server.route({
        method:  "POST",
        path:    "/command",
        options: { payload: { parse: true, allow: "application/json" } },
        handler: (request, h) => {
            const payload = request.payload as { command?: unknown } | null
            if (!payload || typeof payload.command !== "string")
                return h.response({ error: "missing or invalid 'command' field" }).code(400)
            if (payload.command === "foo") {
                return h.response({
                    ok:        true,
                    projectId: ctx.projectId,
                    command:   "Hello World" // FIXME
                }).code(200)
            }
            else
                return h.response({ error: "invalid 'command' field" }).code(400)
        }
    })

    /*  start service  */
    try {
        await server.start()
    }
    catch (err: unknown) {
        const e = err as Error & { code?: string }
        if (e.code === "EADDRINUSE") {
            /*  race-loser re-probe: another "ase service start" won the race  */
            const status = await probe(ctx.port).catch(() => null)
            if (status !== null && status >= 200 && status < 300)
                process.exit(0)
            process.stderr.write(`ase: service: port ${ctx.port} in use, but not responding!\n`)
            process.exit(1)
        }
        process.stderr.write(`ase: service: ${e.message}\n`)
        process.exit(1)
    }

    /*  stop service after idle timeout  */
    setInterval(() => {
        if (Date.now() - lastActivity > IDLE_MS) {
            server.stop({ timeout: 1000 }).then(() => {
                process.exit(0)
            })
        }
    }, TICK_MS).unref()
}

/*  spawn the current executable detached as a background service  */
const spawnDetached = (aseDir: string): void => {
    fs.mkdirSync(aseDir, { recursive: true })
    const logFile = path.join(aseDir, "service.log")
    const log     = fs.openSync(logFile, "a")
    const child   = spawn(process.execPath, [ process.argv[1]!, "service", "start" ], {
        detached: true,
        env:      { ...process.env, [SERVE_ENV]: "1" },
        stdio:    [ "ignore", log, log ]
    })
    child.unref()
}

/*  start flow: ensure port, probe, optionally detach  */
const doStart = async (): Promise<number> => {
    const ctx = loadContext()
    let port = ctx.port
    if (port === null) {
        port = await allocatePort()
        persistPort(ctx.svc, port)
    }
    if (process.env[SERVE_ENV] === "1") {
        await runService({ ...ctx, port })
        return await new Promise<number>(() => { /*  never resolves  */ })
    }
    const status = await probe(port)
    if (status !== null && status >= 200 && status < 300)
        return 0
    spawnDetached(ctx.aseDir)
    for (let i = 0; i < 50; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const s = await probe(port)
        if (s !== null && s >= 200 && s < 300) {
            process.stdout.write(`ase: service: started on port ${port}\n`)
            return 0
        }
    }
    throw new Error("service failed to start within timeout")
}

/*  stop flow: no-op if no port configured or connection refused  */
const doStop = async (): Promise<number> => {
    const ctx = loadContext()
    if (ctx.port === null) {
        process.stdout.write("ase: service: not running (no port configured)\n")
        return 0
    }
    try {
        const r = await axios.request({
            method:         "GET",
            url:            `http://${HOST}:${ctx.port}/stop`,
            timeout:        5000,
            validateStatus: () => true
        })
        return r.status >= 200 && r.status < 300 ? 0 : 1
    }
    catch (err: unknown) {
        if (isConnRefused(err)) {
            process.stdout.write(`ase: service: not running (port ${ctx.port} not responding)\n`)
            return 0
        }
        throw err
    }
}

/*  passthrough flow: POST /command with the arbitrary cmd token  */
const doPassthrough = async (cmd: string): Promise<number> => {
    let ctx = loadContext()
    if (ctx.port === null) {
        await doStart()
        ctx = loadContext()
        if (ctx.port === null)
            throw new Error("service not running (no port configured after auto-start)")
    }
    const send = async (): Promise<number> => {
        const r = await axios.request({
            method:            "POST",
            url:               `http://${HOST}:${ctx.port}/command`,
            headers:           { "Content-Type": "application/json" },
            data:              { command: cmd },
            timeout:           0,
            validateStatus:    () => true,
            responseType:      "text",
            transformResponse: [ (x) => x ]
        })
        const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data)
        process.stdout.write(body)
        if (!body.endsWith("\n"))
            process.stdout.write("\n")
        return r.status >= 200 && r.status < 300 ? 0 : 1
    }
    try {
        return await send()
    }
    catch (err: unknown) {
        if (isConnRefused(err)) {
            await doStart()
            return await send()
        }
        throw err
    }
}

/*  command-line handling  */
const registerServiceCommand = (program: Command): void => {
    const service = program
        .command("service")
        .description("Manage per-project background HTTP service")
        .argument("[cmd]", "Command token to dispatch to the service")
        .action(async (cmd: string | undefined) => {
            if (cmd === undefined) {
                service.outputHelp()
                process.exit(1)
            }
            process.exit(await doPassthrough(cmd))
        })

    service
        .command("start")
        .description("Start the background service")
        .action(async () => {
            process.exit(await doStart())
        })

    service
        .command("stop")
        .description("Stop the background service")
        .action(async () => {
            process.exit(await doStop())
        })
}

export default registerServiceCommand
