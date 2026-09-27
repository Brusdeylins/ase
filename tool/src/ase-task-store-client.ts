/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                                               from "node:path"
import fs                                                 from "node:fs"

import { ofetch }                                         from "ofetch"
import { Agent }                                          from "undici"
import { WebSocket }                                      from "ws"
import { LRUCache }                                       from "lru-cache"

import type Log                                           from "./ase-lib-log.js"
import { Config }                                         from "./ase-config-core.js"
import { configSchema }                                   from "./ase-config-schema.js"
import { parseScope, userStateDir }                       from "./ase-config-scope.js"
import * as API                                           from "./ase-task-store-plugin-api.js"
import * as Delegate                                      from "./ase-task-store-plugin-delegate.js"
import * as Core                                          from "./ase-task-store-core.js"
import * as TaskFormat                                    from "./ase-task-format.js"

/*  the client-side view onto a task store, either the in-process
    REST API functionality on the built-in storage plugin (a local
    "ase:<path>" store) or the remote REST API (an "ase[s]://<addr>:<port>[/<token>]"
    store); a missing task plan is reported as null resp. false; the
    effective lifecycle model is known after the opening only  */
export interface TaskStoreClient {
    lifecycle: TaskFormat.TaskLifecycle
    setLifecycle (name: string): Promise<void>
    open   (): Promise<void>
    close  (): Promise<void>
    list   (fields?: "header"): Promise<Core.TaskListEntry[]>
    load   (id: string): Promise<API.TaskPlan | null>
    save   (id: string, plan: API.TaskPlan, tag?: string): Promise<void>
    patch  (id: string, change: { status?: string, id?: string }): Promise<Core.TaskPatchResult | null>
    delete (id: string): Promise<boolean>
    purge  (age: string): Promise<string[]>
    content (id: string, index: number): Promise<{ type: string, content: Buffer } | null>
}

/*  the opened storage delegate of a local store, shared by reference count  */
interface LocalTaskStoreShared {
    refs:   number
    opened: Promise<{ store: Delegate.TaskStore, core: Core.TaskStoreCore }>
}

/*  the local client: the REST API functionality operating in-process
    on the built-in storage plugin in "solo" mode, with the project
    registered under its configured lifecycle model on every open  */
