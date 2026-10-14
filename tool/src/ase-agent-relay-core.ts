/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as v                   from "valibot"

import * as Core                from "./ase-task-store-core.js"
import * as TaskFormat          from "./ase-task-format.js"

/*  the state of a running agent: waiting for dispatchable tasks, or busy
    processing tasks (a stopped agent has no presence at all)  */
export type AgentState = "waiting" | "busy"

/*  a processing log line of an agent: its time (in ms since the epoch, by the
    clock of the agent), its level, the id of the task it concerns (or empty
    for the agent itself), and its message  */
export type AgentLine = { time: number, level: "error" | "warning" | "info", task: string, msg: string }

/*  the usage of the agent tool by an agent: its wall time (in seconds), its output
    tokens, and its costs (in USD), where the latter two are null if the tool reports none  */
export type AgentUsage = { walltimeSec: number, costToken: number | null, costUSD: number | null }

/*  the usage of the agent tool by an agent: in total since its start,
    and by its last finished job (or null before its first finished job)  */
export type AgentUsages = { total: AgentUsage, last: AgentUsage } | null

/*  the presence of an agent as announced by itself: its kind, name, and mode of
    operation (e.g. "draft", or empty), the name of the requests it processes (of a
    request agent of a definition, else absent), its host and process id, its start
    time (in ms since the epoch, by the clock of the agent), its state, the ids of the tasks
    it is busy with, its usage of the agent tool, and its processing log lines added since
    its previous announcement (a delta only)  */
export type AgentAnnounce = {
    kind: string, name: string, mode: string, request?: string, host: string, pid: number, started: number,
    state: AgentState, tasks: string[], usage: AgentUsages, lines: AgentLine[]
}

/*  the presence of an agent as held by the relay: the announced one (without its
    added lines), plus its id, the times (in ms since the epoch, by the clock of the relay)
    since which it is in its state and of its latest announcement (its heartbeat), and its
    most recent processing log lines (the last one being its current operation)  */
export type AgentPresence = Omit<AgentAnnounce, "lines"> & { id: string, since: number, beat: number, recent: AgentLine[] }

/*  an event frame: the added or updated agents, whose recent processing log lines are
    to be appended to the already known ones of the agent (as a delta), and the removed
    (stopped) agents, where the initial frame of a subscription resets the agents to its
    snapshot (with all their recent processing log lines)  */
export type RelayFrame = { reset?: boolean, agents?: Record<string, AgentPresence>, removed?: string[] }

/*  the maximum number of recent processing log lines kept per agent (by the relay and its
    subscribers), the maximum number of lines per announcement (as an agent keeps its not yet
    announced lines while the relay is unreachable), and the duration after which an agent
    without heartbeat counts as stopped  */
export const RECENT_MAX = 100
export const LINES_MAX  = 100
export const STALE_MS   = 30 * 1000

/*  the maximum length of a processing log line message kept by the relay (as
    the agents themselves already truncate their messages to this length)  */
export const MSG_MAX = 500

/*  the maximum number of projects, of agents per project, and of agents in total
    held by the relay, and the maximum number of subscribers per project and in total,
    bounding the memory of the relay against misbehaving or malicious clients  */
export const PROJECTS_MAX     = 128
export const AGENTS_MAX       = 64
export const AGENTS_TOTAL_MAX = 1024
export const SUBS_MAX         = 64
export const SUBS_TOTAL_MAX   = 1024

/*  append processing log lines to the recent ones, keeping the most recent ones only  */
export const appendLines = (recent: AgentLine[], lines: AgentLine[]): AgentLine[] =>
    lines.length === 0 ? recent : [ ...recent, ...lines ].slice(-RECENT_MAX)

/*  add two usages, where a field stays null only if it is null in both  */
export const addUsage = (a: AgentUsage, b: AgentUsage): AgentUsage => {
    const add = (x: number | null, y: number | null) => x === null && y === null ? null : (x ?? 0) + (y ?? 0)
    return {
        walltimeSec: a.walltimeSec + b.walltimeSec,
        costToken:   add(a.costToken, b.costToken),
        costUSD:     add(a.costUSD, b.costUSD)
    }
}

/*  the valid agent ids (as derived from host, process id, and agent name)  */
export const AGENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

/*  the valibot schema entries of a processing log line and of an announcement  */
const text = (max: number) => v.pipe(v.string(), v.maxLength(max))
const lineEntries = {
    time:  v.number(),
    level: v.picklist([ "error", "warning", "info" ]),
    task:  text(255),
    msg:   text(2000)
}
const amount = v.pipe(v.number(), v.minValue(0))
const usageEntries = {
    walltimeSec: amount,
    costToken:   v.nullable(amount),
    costUSD:     v.nullable(amount)
}
const announceEntries = {
    kind:    v.pipe(text(64), v.minLength(1)),
    name:    v.pipe(text(64), v.minLength(1)),
    mode:    v.optional(text(64), ""),
    request: v.optional(text(64)),
    host:    text(255),
    pid:     v.pipe(v.number(), v.integer(), v.minValue(0)),
    state:   v.picklist([ "waiting", "busy" ]),
    tasks:   v.pipe(v.array(v.pipe(text(255), v.regex(TaskFormat.TASK_ID_RE))), v.maxLength(64))
}

/*  the valibot schema of an announcement (strict, as received by the relay)  */
const announceSchema = v.strictObject({
    ...announceEntries,
    started: v.optional(v.number()),
    usage:   v.optional(v.nullable(v.strictObject({
        total: v.strictObject(usageEntries),
        last:  v.strictObject(usageEntries)
    })), null),
    lines:   v.pipe(v.array(v.strictObject(lineEntries)), v.maxLength(LINES_MAX))
})

