/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path                   from "node:path"
import fs                     from "node:fs"
import net                    from "node:net"
import { fileURLToPath }      from "node:url"
import { spawn }              from "node:child_process"
import type { ChildProcess }  from "node:child_process"

import { Command }            from "commander"
import Hapi                   from "@hapi/hapi"
import axios                  from "axios"
import type { AxiosError }    from "axios"
import { isMap }              from "yaml"
import * as v                 from "valibot"
import prettyMs               from "pretty-ms"

import { Config, configSchema } from "./ase-config.js"
import type Log                 from "./ase-log.js"

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
    const rawId     = cfg.get("project.id") as string | null | undefined
    const projectId = rawId ?? path.basename(process.cwd())

    /*  determine service port  */
    const rawPort = svc.get("port") as number | null | undefined
    const port: number | null = rawPort ?? null

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

/*  clear the persisted port and remove ".ase/service.yaml" if it is empty  */
const clearPort = (svc: Config): void => {
    svc.delete("port")
    const root  = svc.get()
    const empty = root === undefined || root === null || (isMap(root) && root.items.length === 0)
    if (empty) {
        if (fs.existsSync(svc.filename))
            fs.rmSync(svc.filename)
    }
    else
        svc.write()
}

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

/*  service-side: bind HAPI server until "/stop" command is received or idle timeout happens  */
const runService = async (ctx: Context & { port: number }): Promise<void> => {
    /*  establish HAPI HTTP/REST service  */
    const server = Hapi.server({ host: HOST, port: ctx.port })

    /*  track start time and last activity  */
    const startTime  = Date.now()
    let lastActivity = Date.now()
    let stopping     = false
    server.ext("onRequest", (_request, h) => {
        lastActivity = Date.now()
        return h.continue
    })

    /*  listen to HTTP/REST endpoints  */
    server.route({
        method:  "OPTIONS",
        path:    "/",
        handler: (_request, h) => {
            return h.response({ ase: true, projectId: ctx.projectId }).code(200)
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
            const cmd = payload.command
            if (cmd === "ping")
                return h.response({ ok: true, pong: true }).code(200)
            if (cmd === "status")
                return h.response({
                    ok:        true,
                    projectId: ctx.projectId,
                    port:      ctx.port,
                    uptimeMs:  Date.now() - startTime
                }).code(200)
            return h.response({ error: "unknown command", command: cmd }).code(400)
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
            const match = await probe(ctx.port, ctx.projectId).catch(() => null)
            if (match === true)
                process.exit(0)
            process.stderr.write(`ase: service: port ${ctx.port} in use, but not responding!\n`)
            process.exit(1)
        }
        process.stderr.write(`ase: service: ${e.message}\n`)
        process.exit(1)
    }

    /*  stop service after idle timeout  */
    setInterval(async () => {
        if (stopping)
            return
        if (Date.now() - lastActivity > IDLE_MS) {
            stopping = true
            try {
                await server.stop({ timeout: 1000 })
                process.exit(0)
            }
            catch (err: unknown) {
                const e = err as Error
                process.stderr.write(`ase: service: stop failed: ${e.message}\n`)
                process.exit(1)
            }
        }
    }, TICK_MS).unref()
}

/*  spawn the current executable detached as a background service  */
const spawnDetached = (aseDir: string): { child: ChildProcess, logFile: string } => {
    fs.mkdirSync(aseDir, { recursive: true })
    const logFile = path.join(aseDir, "service.log")
    const log     = fs.openSync(logFile, "a")
    const entry   = fileURLToPath(new URL("./ase.js", import.meta.url))
    const child   = spawn(process.execPath, [ entry, "service", "start" ], {
        detached: true,
        env:      { ...process.env, [SERVE_ENV]: "1" },
        stdio:    [ "ignore", log, log ]
    })
    return { child, logFile }
}

/*  read the last N non-empty lines of a log file for diagnostics  */
const readLogTail = (logFile: string, lines: number): string => {
    try {
        const data = fs.readFileSync(logFile, "utf8")
        const all  = data.split("\n").filter((l) => l.length > 0)
        return all.slice(-lines).join("\n")
    }
    catch {
        return ""
    }
}

/*  start flow: ensure port, probe, optionally detach  */
const doStart = async (): Promise<number> => {
    const ctx = loadContext()
    let port = ctx.port
    if (process.env[SERVE_ENV] === "1") {
        if (port === null) {
            port = await allocatePort()
            persistPort(ctx.svc, port)
        }
        await runService({ ...ctx, port })
        return await new Promise<number>(() => { /*  never resolves  */ })
    }
    if (port !== null) {
        const match = await probe(port, ctx.projectId)
        if (match === true) {
            process.stderr.write(`ase: service: already running on port ${port}\n`)
            return 0
        }
    }
    /*  bounded retry across the bind/start TOCTOU window: on each attempt
        re-allocate, re-persist, re-spawn; early-break on foreign listener  */
    let lastErr: Error = new Error("service failed to start within timeout")
    for (let attempt = 0; attempt < 3; attempt++) {
        port = await allocatePort()
        persistPort(ctx.svc, port)
        const { child, logFile } = spawnDetached(ctx.aseDir)
        let exited   = false
        let exitCode: number | null = null
        const onExit = (code: number | null) => {
            exited   = true
            exitCode = code
        }
        child.once("exit", onExit)
        let foreign = false
        try {
            for (let i = 0; i < 50; i++) {
                await new Promise((resolve) => setTimeout(resolve, 100))
                if (exited)
                    break
                const s = await probe(port, ctx.projectId)
                if (s === true) {
                    process.stderr.write(`ase: service: started on port ${port}\n`)
                    child.unref()
                    return 0
                }
                if (s === false) {
                    foreign = true
                    break
                }
            }
            const tail   = readLogTail(logFile, 20)
            const reason = exited ?
                `service exited during startup (code ${exitCode})` :
                foreign ?
                    `service lost port ${port} race to a foreign listener` :
                    "service failed to start within timeout"
            const detail = tail.length > 0 ? `\n---- ${logFile} (tail) ----\n${tail}` : ""
            lastErr = new Error(`${reason}${detail}`)
        }
        finally {
            child.removeListener("exit", onExit)
        }
    }
    throw lastErr
}

/*  status flow: report whether the service is running  */
const doStatus = async (): Promise<number> => {
    const ctx = loadContext()
    if (ctx.port === null) {
        process.stdout.write("ase: service: not running (no port configured)\n")
        return 1
    }
    const match = await probe(ctx.port, ctx.projectId)
    if (match === true) {
        const r = await axios.request({
            method:         "POST",
            url:            `http://${HOST}:${ctx.port}/command`,
            headers:        { "Content-Type": "application/json" },
            data:           { command: "status" },
            timeout:        2000,
            validateStatus: () => true
        })
        const d        = r.data as { uptimeMs?: number } | null
        const uptimeMs = typeof d?.uptimeMs === "number" ? d.uptimeMs : 0
        const uptime   = prettyMs(uptimeMs, { verbose: true })
        process.stdout.write(`ase: service: running on port ${ctx.port} (uptime: ${uptime})\n`)
        return 0
    }
    if (match === false) {
        process.stdout.write(`ase: service: not running (port ${ctx.port} in use by foreign service)\n`)
        return 1
    }
    process.stdout.write(`ase: service: not running (port ${ctx.port} not responding)\n`)
    return 1
}

/*  send command: POST /command with the arbitrary cmd token  */
const doSend = async (cmd: string): Promise<number> => {
    let ctx = loadContext()
    if (ctx.port === null) {
        await doStart()
        ctx = loadContext()
        if (ctx.port === null)
            throw new Error("service not running (no port configured after auto-start)")
    }
    const match = await probe(ctx.port, ctx.projectId)
    if (match !== true) {
        await doStart()
        ctx = loadContext()
        if (ctx.port === null)
            throw new Error("service not running (no port configured after auto-start)")
    }
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

/*  stop flow: no-op if no port configured or connection refused  */
const doStop = async (): Promise<number> => {
    const ctx = loadContext()
    if (ctx.port === null) {
        process.stderr.write("ase: service: not running (no port configured)\n")
        return 0
    }
    try {
        const r  = await axios.request({
            method:         "GET",
            url:            `http://${HOST}:${ctx.port}/stop`,
            timeout:        5000,
            validateStatus: () => true
        })
        const ok = r.status >= 200 && r.status < 300
        if (ok)
            clearPort(ctx.svc)
        return ok ? 0 : 1
    }
    catch (err: unknown) {
        if (isConnRefused(err)) {
            process.stderr.write(`ase: service: not running (port ${ctx.port} not responding)\n`)
            clearPort(ctx.svc)
            return 0
        }
        throw err
    }
}

/*  register CLI command "ase service"  */
const registerServiceCommand = (program: Command, _log: Log): void => {
    const service = program
        .command("service")
        .description("Manage per-project background HTTP service")
        .action(() => {
            service.outputHelp()
            process.exit(1)
        })

    /*  register CLI sub-command "ase service start"  */
    service
        .command("start")
        .description("Start the background service")
        .action(async () => {
            process.exit(await doStart())
        })

    /*  register CLI sub-command "ase service status"  */
    service
        .command("status")
        .description("Report whether the background service is running")
        .action(async () => {
            process.exit(await doStatus())
        })

    /*  register CLI sub-command "ase service send"  */
    service
        .command("send")
        .description("Send a command to the background service")
        .argument("<cmd>", "Command token to dispatch to the service")
        .action(async (cmd: string) => {
            process.exit(await doSend(cmd))
        })

    /*  register CLI sub-command "ase service stop"  */
    service
        .command("stop")
        .description("Stop the background service")
        .action(async () => {
            process.exit(await doStop())
        })
}

export default registerServiceCommand