export class LocalTaskStoreClient implements TaskStoreClient {
    /*  the storage delegates, shared by all concurrently open clients of the
        same store (keyed by base directory only, as the lifecycle model is
        re-registered on every open and hence survives a switch without a
        second delegate), so its per-project queue serializes in-process, too  */
    private static shared = new Map<string, LocalTaskStoreShared>()
    private entry: LocalTaskStoreShared | undefined
    private core!: Core.TaskStoreCore
    constructor (private prjId: string, public lifecycle: TaskFormat.TaskLifecycle, private basedir: string, private log: Log) {}
    /*  switch the lifecycle model by persisting "project.task.lifecycle" on scope "project"
        (which the local store always follows) and re-registering the project (mapping the plan states)  */
    async setLifecycle (name: string): Promise<void> {
        const cfg = new Config("config", configSchema, this.log, parseScope("project"))
        cfg.lock(() => {
            cfg.read()
            cfg.set("project.task.lifecycle", name)
            cfg.write()
        })
        await this.core.projectSet(this.prjId, name)
    }
    private async missing<T> (op: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await op()
        }
        catch (err: unknown) {
            if (err instanceof Core.Problem && err.status === 404)
                return fallback
            throw err
        }
    }
    async open (): Promise<void> {
        let entry = LocalTaskStoreClient.shared.get(this.basedir)
        if (entry === undefined) {
            const opened = (async () => {
                const plugin = await Delegate.loadTaskStoragePlugin(Delegate.BUILTIN_PLUGIN, {
                    options: { basedir: this.basedir, solo: true, lifecycle: this.lifecycle.name },
                    log:     (level, message) => this.log.write(level, `task: store: ${message}`)
                })
                const store = new Delegate.TaskStore(plugin)
                const core  = new Core.TaskStoreCore(store)
                await store.open()
                return { store, core }
            })()
            entry = { refs: 0, opened }
            LocalTaskStoreClient.shared.set(this.basedir, entry)
        }
        entry.refs++
        this.entry = entry
        try {
            this.core = (await entry.opened).core
            await this.core.projectSet(this.prjId, this.lifecycle.name)
        }
        catch (err: unknown) {
            await this.close()
            throw err
        }
    }
    async close (): Promise<void> {
        const entry = this.entry
        if (entry === undefined)
            return
        this.entry = undefined
        if (--entry.refs === 0) {
            if (LocalTaskStoreClient.shared.get(this.basedir) === entry)
                LocalTaskStoreClient.shared.delete(this.basedir)
            await entry.opened.then((opened) => opened.store.close(), () => {})
        }
    }
    list (fields?: "header"): Promise<Core.TaskListEntry[]> {
        return this.core.taskList(this.prjId, "none", "none", fields ?? "none")
    }
    load (id: string): Promise<API.TaskPlan | null> {
        return this.missing(() => this.core.taskLoad(this.prjId, id), null)
    }
    async save (id: string, plan: API.TaskPlan, tag?: string): Promise<void> {
        await this.core.taskSave(this.prjId, id, plan, tag)
    }
    patch (id: string, change: { status?: string, id?: string }): Promise<Core.TaskPatchResult | null> {
        return this.missing(() => this.core.taskPatch(this.prjId, id, change), null)
    }
    delete (id: string): Promise<boolean> {
        return this.missing(async () => {
            await this.core.taskDelete(this.prjId, id)
            return true
        }, false)
    }
    purge (age: string): Promise<string[]> {
        return this.core.taskPurge(this.prjId, age)
    }
    content (id: string, index: number): Promise<{ type: string, content: Buffer } | null> {
        return this.missing(() => this.core.attachmentContent(this.prjId, id, String(index)), null)
    }
}

/*  the project as exposed by the project endpoints of a task store server  */
type RemoteProject = { id: string, lifecycle: { name: string } }

/*  the remote client: the REST API of a task store server, with the
    project registered under its configured lifecycle model on first
    use only (afterwards adopting the lifecycle model of the registered
    project) and every problem details response raised as an error; an
    "insecure" client skips the TLS certificate verification  */