/*  the valibot schema of an event frame (lenient on additional fields,
    as received by the subscribers from a potentially newer relay)  */
export const frameSchema = v.object({
    reset:   v.optional(v.boolean()),
    agents:  v.optional(v.record(v.pipe(v.string(), v.regex(AGENT_ID_RE)), v.object({
        ...announceEntries,
        id:      v.pipe(v.string(), v.regex(AGENT_ID_RE)),
        started: v.number(),
        usage:   v.optional(v.nullable(v.object({
            total: v.object(usageEntries),
            last:  v.object(usageEntries)
        })), null),
        since:   v.number(),
        beat:    v.number(),
        recent:  v.pipe(v.array(v.object(lineEntries)), v.maxLength(RECENT_MAX))
    }))),
    removed: v.optional(v.array(v.string()))
})

/*  the transport-agnostic agent relay: the presence of the agents per project (with
    a project existing implicitly while it has agents), the removal of the agents
    without heartbeat, and the emitting of an event frame on every change  */
export class AgentRelayCore {
    private projects = new Map<string, Map<string, AgentPresence>>()
    private timer: ReturnType<typeof setInterval> | null = null

    constructor (private emit: (prjId: string, frame: RelayFrame) => void) {}

    /*  start and stop the periodic removal of the stale agents  */
    start (): void {
        this.timer = setInterval(() => { this.sweep() }, 5 * 1000)
    }
    stop (): void {
        if (this.timer !== null)
            clearInterval(this.timer)
        this.timer = null
        this.projects.clear()
    }

    /*  validate a project id and an agent id  */
    private validate (prjId: string, agentId?: string): void {
        if (!TaskFormat.ID_RE.test(prjId))
            throw Core.problem(422, `invalid project id "${prjId}" (expected: [A-Za-z0-9_-]+)`)
        if (agentId !== undefined && !AGENT_ID_RE.test(agentId))
            throw Core.problem(422, `invalid agent id "${agentId}" (expected: [A-Za-z0-9][A-Za-z0-9_.-]*)`)
    }

    /*  the total number of agents of all projects  */
    private agentsTotal (): number {
        let total = 0
        for (const agents of this.projects.values())
            total += agents.size
        return total
    }

    /*  the projects with agents, each with its number of agents  */
    projectList (): { id: string, agents: number }[] {
        return [ ...this.projects.entries() ].map(([ id, agents ]) => ({ id, agents: agents.size }))
    }

    /*  the agents of a project  */
    list (prjId: string): AgentPresence[] {
        this.validate(prjId)
        return [ ...(this.projects.get(prjId)?.values() ?? []) ]
    }

    /*  announce the presence of an agent (also as its heartbeat), keeping the time since
        which it is in its state while its state is unchanged, appending its added processing
        log lines to its recent ones, and emitting only its added lines (as a delta), where an
        agent not announcing its start time (an older one) counts as started at its first announcement  */
    announce (prjId: string, agentId: string, payload: unknown): void {
        this.validate(prjId, agentId)
        const result = v.safeParse(announceSchema, payload)
        if (!result.success)
            throw Core.problem(422, `invalid agent announcement: ${result.issues[0].message}` +
                (result.issues[0].path !== undefined ? ` (at "${v.getDotPath(result.issues[0]) ?? ""}")` : ""))

        /*  reject a new agent (or a new project) beyond the maximum numbers  */
        let agents     = this.projects.get(prjId)
        const previous = agents?.get(agentId)
        if (previous === undefined) {
            if (agents === undefined && this.projects.size >= PROJECTS_MAX)
                throw Core.problem(429, `too many projects with agents (maximum: ${PROJECTS_MAX})`)
            if (agents !== undefined && agents.size >= AGENTS_MAX)
                throw Core.problem(429, `too many agents of project "${prjId}" (maximum: ${AGENTS_MAX})`)
            if (this.agentsTotal() >= AGENTS_TOTAL_MAX)
                throw Core.problem(429, `too many agents in total (maximum: ${AGENTS_TOTAL_MAX})`)
        }
        if (agents === undefined) {
            agents = new Map<string, AgentPresence>()
            this.projects.set(prjId, agents)
        }

        /*  update the presence, truncating the messages of the added lines  */
        const now = Date.now()
        const { lines: received, ...announced } = result.output
        const lines = received.map((line) => line.msg.length <= MSG_MAX ? line :
            { ...line, msg: `${line.msg.slice(0, MSG_MAX - 1)}…` })
        const presence: AgentPresence = {
            ...announced, id: agentId,
            started: announced.started ?? previous?.started ?? now,
            since:   previous !== undefined && previous.state === announced.state ? previous.since : now,
            beat:    now,
            recent:  appendLines(previous?.recent ?? [], lines)
        }
        agents.set(agentId, presence)
        this.emit(prjId, { agents: { [agentId]: { ...presence, recent: lines } } })
    }

    /*  remove an agent (on its stopping), where a project without agents ceases to exist  */
    remove (prjId: string, agentId: string): void {
        this.validate(prjId, agentId)
        const agents = this.projects.get(prjId)
        if (agents === undefined || !agents.delete(agentId))
            return
        if (agents.size === 0)
            this.projects.delete(prjId)
        this.emit(prjId, { removed: [ agentId ] })
    }

    /*  remove all agents without a heartbeat for the stale duration  */
    private sweep (): void {
        const limit = Date.now() - STALE_MS
        for (const [ prjId, agents ] of this.projects) {
            const removed = [ ...agents.values() ].filter((agent) => agent.beat < limit).map((agent) => agent.id)
            for (const id of removed)
                agents.delete(id)
            if (agents.size === 0)
                this.projects.delete(prjId)
            if (removed.length > 0)
                this.emit(prjId, { removed })
        }
    }
}