export class RemoteTaskStoreClient implements TaskStoreClient {
    /*  the effective lifecycle models of the registered projects (TTL-bounded,
        to spare consecutive operations the registration round-trips)  */
    private static registered = new LRUCache<string, TaskFormat.TaskLifecycle>({ max: 16, ttl: 10 * 1000 })
    private dispatcher: Agent | undefined
    public  lifecycle:  TaskFormat.TaskLifecycle
    constructor (private prjId: string, private configured: TaskFormat.TaskLifecycle, private log: Log,
        private base: string, private token: string, private insecure: boolean) {
        this.lifecycle  = configured
        this.dispatcher = insecure ? new Agent({ connect: { rejectUnauthorized: false } }) : undefined
    }
    /*  perform a request: a 404 response or a tolerated error response yields
        a null result, any other error response is raised as a problem carrying
        its status, and a failed connection is raised as an unreachable store error  */
    private async request<T> (method: string, url: string, body?: unknown,
        headers: Record<string, string> = {}, tolerated: number[] = []): Promise<T | null> {
        const r = await ofetch.raw(`${this.base}${url}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
                ...headers
            },
            body:                body !== undefined ? JSON.stringify(body) : undefined,
            dispatcher:          this.dispatcher,
            signal:              AbortSignal.timeout(10000),
            ignoreResponseError: true
        }).catch((err: unknown) => {
            /*  report the innermost cause (like "connect ECONNREFUSED")  */
            let cause = err
            while (cause instanceof Error && cause.cause instanceof Error)
                cause = cause.cause
            const reason = cause instanceof Error ? cause.message : String(cause)
            throw new Error(`task: store "${this.base}" unreachable: ${reason}`, { cause: err })
        })
        if (r.status === 404 || tolerated.includes(r.status))
            return null
        if (r.status < 200 || r.status >= 300) {
            const d = r._data as { detail?: string, title?: string } | null
            throw new Core.Problem(r.status, `store "${this.base}": ${d?.detail ?? d?.title ?? `HTTP ${r.status}`}`)
        }
        return (r._data ?? {}) as T
    }
    private get tasks (): string {
        return `/projects/${this.prjId}/tasks`
    }
    private get key (): string {
        return `${this.base}/${this.prjId}`
    }
    /*  adopt the lifecycle model of the registered project  */
    private adopt (project: RemoteProject | null): void {
        if (project === null)
            throw new Core.Problem(404, `store "${this.base}": project "${this.prjId}" not registered`)
        const lifecycle = TaskFormat.taskLifecycles[project.lifecycle.name]
        if (lifecycle === undefined)
            throw new Error(`task: store "${this.base}" uses unknown lifecycle model "${project.lifecycle.name}"`)
        this.lifecycle = lifecycle
        RemoteTaskStoreClient.registered.set(this.key, lifecycle)
    }
    /*  raise a not registered project (dropping its cached registration)  */
    private unregistered (): never {
        RemoteTaskStoreClient.registered.delete(this.key)
        throw new Core.Problem(404, `store "${this.base}": project "${this.prjId}" not registered`)
    }
    /*  pass through a task endpoint result, disambiguating a 404 response
        (null) into a missing task or a not registered project  */
    private async task<T> (result: T | null): Promise<T | null> {
        if (result === null && await this.request<RemoteProject>("GET", `/projects/${this.prjId}`) === null)
            this.unregistered()
        return result
    }
    async open (): Promise<void> {
        const cached = RemoteTaskStoreClient.registered.get(this.key)
        if (cached !== undefined) {
            this.lifecycle = cached
            return
        }

        /*  register the project only if not yet registered (via "If-None-Match: *"),
            as the lifecycle model of a registered project is shared by all its clients  */
        const created = await this.request<RemoteProject>("PUT", `/projects/${this.prjId}`,
            { lifecycle: this.configured.name }, { "If-None-Match": "*" }, [ 412 ])
        this.adopt(created ?? await this.request<RemoteProject>("GET", `/projects/${this.prjId}`))
        this.mismatch()
    }
    async setLifecycle (name: string): Promise<void> {
        this.adopt(await this.request<RemoteProject>("PUT", `/projects/${this.prjId}`, { lifecycle: name }))
        this.mismatch()
    }

    /*  warn about a configured lifecycle model deviating from the one of the
        registered project, once per deviation only (persisted across processes)  */
    private mismatch (): void {
        const file = path.join(userStateDir(), "task-lifecycle.json")
        let seen: Record<string, string> = {}
        try {
            const data: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
            if (typeof data === "object" && data !== null && !Array.isArray(data))
                seen = data as Record<string, string>
        }
        catch {
            /*  no (valid) state yet  */
        }
        const pair = this.lifecycle !== this.configured ?
            `${this.configured.name}:${this.lifecycle.name}` : undefined
        if (seen[this.key] === pair)
            return
        if (pair === undefined)
            seen = Object.fromEntries(Object.entries(seen).filter(([ key ]) => key !== this.key))
        else {
            seen[this.key] = pair
            this.log.write("warning", `task: configured "project.task.lifecycle" "${this.configured.name}" ignored, ` +
                `as store "${this.base}" uses "${this.lifecycle.name}" for project "${this.prjId}" ` +
                `(align the configuration via "ase config --scope project set project.task.lifecycle ${this.lifecycle.name}", ` +
                `or switch the store via "ase task lifecycle ${this.configured.name}"; reported once only)`)
        }
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, JSON.stringify(seen, null, 4) + "\n", "utf8")
        }
        catch {
            /*  best-effort only (the warning then repeats)  */
        }
    }
    async close (): Promise<void> {
        await this.dispatcher?.close()
    }
    async list (fields?: "header"): Promise<Core.TaskListEntry[]> {
        const url = this.tasks + (fields !== undefined ? `?fields=${fields}` : "")
        return (await this.request<{ tasks: Core.TaskListEntry[] }>("GET", url) ?? this.unregistered()).tasks
    }
    async load (id: string): Promise<API.TaskPlan | null> {
        return this.task(await this.request<API.TaskPlan>("GET", `${this.tasks}/${id}`))
    }
    async save (id: string, plan: API.TaskPlan, tag?: string): Promise<void> {
        const result = await this.request<{ status: string }>("PUT", `${this.tasks}/${id}`, plan,
            tag !== undefined ? { "If-Match": `"${tag}"` } : {})
        if (result === null)
            this.unregistered()
    }
    async patch (id: string, change: { status?: string, id?: string }): Promise<Core.TaskPatchResult | null> {
        return this.task(await this.request<Core.TaskPatchResult>("PATCH", `${this.tasks}/${id}`, change))
    }
    async delete (id: string): Promise<boolean> {
        return await this.task(await this.request<object>("DELETE", `${this.tasks}/${id}`)) !== null
    }
    async purge (age: string): Promise<string[]> {
        const result = await this.request<{ purged: string[] }>("DELETE", `${this.tasks}?age=${encodeURIComponent(age)}`)
        return (result ?? this.unregistered()).purged
    }
    async content (id: string, index: number): Promise<{ type: string, content: Buffer } | null> {
        const r = await ofetch.raw<ArrayBuffer, "arrayBuffer">(`${this.base}${this.tasks}/${id}/attachment/${index}/content`, {
            headers:             { Authorization: `Bearer ${this.token}` },
            responseType:        "arrayBuffer",
            dispatcher:          this.dispatcher,
            signal:              AbortSignal.timeout(10000),
            ignoreResponseError: true
        }).catch((err: unknown) => {
            throw new Error(`task: store "${this.base}" unreachable: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
        })
        if (r.status === 404)
            return null
        if (r.status < 200 || r.status >= 300)
            throw new Core.Problem(r.status, `store "${this.base}": HTTP ${r.status}`)
        return { type: r.headers.get("content-type") ?? "application/octet-stream", content: Buffer.from(r._data ?? new ArrayBuffer(0)) }
    }

    /*  subscribe to the change events of the project via the WebSocket event
        endpoint, reconnecting after a connection loss or a failed handshake
        (with a change notification on reconnect, as events may have been missed,
        incl. lifecycle model changes), reporting each change of the connection
        state (initially disconnected); returns a function to unsubscribe  */
    subscribe (onChange: () => void, onState?: (connected: boolean) => void): () => void {
        const url = `${this.base.replace(/^http/, "ws")}/projects/${this.prjId}/events`
        let ws:      WebSocket | null = null
        let timer:   ReturnType<typeof setTimeout> | null = null
        let stopped  = false
        let failed   = false
        const connect = (): void => {
            ws = new WebSocket(url, {
                headers:            { Authorization: `Bearer ${this.token}` },
                rejectUnauthorized: !this.insecure
            })
            ws.on("open", () => {
                if (failed) {
                    RemoteTaskStoreClient.registered.delete(this.key)
                    onChange()
                }
                failed = false
                onState?.(true)
            })
            ws.on("message", (data) => {
                /*  drop the cached lifecycle model on a lifecycle model change  */
                try {
                    const frame = JSON.parse(String(data)) as Core.EventFrame
                    if (frame.lifecycle !== undefined)
                        RemoteTaskStoreClient.registered.delete(this.key)
                }
                catch {
                    /*  ignore malformed frames (the change is notified anyway)  */
                }
                onChange()
            })
            ws.on("error", (err) => {
                this.log.write("debug", `task: store "${this.base}": events: ${err.message}`)
            })
            ws.on("close", () => {
                ws     = null
                failed = true
                if (!stopped) {
                    onState?.(false)
                    timer = setTimeout(connect, 2000)
                }
            })
        }
        connect()
        return () => {
            stopped = true
            if (timer !== null)
                clearTimeout(timer)
            ws?.close()
            this.close().catch(() => {})
        }
    }
}

