/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import crypto                       from "node:crypto"
import fs                           from "node:fs"
import os                           from "node:os"
import path                         from "node:path"
import readline                     from "node:readline"
import { stripVTControlCharacters } from "node:util"
import { AsyncLocalStorage }        from "node:async_hooks"

import { Command }                  from "commander"
import { execa }                    from "execa"
import { DateTime }                 from "luxon"
import which                        from "which"
import lockfile                     from "proper-lockfile"

import type Log                     from "./ase-lib-log.js"
import { Task }                     from "./ase-task.js"
import * as TaskFormat              from "./ase-task-format.js"
import type * as API                from "./ase-task-store-plugin-api.js"
import { Config }                   from "./ase-config-core.js"
import { configSchema, parsePrices, modelPrice, tokenCost } from "./ase-config-schema.js"
import type { TokenCounts }         from "./ase-config-schema.js"
import { userStateDir }             from "./ase-config-scope.js"
import { Worktree }                 from "./ase-util-worktree.js"
import { writeStdout }              from "./ase-lib-stdio.js"
import type { Tool }                from "./ase-setup-common.js"
import { parseTool, toolSpecs }     from "./ase-setup-common.js"
import { AgentPresenceReporter }    from "./ase-agent-relay-client.js"
import type { AgentRelayClient }    from "./ase-agent-relay-client.js"
import type { AgentUsage }          from "./ase-agent-relay-core.js"
import { telemetryEnabled }         from "./ase-service-otel.js"

/*  command options type of all agents  */
export interface AgentOpts {
    tool:        string
    parallel:    string
    timeout:     string
    oneShot:     boolean
    repo?:       string
    tempdir?:    string
    name?:       string
    agentRelay?: string
}

/*  a claimed task: its id, its title, and its flattened header keys  */
export type AgentTask = { id: string, title: string, keys: Map<string, string> }

/*  a listed task: its id, its status, its title, and its flattened header keys  */
export type AgentItem = { id: string, status: string, title: string, keys: Map<string, string> }

/*  the selection of the listed tasks by an agent: the dispatchable tasks, the waiting
    tasks (with the reason), and optionally the tasks with a notice (e.g. on a problem
    of their dependencies), where the waiting and noticed tasks are reported once per
    change of their reason resp. notice  */
export type AgentSelection = { tasks: AgentTask[], waiting: Map<string, string>, notices?: Map<string, string> }

/*  the level of a processing log line  */
export type LineLevel = "error" | "warning" | "info"

/*  the processing log of a claimed task  */
export type AgentLog = (level: LineLevel, msg: string) => Promise<void>

/*  the result of the invocation of the headless agent tool: whether it succeeded
    (exit code 0 without timeout and interrupt), and its agent message text lines  */
export type AgentResult = { ok: boolean, output: string[] }

/*  the invocation of a skill command "<skill> <args>" (rendered per agent tool, see
    "skillPrompt"), or alternatively of an already rendered raw prompt, in a working
    directory, optionally granting access to additional directories, optionally
    finished after the invocation (e.g. by committing its result), and
    optionally cleaned up afterwards in any case, even after a failed
    finishing or a timed out preparing (e.g. by removing its temporary worktree)  */
export type AgentJob = {
    cmd?:     string
    prompt?:  string
    cwd:      string
    dirs?:    string[]
    finish?:  (log: AgentLog, result: AgentResult) => Promise<void>
    cleanup?: (log: AgentLog) => Promise<void>
}

/*  the work of a job in its working directory (see "Agent.sourceJob", "Agent.changesetJob",
    "Agent.changesetReadJob", and "Agent.targetJob"): the job without its prompt, plus the
    temporary worktree of a "branch:" source (else empty) and the ASE worktree id under
    which the skill finds the changeset (else empty)  */
export type AgentWork = Omit<AgentJob, "cmd" | "prompt"> & { dirs: string[], sourceDir: string, changesetWorktree: string }

/*  the type ("worktree", "branch", "attachment", or "source") and the name
    (of "branch:<name>" and "attachment:<name>") of a change set flow value  */
export type FlowValue = { type: string, name: string }

/*  a processing log entry decoded from an event of the agent tool,
    where an entry of agent message text is also an output line of the skill,
    and a quiet entry is not kept in the processing log attachment of the task  */
type ToolEntry = { level: LineLevel, msg: string, text?: boolean, quiet?: boolean }

/*  the maximum number of lines of an agent message kept in the processing log attachment
    of the task (as an agent message can be huge, e.g. the rendering of the whole task plan,
    which would otherwise be fed back into the next rendering of the task plan)  */
const TEXT_MAX = 20

/*  the per-tool headless invocation of the rendered prompt <prompt> with access to the
    additional directories <add> (the "--add-dir" options), streaming JSONL events,
    where risky actions are denied or automatically reviewed instead of being prompted for
    (the variadic "--add-dir" of Claude has to precede the other options to not consume the prompt)  */
const toolArgs: Record<Tool, (prompt: string, add: string[]) => string[]> = {
    "claude":  (prompt, add) => [
        ...add, "-p", "--output-format", "stream-json", "--verbose", "--disallowedTools", "AskUserQuestion",
        "--permission-mode", "auto", "--permission-prompts", "none", prompt
    ],
    "copilot": (prompt, add) => [
        ...add, "--allow-all-tools", "--no-ask-user", "--no-color", "--output-format", "json", "-p", prompt
    ],
    "codex":   (prompt, add) => [
        "exec", ...add, "--json", "--approve-for-me", "--color", "never", prompt
    ]
}

/*  the per-tool rendering of the invocation of the skill <skill> with the arguments <args>:
    "/<skill>" for Claude and Copilot and "$<skill>" for Codex, where an un-namespaced ASE
    skill ("ase-*") gets the plugin namespace "ase:" for Claude only (as Copilot and Codex
    invoke the plugin skills un-namespaced), and the arguments are appended with a single
    space only if non-empty  */
export const skillPrompt = (tool: Tool, skill: string, args: string): string => {
    const name = tool === "claude" && skill.startsWith("ase-") && !skill.includes(":") ? `ase:${skill}` : skill
    return `${tool === "codex" ? "$" : "/"}${name}${args !== "" ? ` ${args}` : ""}`
}

/*  abbreviate a value into a single line of at most <max> characters  */
const brief = (value: unknown, max = 160): string => {
    const line = (typeof value === "string" ? value : JSON.stringify(value) ?? "").replace(/\s+/g, " ").trim()
    return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/*  the constructors of processing log entries: informational, warning,
    warning on failure (else informational), and agent message text  */
const info = (msg: string): ToolEntry => ({ level: "info",    msg })
const warn = (msg: string): ToolEntry => ({ level: "warning", msg })
const note = (failed: boolean, msg: string): ToolEntry => failed ? warn(msg) : info(msg)
const text = (msg: string): ToolEntry => ({ level: "info",    msg, text: true })

/*  the per-tool decoding of a JSONL event of the agent tool into processing log entries,
    covering agent messages, tool calls, failures, and the final result only  */
const toolEvents: Record<Tool, (ev: any) => ToolEntry[]> = {
    "claude": (ev) => {
        const content: any[] = Array.isArray(ev.message?.content) ? ev.message.content : []
        if (ev.type === "system" && ev.subtype === "init")
            return [ info(`session ${ev.session_id} started (model: ${ev.model})`) ]
        else if (ev.type === "system" && ev.subtype === "api_retry")
            return [ warn(`API retry ${ev.attempt}/${ev.max_retries} (error: ${ev.error})`) ]
        else if (ev.type === "assistant")
            return content.filter((block) => block.type === "text" || block.type === "tool_use")
                .map((block) => block.type === "text" ? text(block.text) : info(`tool ${block.name}: ${brief(block.input)}`))
        else if (ev.type === "user")
            return content.filter((block) => block.type === "tool_result" && block.is_error === true)
                .map((block) => warn(`tool failed: ${brief(block.content)}`))
        else if (ev.type === "result")
            return [
                ...(Array.isArray(ev.permission_denials) ? ev.permission_denials : [])
                    .map((denial: any) => warn(`permission denied: tool ${denial.tool_name}: ${brief(denial.tool_input)}`)),
                note(ev.is_error === true, `result: ${ev.subtype} (turns: ${ev.num_turns}, ` +
                    `duration: ${Math.round((ev.duration_ms ?? 0) / 1000)}s, cost: $${Number(ev.total_cost_usd ?? 0).toFixed(2)})`)
            ]
        return []
    },
    "copilot": (ev) => {
        const data = ev.data ?? {}
        if (ev.type === "session.start")
            return [ info(`session ${data.sessionId} started (model: ${data.selectedModel ?? "default"})`) ]
        else if (ev.type === "assistant.message" && typeof data.content === "string" && data.content !== "")
            return [ text(data.content) ]
        else if (ev.type === "tool.execution_start")
            return [ info(`tool ${data.toolName}: ${brief(data.arguments ?? {})}`) ]
        else if (ev.type === "tool.execution_complete" && data.success !== true)
            return [ warn(`tool failed: ${brief(data.error?.message ?? data.result?.content ?? "")}`) ]
        else if (ev.type === "subagent.failed")
            return [ warn(`sub-agent ${data.agentName} failed: ${brief(data.error)}`) ]
        else if (ev.type === "session.error" || ev.type === "session.warning")
            return [ warn(`${ev.type.replace(/^session\./, "")}: ${brief(data.message)}`) ]
        else if (ev.type === "result")
            return [ note(ev.exitCode !== 0, `result: exit code ${ev.exitCode} ` +
                `(duration: ${Math.round((ev.usage?.sessionDurationMs ?? 0) / 1000)}s, ` +
                `premium requests: ${ev.usage?.premiumRequests ?? 0})`) ]
        return []
    },
    "codex": (ev) => {
        const item = ev.item ?? {}
        const done = ev.type === "item.completed"
        if (ev.type === "thread.started")
            return [ info(`thread ${ev.thread_id} started`) ]
        else if (ev.type === "item.started" && item.type === "command_execution")
            return [ info(`command: ${brief(item.command)}`) ]
        else if (ev.type === "item.started" && item.type === "mcp_tool_call")
            return [ info(`tool ${item.server}/${item.tool}: ${brief(item.arguments ?? {})}`) ]
        else if (done && item.type === "agent_message")
            return [ text(item.text) ]
        else if (done && item.type === "command_execution" && item.status !== "completed")
            return [ warn(`command ${item.status} (exit code ${item.exit_code ?? "none"}): ${brief(item.command)}`) ]
        else if (done && item.type === "mcp_tool_call" && item.status !== "completed")
            return [ warn(`tool ${item.server}/${item.tool} failed: ${brief(item.error?.message ?? "")}`) ]
        else if (done && item.type === "file_change")
            return [ note(item.status !== "completed", `file change ${item.status}: ` +
                (Array.isArray(item.changes) ? item.changes : []).map((change: any) => `${change.kind} ${change.path}`).join(", ")) ]
        else if (done && item.type === "web_search")
            return [ info(`web search: ${brief(item.query)}`) ]
        else if (done && item.type === "error")
            return [ warn(`error: ${brief(item.message)}`) ]
        else if (ev.type === "turn.completed")
            return [ info(`turn completed (tokens: input ${ev.usage?.input_tokens ?? 0}, output ${ev.usage?.output_tokens ?? 0})`) ]
        else if (ev.type === "turn.failed")
            return [ warn(`turn failed: ${brief(ev.error?.message)}`) ]
        else if (ev.type === "error")
            return [ warn(`error: ${brief(ev.message)}`) ]
        return []
    }
}

/*  the output tokens and the costs (in USD) of the usage of the agent tool,
    each staying null as long as the tool reports nothing about it, plus the
    cache read, cache write, and (uncached) input tokens and the AI request time
    (in ms, null if the tool reports none), for the AI usage accounting of the task  */
type ToolCosts = Pick<AgentUsage, "costToken" | "costUSD"> & Omit<TokenCounts, "output"> & { apiMs: number | null }

/*  a reported amount (where a missing or invalid one counts as zero)  */
const amount = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0

/*  the per-tool accounting of a JSONL event of the agent tool into its costs: the output tokens
    (as the input tokens are dominated by the context re-sent on every turn) and the costs in USD
    of Claude (over all its models, i.e. including its sub-agents, from its final result), nothing
    of Copilot (as it reports premium requests only), and the output tokens of Codex (summed over
    its turns), plus the cache and input tokens and the AI request time where reported (where
    the input tokens of Claude exclude the cache tokens, while those of Codex include them)  */
const toolCosts: Record<Tool, (ev: any, costs: ToolCosts) => void> = {
    "claude": (ev, costs) => {
        if (ev.type !== "result")
            return
        const models: any[] = ev.modelUsage !== null && typeof ev.modelUsage === "object" ? Object.values(ev.modelUsage) : []
        const sum = (key: string, fallback: string) => models.length > 0 ?
            models.reduce((acc, u) => acc + amount(u?.[key]), 0) :
            amount(ev.usage?.[fallback])
        costs.costToken = sum("outputTokens",             "output_tokens")
        costs.cread     = sum("cacheReadInputTokens",     "cache_read_input_tokens")
        costs.cwrite    = sum("cacheCreationInputTokens", "cache_creation_input_tokens")
        costs.input     = sum("inputTokens",              "input_tokens")
        costs.costUSD   = amount(ev.total_cost_usd)
        costs.apiMs     = typeof ev.duration_api_ms === "number" ? amount(ev.duration_api_ms) : null
    },
    "copilot": (ev, costs) => {
        /*  no tokens and costs reported  */
        if (ev.type === "result" && ev.usage?.sessionDurationMs !== undefined)
            costs.apiMs = amount(ev.usage.sessionDurationMs)
    },
    "codex": (ev, costs) => {
        if (ev.type === "turn.completed") {
            const cread  = amount(ev.usage?.cached_input_tokens)
            const cwrite = amount(ev.usage?.cache_write_input_tokens)
            costs.costToken = (costs.costToken ?? 0) + amount(ev.usage?.output_tokens)
            costs.cread    += cread
            costs.cwrite   += cwrite
            costs.input    += Math.max(0, amount(ev.usage?.input_tokens) - cread - cwrite)
        }
    }
}

/*  decode an output line of the agent tool into processing log entries without
    terminal control sequences: a JSONL event via the decoder of the tool (splitting
    agent message text into its lines, and accounting it into the costs), and any
    other non-blank line as plain text  */
const toolEntries = (tool: Tool, line: string, costs: ToolCosts): ToolEntry[] => {
    let ev: unknown = null
    if (line.startsWith("{")) {
        try {
            ev = JSON.parse(line)
        }
        catch (_e) {
            /*  not a JSONL event: treat as plain text  */
        }
    }
    if (ev === null || typeof ev !== "object") {
        const plain = stripVTControlCharacters(line)
        return plain.trim() !== "" ? [ text(plain) ] : []
    }
    toolCosts[tool](ev, costs)
    return toolEvents[tool](ev).flatMap((entry) => {
        if (entry.text !== true)
            return [ { ...entry, msg: stripVTControlCharacters(entry.msg) } ]
        const msgs = stripVTControlCharacters(entry.msg).replace(/\n+$/, "").split("\n")
        return [
            ...msgs.map((msg, i) => ({ ...text(msg), ...(i >= TEXT_MAX ? { quiet: true } : {}) })),
            ...(msgs.length > TEXT_MAX ? [ info(`(${msgs.length - TEXT_MAX} further lines of agent message ` +
                "not kept in the processing log of the task)") ] : [])
        ]
    })
}

/*  parse a duration "<number><unit>" with unit s, m, or h into milliseconds  */
const parseDuration = (spec: string): number => {
    const m    = /^(\d+)([smh])$/.exec(spec)
    const unit = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 }
    const ms   = m !== null ? Number.parseInt(m[1], 10) * unit[m[2] as keyof typeof unit] : 0
    if (ms < 1 || ms > 2 ** 31 - 1)
        throw new Error(`agent: invalid duration "${spec}" (expected <number><unit> with unit s, m, or h, up to about 24 days)`)
    return ms
}

/*  whether a skill reported an error in the output lines of the headless agent tool, as the
    skills report their errors as "▶ ERROR: ..." (see "ase-common-task") while the agent tool
    still exits successfully, where an agent message merely quoting "ERROR:" (e.g. of some
    code or log) is no error  */
export const skillErrored = (output: string[]): boolean =>
    output.some((line) => /(?:^|▶ )ERROR:/.test(line.trim()))

/*  the plain tags of the "Tags:" frontmatter key of a task  */
export const tagsOf = (keys: Map<string, string>): string[] =>
    (keys.get("Tags") ?? "").split(",").map((tag) => tag.trim()).filter((tag) => tag !== "")

/*  whether a task carries the tag <key>, plain or with any value  */
export const taggedWith = (keys: Map<string, string>, key: string): boolean =>
    tagsOf(keys).some((tag) => tag === key || tag.startsWith(`${key}:`))

/*  the flattened header keys of a task plan (like those of the listed tasks)  */
export const flatKeys = (header: API.TaskHeader): Map<string, string> =>
    new Map(Object.entries(header).map(([ key, val ]) =>
        [ key, Array.isArray(val) ? val.join(", ") : String(val) ] as [ string, string ]))

/*  set the tag <key> in the "Tags:" frontmatter key of a task plan,
    replacing all its existing occurrences: as a plain tag "<key>" without <value>,
    as a "<key>:<value>" tag with <value>, or not at all (removing it) with a null <value>  */
export const setPlanTag = (plan: API.TaskPlan, key: string, value?: string | null): void => {
    const field = plan.header.Tags ?? []
    const tags  = (Array.isArray(field) ? field : field.split(","))
        .map((t) => t.trim()).filter((t) => t !== "")
    const tag   = value === undefined ? key : `${key}:${value}`
    const match = (t: string) => t === key || t.startsWith(`${key}:`)
    const at    = tags.findIndex(match)
    const next  = tags.flatMap((t, i) => !match(t) ? [ t ] : i === at && value !== null ? [ tag ] : [])
    if (at < 0 && value !== null)
        next.push(tag)
    if (next.length > 0)
        plan.header.Tags = next
    else
        delete plan.header.Tags
}

/*  update a task plan by the operation <op> in a single conditional save (see "Task.update"),
    retrying (with a growing delay, on a freshly loaded plan) on a failure, especially on a
    concurrent change of the task (HTTP 412), so <op> has to (re)compute all its results,
    where <rejected> is called whenever a save was surely not done (on HTTP 412), unlike
    on other failures (e.g. a lost response), where the save might have been done  */
export const updateTask = (log: Log, id: string,
    op: (plan: API.TaskPlan, lifecycle: TaskFormat.TaskLifecycle) => boolean,
    rejected?: () => void): Promise<boolean> =>
    Task.updateRetry(log, id, op, rejected)

/*  the last verdict word following the label <label> in the output lines of a skill
    (e.g. "APPROVE" of "**REVIEW VERDICT**: **APPROVE**"), or empty if none  */
export const verdictOf = (output: string[], label: string): string => {
    const re = new RegExp(`${label}\\W*([A-Z]+)`)
    let verdict = ""
    for (const line of output) {
        const m = re.exec(line)
        if (m !== null)
            verdict = m[1]
    }
    return verdict
}

/*  the permitted types and the built-in defaults of the change set flow keys  */
const flowTypes: Record<string, string[]> = {
    Source:    [ "worktree", "branch" ],
    Changeset: [ "worktree", "branch", "attachment" ],
    Target:    [ "worktree", "branch", "source" ]
}
const flowDefaults: Record<string, string> = {
    Source:    "worktree",
    Changeset: "worktree",
    Target:    "source"
}

/*  the raw value of the change set flow key "Source:", "Changeset:", or "Target:"
    of a task (or else its configured default)  */
export const taskFlowRaw = (log: Log, task: AgentTask, key: "Source" | "Changeset" | "Target"): string => {
    const value = task.keys.get(key) ?? ""
    if (value !== "")
        return value
    const cfg = new Config("config", configSchema, log)
    cfg.read()
    const val = cfg.getExplicit(`project.task.default.${key.toLowerCase()}`)
    return typeof val === "string" ? val : (process.env[`ASE_PROJECT_TASK_DEFAULT_${key.toUpperCase()}`] ?? flowDefaults[key])
}

/*  the value of the change set flow key "Source:", "Changeset:", or "Target:" of a
    task (or else its configured default), parsed and validated like by the skills,
    as the names are passed to Git, and a "Target:" of "source" resolved to "Source:"  */
export const taskFlow = (log: Log, task: AgentTask, key: "Source" | "Changeset" | "Target"): FlowValue => {
    const value = taskFlowRaw(log, task, key)
    const i     = value.indexOf(":")
    const type  = i < 0 ? value : value.slice(0, i)
    const name  = i < 0 ? "" : value.slice(i + 1)
    const named: Record<string, boolean> = {
        branch:     /^(?![-./])[A-Za-z0-9_./-]+(?<![/.])$/.test(name) && !/\.\.|\/\/|\.lock$/.test(name),
        attachment: /^[A-Za-z0-9_-]+$/.test(name)
    }
    if (!flowTypes[key].includes(type) || !(named[type] ?? name === ""))
        throw new Error(`agent: invalid ${key} value "${value}" of task "${task.id}"`)
    return type === "source" ? taskFlow(log, task, "Source") : { type, name }
}

/*  the temporary directory of an agent, and the base directory of "--tempdir"
    if created by the agent (else empty)  */
type TempDir = { dir: string, base: string }

/*  the hash value of "%h" in "--tempdir", unique to the agent process  */
const tempHash = crypto.randomBytes(4).toString("hex")

/*  the files in a temporary directory of an agent recording the process id of the
    owning agent process, and marking work preserved for a manual recovery  */
const tempOwner     = ".owner"
const tempPreserved = ".preserved"

/*  whether a process of this host is alive (where one of another user counts as alive)  */
export const pidAlive = (pid: number): boolean => {
    if (!Number.isInteger(pid) || pid <= 0)
        return false
    try {
        process.kill(pid, 0)
        return true
    }
    catch (err: unknown) {
        return (err as NodeJS.ErrnoException).code === "EPERM"
    }
}

/*  the start time of a process (as rendered by "ps", else empty if unavailable, e.g. on
    Windows), which identifies the process beyond its process id (as the latter is reused)  */
export const pidStart = async (pid: number): Promise<string> => {
    if (!Number.isInteger(pid) || pid <= 0)
        return ""
    const result = await execa("ps", [ "-o", "lstart=", "-p", String(pid) ],
        { reject: false, stdin: "ignore", timeout: 10 * 1000 })
    return result.exitCode === 0 ? result.stdout.trim() : ""
}

/*  create the private temporary directory of an agent: without a "--tempdir" specification
    <spec> securely as a fresh, unique directory below the system temporary directory, else as
    the sub-directory <name> of the "--tempdir" directory, whose "%p" is expanded to the process
    id, "%h" to the hash value, and "%%" to "%", which is created privately if missing, and else
    has to be a non-aliased directory owned by the current user (a leftover sub-directory of an
    earlier run which stopped before its cleanup is replaced, but neither one of a still running
    agent process, e.g. of another "ase agent" with the same agent name and the same fixed
    "--tempdir", nor one holding work preserved for a manual recovery)  */
export const tempDir = async (name: string, spec: string): Promise<TempDir> => {
    if (spec === "")
        return { dir: await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), `ase-agent-${name}-`))), base: "" }
    const base = path.resolve(spec.replace(/%([ph%])/g, (_m, c: string) =>
        c === "p" ? String(process.pid) : c === "h" ? tempHash : "%"))
    const created = await fs.promises.mkdir(base, { recursive: true, mode: 0o700 }) !== undefined
    const st = await fs.promises.lstat(base)
    if (st.isSymbolicLink() || !st.isDirectory() || (process.getuid !== undefined && st.uid !== process.getuid()))
        throw new Error(`agent: temporary directory "${base}" is no directory owned by the current user`)
    const dir   = path.join(await fs.promises.realpath(base), name)
    const inUse = () => new Error(`agent: temporary directory "${dir}" is in use by another running agent process ` +
        "(use a \"--tempdir\" with \"%p\" or \"%h\", or another \"--name\")")
    if (fs.existsSync(dir)) {
        const pid = Number.parseInt(await fs.promises.readFile(path.join(dir, tempOwner), "utf8").catch(() => ""), 10)
        if (pid !== process.pid && pidAlive(pid))
            throw inUse()
        if (fs.existsSync(path.join(dir, tempPreserved)))
            throw new Error(`agent: temporary directory "${dir}" holds work preserved by an earlier run ` +
                `(see "${path.join(dir, tempPreserved)}") -- recover and remove it manually`)
        await fs.promises.rm(dir, { recursive: true, force: true })
    }
    await fs.promises.mkdir(dir, { mode: 0o700 }).catch((err: unknown) => {
        throw (err as NodeJS.ErrnoException).code === "EEXIST" ? inUse() : err
    })
    await fs.promises.writeFile(path.join(dir, tempOwner), `${process.pid}\n`)
    return { dir, base: created ? base : "" }
}

/*  the tails of the in-process mutual exclusions per key  */
const exclusions = new Map<string, Promise<void>>()

/*  run an operation in mutual exclusion to all other operations of the same key in this process  */
export const exclusive = async <T> (key: string, op: () => Promise<T>): Promise<T> => {
    const prev = exclusions.get(key) ?? Promise.resolve()
    let done = () => {}
    const gate = new Promise<void>((resolve) => { done = resolve })
    const tail = prev.then(() => gate)
    exclusions.set(key, tail)
    try {
        await prev
        return await op()
    }
    finally {
        done()
        if (exclusions.get(key) === tail)
            exclusions.delete(key)
    }
}

/*  the fixed maximum duration of the preparing and the finishing of a job,
    and of each Git command run by them, so a hanging one (e.g. a "git push"
    waiting for credentials) is killed instead of left behind  */
const jobTimeout = 240 * 1000

/*  the cancellation of the operation of a job currently run (see "withinJobTimeout"),
    implicitly passed to every command run within it, so a timed out operation
    does not leave its commands running (e.g. into the cleaning up of the job)  */
const jobScope = new AsyncLocalStorage<AbortSignal>()

/*  run a command of the preparing or the finishing of a job (or of the setup of the agent),
    where Git never prompts for credentials (as nobody could answer them anyway), as its
    standard input is ignored (unless fed with <input>), and where the command is killed
    once the operation of the job it runs within timed out  */
type JobOptions = { cwd?: string, reject?: boolean, input?: string }
const execaJobBase = execa({ timeout: jobTimeout, env: { GIT_TERMINAL_PROMPT: "0" } })
export const execaJob = (file: string, args: readonly string[], options: JobOptions = {}) => {
    const { input, ...rest } = options
    return execaJobBase(file, args, {
        cancelSignal: jobScope.getStore(),
        ...(input !== undefined ? { input } : { stdin: "ignore" as const }),
        ...rest
    })
}

/*  run a shell command of the preparing or the finishing of a job in the working directory
    <cwd> with the additional environment variables <env> (like "execaJob"), logging its
    output lines, and throwing on its failure  */
export const shellJob = async (cmd: string, cwd: string, env: Record<string, string>, log: AgentLog): Promise<void> => {
    await log("info", `running: ${cmd}`)
    const result = await execaJobBase(cmd, {
        shell: true, cwd, env, all: true, reject: false, stdin: "ignore", cancelSignal: jobScope.getStore()
    })
    for (const line of stripVTControlCharacters(result.all ?? "").split("\n"))
        if (line.trim() !== "")
            await log("info", line)
    if (result.failed)
        throw new Error(`agent: command "${cmd}" failed: ${result.exitCode !== undefined ?
            `exit code ${result.exitCode}` : result.shortMessage}`)
}

/*  run an operation (e.g. the preparing) of a job within its fixed maximum duration,
    where the commands of the operation are killed on timeout (see "jobScope") and the
    operation itself (which still has to end) is passed on timeout to <late> (if given),
    so the resources it still creates afterwards can be released  */
const withinJobTimeout = async <T> (what: string, op: () => Promise<T>, late?: (pending: Promise<T>) => void): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    const pending    = jobScope.run(controller.signal, op)
    try {
        return await Promise.race([
            pending,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                    controller.abort()
                    late?.(pending)
                    reject(new Error(`agent: ${what} timed out after ${jobTimeout / 1000}s`))
                }, jobTimeout)
            })
        ])
    }
    finally {
        clearTimeout(timer)
    }
}

/*  whether the current working directory is inside a Git working copy  */
const gitInside = async (): Promise<boolean> =>
    (await execaJob("git", [ "rev-parse", "--show-toplevel" ], { reject: false })).exitCode === 0

/*  run Git operations changing the shared state of a Git repository (its references and its
    worktrees) in mutual exclusion per repository in this process, identified by the common Git
    directory of its working copy <root>, so tasks processed concurrently never collide on the
    locks of Git (e.g. "index.lock" or a reference lock), where the operations must not nest  */
export const gitLocked = async <T> (root: string, op: () => Promise<T>): Promise<T> => {
    const { stdout } = await execaJob("git", [ "rev-parse", "--git-common-dir" ], { cwd: root })
    return exclusive(`git:${await fs.promises.realpath(path.resolve(root, stdout.trim()))}`, op)
}

/*  the Git worktree directory of the repository of the working copy <root>
    in which a branch is checked out, or empty if none  */
export const gitWorktree = async (root: string, branch: string): Promise<string> => {
    const { stdout } = await execaJob("git", [ "worktree", "list", "--porcelain" ], { cwd: root })
    let dir = ""
    for (const line of stdout.split("\n")) {
        if (line.startsWith("worktree "))
            dir = line.slice("worktree ".length)
        else if (line === `branch refs/heads/${branch}`)
            return dir
    }
    return ""
}

/*  forcibly remove a Git worktree (if any) of the repository of the working copy <root>
    (without the mutual exclusion of the repository, so it can be used within one)  */
const worktreeRemove = async (root: string, dir: string): Promise<void> => {
    await execaJob("git", [ "worktree", "remove", "--force", dir ], { cwd: root, reject: false })
    await execaJob("git", [ "worktree", "prune" ], { cwd: root, reject: false })
}

/*  forcibly remove a Git worktree (if any) of the repository of the working copy <root>, e.g. a
    temporary one or the leftover of an earlier processing which stopped before its cleanup  */
export const gitWorktreeRemove = async (root: string, dir: string): Promise<void> =>
    gitLocked(root, () => worktreeRemove(root, dir))

/*  create a Git worktree of the repository of the working copy <root> with a branch
    checked out, where a still missing branch is created from the start point <start> (if given)  */
export const gitWorktreeAdd = async (root: string, dir: string, branch: string, start?: string): Promise<void> =>
    gitLocked(root, async () => {
        const exists = (await execaJob("git", [ "rev-parse", "--verify", "--quiet", `refs/heads/${branch}` ],
            { cwd: root, reject: false })).exitCode === 0
        const args   = exists || start === undefined ? [ dir, branch ] : [ "-b", branch, dir, start ]
        await worktreeRemove(root, dir)
        await execaJob("git", [ "worktree", "add", ...args ], { cwd: root })
    })

/*  create a temporary Git worktree of the repository of the working copy <root>,
    detached at the commit <commit> (replacing a leftover one)  */
export const gitWorktreeDetached = async (root: string, dir: string, commit: string): Promise<void> =>
    gitLocked(root, async () => {
        await worktreeRemove(root, dir)
        await execaJob("git", [ "worktree", "add", "--quiet", "--detach", dir, commit ], { cwd: root })
    })

/*  the id of the ASE worktree of a task (also used by the skills via "--worktree"),
    as a task id can carry "#" (e.g. "#12" of the "seq:#%d" id scheme of the issue
    tracker task stores), which an ASE worktree id (and a branch name derived from
    it) cannot, so it is replaced by "_" (e.g. "_12")  */
export const worktreeId = (id: string): string =>
    id.replace(/#/g, "_")

/*  the context worktree holding the uncommitted change set of a "worktree"
    changeset: the ASE worktree named after the task if registered (as created
    by the parallel implementer), else the working copy <root>  */
export const contextDir = async (root: string, task: AgentTask): Promise<string> => {
    const dir = Worktree.dir(worktreeId(task.id), false, false, root)
    const { stdout } = await execaJob("git", [ "worktree", "list", "--porcelain" ], { cwd: root })
    return stdout.split("\n").includes(`worktree ${dir}`) ? dir : root
}

/*  the ASE worktree id of a working copy, as selected by the "--worktree" option of the
    skills as their context worktree: empty for the working copy <root>, else the id of
    its ASE worktree  */
export const worktreeName = (root: string, dir: string): string => {
    if (dir === root)
        return ""
    else if (path.dirname(dir) === Worktree.baseDir(false, false, root))
        return path.basename(dir)
    throw new Error(`agent: working copy "${dir}" is neither "${root}" nor an ASE worktree of it`)
}

/*  whether the Git working copy <dir> carries no uncommitted changes (except the ASE state)  */
export const gitClean = async (dir: string): Promise<boolean> => {
    const { stdout } = await execaJob("git", [ "status", "--porcelain", "--", ".", ":(exclude).ase" ], { cwd: dir })
    return stdout.trim() === ""
}

/*  the holders ("<agent>:<task>") of the Git working copies and branches used exclusively during
    the processing of a task by any agent of this process (see "Agent.holdRoot" and "Agent.holdBranch")  */
const rootHolders = new Map<string, string>()

/*  the agents of this process currently processing tasks, and the wake-ups of the
    dispatchers of all running agents of this process, so in one-shot mode an agent
    terminates only once all agents of this process are idle (as a task processed by
    one agent can become dispatchable to another one, e.g. an implemented task to the approver)  */
const busyAgents = new Set<Agent>()
const wakeAgents = new Set<() => void>()

/*  the duration after which the run lock of a terminated agent process counts as stale  */
const runStale = 30 * 1000

/*  the identity of the per-user state directory on this host, which holds the run locks,
    so only the runs of the same user (and home directory) on the same host are recovered  */
export const runOwner = crypto.createHash("sha1")
    .update(`${os.hostname()}\n${userStateDir()}`).digest("hex").slice(0, 12)

/*  a claim of a task recorded for a run: the name and the tag of the
    claiming agent, and the previous assignee of the task  */
export type RunClaim = { name: string, tag: string, assignee: string }

/*  the run of an agent process of a kind, guarded by a run lock in the per-user state
    directory (hence per host and user), below a sub-directory per task store (as the
    recorded task ids are unique per task store only, so no run of another project is
    ever recovered against the wrong tasks), and recording the process id and the claims
    of the tasks processed by it, so the agents of the same kind started later for the
    same task store can recover the tasks left behind by the terminated runs (whose run
    lock is gone or stale, and whose process is no longer alive, where the recorded start
    time of the process guards against a process id reused meanwhile by another process)  */
export class AgentRun {
    readonly id = crypto.randomUUID()
    private unlock: (() => Promise<void>) | null = null
    private claims = new Map<string, RunClaim>()
    private seized = new Map<string, () => Promise<void>>()
    private start  = ""
    private _dir   = ""

    constructor (private log: Log, private kind: string) {}

    /*  the directory of the runs of the agent kind for the task store, and the files of a run  */
    private get dir (): string {
        if (this._dir === "")
            this._dir = path.join(userStateDir(), `agent-${this.kind}`,
                crypto.createHash("sha1").update(Task.storeKey(this.log)).digest("hex").slice(0, 12))
        return this._dir
    }
    private file (run: string, ext = ""): string {
        return path.join(this.dir, `${run}${ext}`)
    }

    /*  the record (process id, its start time, and claims) of a run  */
    private record (run: string): { pid: number, start: string, claims: Record<string, RunClaim> } {
        try {
            const data = JSON.parse(fs.readFileSync(this.file(run, ".json"), "utf8"))
            return { pid: Number(data.pid ?? 0), start: String(data.start ?? ""), claims: data.claims ?? {} }
        }
        catch (_err) {
            return { pid: 0, start: "", claims: {} }
        }
    }

    /*  save the record of a run (atomically)  */
    private store (run: string, record: { pid: number, start: string, claims: Record<string, RunClaim> }): void {
        const file = this.file(run, ".json")
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(record))
        fs.renameSync(`${file}.tmp`, file)
    }
    private save (): void {
        this.store(this.id, { pid: process.pid, start: this.start, claims: Object.fromEntries(this.claims) })
    }

    /*  acquire the run lock (refreshed periodically, where a compromised one, e.g. one
        removed as stale while this process was suspended, is reported instead of thrown)  */
    async acquire (): Promise<void> {
        fs.mkdirSync(this.dir, { recursive: true })
        this.start  = await pidStart(process.pid)
        this.unlock = await lockfile.lock(this.file(this.id), {
            realpath: false, stale: runStale, update: runStale / 3,
            onCompromised: (err: Error) => {
                this.log.write("warning", `agent: run lock of ${this.kind} compromised: ${err.message}`)
            }
        })
        this.save()
    }

    /*  release the run lock (and the run locks of the terminated runs still seized), and remove
        the record of this run, unless it still records claims (to be recovered by a later run)  */
    async release (): Promise<void> {
        for (const run of [ ...this.seized.keys() ])
            await this.free(run)
        if (this.unlock === null)
            return
        await this.unlock().catch(() => {})
        this.unlock = null
        if (this.claims.size === 0)
            fs.rmSync(this.file(this.id, ".json"), { force: true })
    }

    /*  whether a run is alive: this run, a run whose process (by its given or recorded
        process id, and, if recorded, by the start time of the process, so a reused process
        id does not count) is still alive, or one whose run lock is still held  */
    async alive (run: string, pid = 0): Promise<boolean> {
        if (run === "")
            return false
        else if (run === this.id)
            return true
        const record = this.record(run)
        const id     = pid > 0 ? pid : record.pid
        const start  = id === record.pid ? record.start : ""
        if (pidAlive(id) && (start === "" || await pidStart(id) === start))
            return true
        return lockfile.check(this.file(run), { realpath: false, stale: runStale }).catch(() => false)
    }

    /*  the runs of the agent kind for the task store (by their run lock or record)  */
    private runs (): string[] {
        return [ ...new Set(fs.readdirSync(this.dir)
            .filter((entry) => /\.(?:lock|json)$/.test(entry))
            .map((entry) => entry.replace(/\.(?:lock|json)$/, ""))) ]
    }

    /*  the terminated runs of the agent kind for the task store, with their recorded claims  */
    async dead (): Promise<{ run: string, claims: Record<string, RunClaim> }[]> {
        const dead: { run: string, claims: Record<string, RunClaim> }[] = []
        for (const run of this.runs())
            if (!(await this.alive(run)))
                dead.push({ run, claims: this.record(run).claims })
        return dead
    }

    /*  seize a terminated run for its recovery, by taking over its (stale or removed) run lock,
        so the agents started concurrently never recover the same run, returning its claims
        recorded at that time (as a concurrent recovery might have reduced them meanwhile),
        or null if the run is seized by another agent (or is alive again)  */
    async seize (run: string): Promise<Record<string, RunClaim> | null> {
        if (this.seized.has(run))
            return this.record(run).claims
        try {
            const unlock = await lockfile.lock(this.file(run), {
                realpath: false, stale: runStale, update: runStale / 3, onCompromised: () => {}
            })
            this.seized.set(run, unlock)
        }
        catch (_err) {
            return null
        }
        return this.record(run).claims
    }

    /*  release the run lock of a seized terminated run, without removing its record  */
    async free (run: string): Promise<void> {
        const unlock = this.seized.get(run)
        if (unlock === undefined)
            return
        this.seized.delete(run)
        await unlock().catch(() => {})
    }

    /*  forget a recovered claim of a seized terminated run (so it is never recovered again,
        even if the recovery of another claim of the run fails and is retried by a later run)  */
    forget (run: string, id: string): void {
        const record = this.record(run)
        if (record.pid === 0 || !Object.hasOwn(record.claims, id))
            return
        record.claims = Object.fromEntries(Object.entries(record.claims).filter(([ key ]) => key !== id))
        this.store(run, record)
    }

    /*  whether a task is claimed by this run or by another run whose process is still
        alive (independent of its run lock, which is also held while a terminated run is
        seized for its recovery), i.e., by an agent still processing it  */
    async claimed (id: string): Promise<boolean> {
        if (this.claims.has(id))
            return true
        for (const run of this.runs()) {
            const record = this.record(run)
            if (run !== this.id && Object.hasOwn(record.claims, id) && pidAlive(record.pid)
                && (record.start === "" || await pidStart(record.pid) === record.start))
                return true
        }
        return false
    }

    /*  remove the record and the run lock of a (seized) terminated run  */
    async purge (run: string): Promise<void> {
        fs.rmSync(this.file(run, ".json"), { force: true })
        if (this.seized.has(run))
            await this.free(run)
        else
            fs.rmSync(this.file(run, ".lock"), { recursive: true, force: true })
    }

    /*  record resp. forget the claim of a task by this run  */
    claim (id: string, claim: RunClaim): void {
        this.claims.set(id, claim)
        this.save()
    }
    unclaim (id: string): void {
        if (this.claims.delete(id))
            this.save()
    }
}

/*  the state of a running agent: its worker slots (slot number to task id), their jobs,
    its abort, its waiting tasks (with the reason), its noticed tasks (with the notice),
    whether it is dispatching, and the wake-up of its dispatcher  */
type RunState = {
    slots:       Map<number, string>
    running:     Set<Promise<void>>
    abort:       AbortController
    waiting:     Map<string, string>
    notices:     Map<string, string>
    dispatching: boolean
    notify:      () => void
}

/*  the generic agent: it observes the tasks, selects the dispatchable ones (see
    "select"), claims each one (see "claim") into a free worker slot, processes it
    via an ASE skill of the headless agent tool (see "prepare"), and finally settles
    it (see "settle"), where the concrete agent decides on all of these steps  */
export abstract class Agent {
    constructor (protected log: Log) {}

    /*  the kind of the agent ("ase agent <kind>") and its CLI description  */
    abstract readonly kind:                  string
    protected abstract readonly description: string

    /*  the name of the agent ("--name", default: its kind), distinguishing
        multiple agents of the same kind in the log lines, the processing log
        attachments, and the temporary directories  */
    private _name = ""
    get name (): string {
        return this._name !== "" ? this._name : this.kind
    }

    /*  the name of the processing log attachment "agent:<name>" of the tasks (default: its name),
        the role of the agent in the recovery descriptions (default: its kind), and the namespace
        of its runs (default: its kind, see "AgentRun"), which a configured agent can override  */
    protected get logName (): string {
        return this.name
    }
    protected get role (): string {
        return this.kind
    }
    protected get runKind (): string {
        return this.kind
    }

    /*  the name of the requests processed by the agent, as announced in its presence (default: none)  */
    protected presenceRequest = ""

    /*  whether tasks are processed serially only (clamping "--parallel" to 1, and
        refusing multiple agents of the kind in a fleet, see "ase agent fleet")  */
    protected readonly serial: boolean = false
    get serialOnly (): boolean {
        return this.serial
    }

    /*  whether tasks are processed in Git worktrees (requiring "git" in $PATH)  */
    protected readonly worktree: boolean = false

    /*  the task lifecycle models the agent supports  */
    protected readonly lifecycles: string[] = [ "enterprise" ]

    /*  the mode of operation of the agent (e.g. by its option "--mode", else empty)  */
    protected mode = ""

    /*  the per-agent CLI command and the effective configuration of the agent  */
    private cmd:         Command | null                  = null
    private tool:        Tool                            = "claude"
    private parallel                                     = 1
    private timeoutSpec                                  = ""
    private timeout                                      = 0
    private oneShot                                      = false
    protected lifecycle: TaskFormat.TaskLifecycle | null = null

    /*  the URL of the Git repository of "--repo", the directory of its
        temporary clone, and the default branch of this clone  */
    private repo                                         = ""
    private clone                                        = ""
    private head                                         = ""

    /*  the "--tempdir" specification, the temporary directory of the agent,
        and whether it holds work preserved for a manual recovery  */
    private tempdir                                      = ""
    private temp:        TempDir | null                  = null
    private preserved                                    = false

    /*  the working directories in the temporary clone of "--repo" kept
        for a manual recovery of the work preserved in them (see "preserve")  */
    private keptdirs                                     = new Set<string>()

    /*  the client of the agent relay (if any) and the presence of the running agent announced to it  */
    private relay:       AgentRelayClient | null         = null
    private presence:    AgentPresenceReporter | null    = null

    /*  per processed task id: the remainders of its AI request time and its real time (in
        milliseconds) not yet booked onto it, as the bookings carry whole minutes only  */
    private unbooked                                     = new Map<string, { aiMs: number, realMs: number }>()

    /*  per processed task id: its working directory in the temporary clone
        of "--repo" (see "workdir"), the Git working copy and branches held exclusively
        for it (see "holdRoot" and "holdBranch"), and the reason it was last deferred for  */
    private workdirs                                     = new Map<string, string>()
    private holds                                        = new Map<string, Set<string>>()
    private deferred                                     = new Map<string, string>()

    /*  the run of the agent process (see "AgentRun")  */
    private _run:        AgentRun | null                 = null
    protected get runLock (): AgentRun {
        if (this._run === null)
            this._run = new AgentRun(this.log, this.runKind)
        return this._run
    }

    /*  register additional CLI options and initialize the agent from them,
        and release the resources of the initialization after the run of the agent  */
    protected options (_cmd: Command): void {}
    protected async init (_opts: AgentOpts): Promise<void> {}
    protected async teardown (): Promise<void> {}

    /*  recover the tasks left behind by terminated runs of agents of its kind (see
        "AgentRun"), at the start of the run, and decide whether the run lock has to be
        retained after the run (until the exit of the process, e.g. while still
        processing results are not finalized, so no other agent recovers them meanwhile)  */
    protected async recover (): Promise<void> {}
    protected retainRun (): boolean {
        return this.unsettled.size > 0
    }

    /*  the finalizations of processed tasks which failed even after their retries (e.g. on
        repeated concurrent changes of the task, or on a transient failure of the task store),
        per task id, retried in the background with a growing delay (and a last time at the
        end of the run), so no task stays claimed by a live agent until another agent recovers
        it, where a finalization resolves to whether it is done (and throws on a failure)  */
    protected readonly unsettled = new Map<string, () => Promise<boolean>>()
    private unsettledRetry: Promise<void> | null              = null
    private unsettledTimer: ReturnType<typeof setTimeout> | undefined
    private unsettledRound                                    = 0

    /*  remember a failed finalization of a task for its retrying  */
    protected unsettle (id: string, finish: () => Promise<boolean>): void {
        this.unsettled.set(id, finish)
        this.scheduleUnsettled()
    }

    /*  schedule the next retry round of the failed finalizations (if any)  */
    private scheduleUnsettled (): void {
        if (this.unsettledTimer !== undefined || this.unsettled.size === 0)
            return
        this.unsettledRound++
        this.unsettledTimer = setTimeout(() => {
            this.retryUnsettled().finally(() => {
                this.unsettledTimer = undefined
                this.scheduleUnsettled()
            })
        }, Math.min(this.unsettledRound, 30) * 1000)
        this.unsettledTimer.unref()
    }

    /*  retry all failed finalizations once (never concurrently to itself)  */
    private async retryUnsettled (): Promise<void> {
        if (this.unsettledRetry !== null)
            return this.unsettledRetry
        this.unsettledRetry = (async () => {
            for (const [ id, finish ] of [ ...this.unsettled ])
                if (await finish().catch(() => false))
                    this.unsettled.delete(id)
            if (this.unsettled.size === 0)
                this.unsettledRound = 0
        })().finally(() => {
            this.unsettledRetry = null
        })
        return this.unsettledRetry
    }

    /*  prepare the skill invocation for a claimed task, logging into its processing
        log <log> (throws on failure)  */
    protected abstract prepare (task: AgentTask, parallel: boolean, log: AgentLog): Promise<AgentJob>

    /*  whether a dispatchable task (e.g. one without a result of a previous
        processing) is to be claimed, checked right before its claim  */
    protected async ready (_task: AgentTask): Promise<boolean> {
        return true
    }

    /*  the wake-up of the dispatcher of the running agent (if running), and its delayed
        triggering, e.g. once a task held off by the agent becomes dispatchable again  */
    private wakeup: (() => void) | null = null
    protected redispatch (delay: number): void {
        const timer = setTimeout(() => {
            this.wakeup?.()
        }, delay)
        timer.unref()
    }

    /*  whether tasks are processed in parallel to others by multiple worker slots of the agent  */
    protected get parallelized (): boolean {
        return this.parallel > 1
    }

    /*  defer a dispatchable task (instead of claiming it, see "ready"), reporting
        the reason once per change of it, until the next dispatching  */
    protected async defer (task: AgentTask, reason: string): Promise<boolean> {
        if (this.deferred.get(task.id) !== reason) {
            this.deferred.set(task.id, reason)
            await this.write("info", this.name, `task "${task.id}" waits for ${reason}`)
        }
        return false
    }

    /*  hold the Git working copy <root> the agent is started in exclusively for the processing
        of a task (from right before its claim, see "ready", until it is settled), if it is used
        directly (instead of an ASE worktree of it), i.e., if a skill changes it (e.g. implements
        into it, stages in it, or integrates from or into it), so no agent of this process using
        it directly processes another task meanwhile, which would mix up the uncommitted change
        sets of the tasks (the agents of other processes, and humans, are not coordinated, so
        a working copy should be used directly by a single agent process only);
        returns false if it is already held for another task  */
    protected holdRoot (task: AgentTask, root: string): boolean {
        return this.hold(task, root)
    }

    /*  hold the Git branch <branch> of the Git working copy <root> the agent is started in
        (or, if empty, of the temporary clone of "--repo") exclusively for the processing of a
        task (like "holdRoot"), if the task is processed in the worktree the branch is checked
        out in (e.g. into a "branch:" changeset), so no agent of this process processes another
        task in the same worktree meanwhile, which would mix up the change sets of the tasks
        (e.g. into the commit onto the branch) and remove the worktree under the other task;
        returns false if it is already held for another task  */
    protected holdBranch (task: AgentTask, root: string, branch: string): boolean {
        return this.hold(task, `${root !== "" ? root : this.repo}#${branch}`)
    }

    /*  hold a resource (by its key) exclusively for the processing of a task  */
    private hold (task: AgentTask, key: string): boolean {
        const holder = `${this.name}:${task.id}`
        const held   = rootHolders.get(key)
        if (held !== undefined && held !== holder)
            return false
        rootHolders.set(key, holder)
        const keys = this.holds.get(task.id) ?? new Set<string>()
        keys.add(key)
        this.holds.set(task.id, keys)
        return true
    }

    /*  release the Git working copy and branches held for a task (if any)  */
    protected unhold (id: string): void {
        const keys = this.holds.get(id)
        if (keys === undefined)
            return
        this.holds.delete(id)
        for (const key of keys)
            if (rootHolders.get(key) === `${this.name}:${id}`)
                rootHolders.delete(key)
    }

    /*  release all resources of the processing of a task: its held Git working
        copy and branches and its working directory in the temporary clone  */
    private async unbind (id: string): Promise<void> {
        this.unhold(id)
        const dir = this.workdirs.get(id)
        if (dir !== undefined) {
            this.workdirs.delete(id)
            await gitWorktreeRemove(this.clone, dir).catch(() => {})
        }
    }

    /*  the Git working copy the agent is started in, if a task with the change set
        flow values <values> is processed in it (see "workdir"), else empty  */
    protected localRoot (values: FlowValue[]): string {
        return this.clone === "" || values.some((value) => value.type === "worktree") ? Task.projectRoot() : ""
    }

    /*  whether the working copy <root> belongs to the temporary clone of "--repo"  */
    private cloned (root: string): boolean {
        return this.clone !== "" && (root === this.clone || [ ...this.workdirs.values() ].includes(root))
    }

    /*  the Git working copy in which a task with the change set flow values <values>
        is processed: for any "worktree" value (or without "--repo") the one the agent
        is started in, else a temporary worktree of the clone of "--repo" of its own,
        detached at the default branch, after refreshing the default branch and the
        branches of the values from the origin, where the Git operations on the clone
        are mutually exclusive and its own working directory is never changed or used
        by a skill (so concurrently processed tasks do not interfere)  */
    protected async workdir (task: AgentTask, values: FlowValue[]): Promise<string> {
        if (this.localRoot(values) !== "") {
            if (!(await gitInside()))
                throw new Error("agent: task requires the Git working copy the agent is started in, but there is none")
            return Task.projectRoot()
        }
        const cwd = this.clone
        const dir = path.join(this.temp!.dir, "work", task.id)
        if (this.keptdirs.has(dir))
            throw new Error(`agent: working directory "${dir}" holds work of an earlier processing of the task, ` +
                "preserved for a manual recovery")
        this.workdirs.set(task.id, dir)
        await gitLocked(cwd, async () => {
            await execaJob("git", [ "fetch", "--quiet", "--prune", "origin" ], { cwd })
            for (const branch of [ this.head, ...values.filter((value) => value.type === "branch").map((value) => value.name) ]) {
                /*  a branch checked out in a worktree (e.g. by the processing of another
                    task) cannot be moved by Git and is hence left as it is  */
                if ((await execaJob("git", [ "rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}` ],
                    { cwd, reject: false })).exitCode === 0 && (await gitWorktree(cwd, branch)) === "")
                    await execaJob("git", [ "branch", "--quiet", "--force", branch, `origin/${branch}` ], { cwd })
            }
            await worktreeRemove(cwd, dir)
            await execaJob("git", [ "worktree", "add", "--quiet", "--detach", dir, this.head ], { cwd })
        })
        return dir
    }

    /*  publish a branch of the working copy <root> to the origin of "--repo",
        if <root> belongs to its temporary clone (a rejected push fails the task)  */
    protected async publish (root: string, branch: string, log: AgentLog): Promise<void> {
        if (!this.cloned(root))
            return
        await gitLocked(root, () =>
            execaJob("git", [ "push", "--quiet", "origin", `refs/heads/${branch}:refs/heads/${branch}` ], { cwd: root }))
        await log("info", `branch "${branch}" pushed to "${this.repo}"`)
    }

    /*  delete a branch from the origin of "--repo", if <root> belongs to its temporary
        clone and the branch was already deleted in it (e.g. after a merge)  */
    protected async unpublish (root: string, branch: string, log: AgentLog): Promise<void> {
        if (!this.cloned(root) || (await execaJob("git", [ "rev-parse", "--verify", "--quiet", `refs/heads/${branch}` ],
            { cwd: root, reject: false })).exitCode === 0)
            return
        await gitLocked(root, () =>
            execaJob("git", [ "push", "--quiet", "origin", "--delete", branch ], { cwd: root }))
        await log("info", `branch "${branch}" deleted from "${this.repo}"`)
    }

    /*  rescue a branch of the working copy <root> which could not be published to the origin
        of "--repo" (e.g. carrying a merge already recorded as integrated): keep its state as
        the branch "ase-agent-rescue/<task-id>" in the temporary clone and preserve the clone
        (instead of removing it after the run) for a manual recovery, where the rescuing runs
        outside of the operation of the job (see "jobScope"), as the operation (e.g. a hanging
        "git push" of the finishing) might have timed out, which cancels all its commands  */
    protected async rescue (root: string, branch: string, task: AgentTask, log: AgentLog): Promise<void> {
        if (!this.cloned(root))
            return
        await jobScope.exit(async () => {
            const rescue = `ase-agent-rescue/${task.id}`
            await gitLocked(root, () =>
                execaJob("git", [ "branch", "--force", rescue, `refs/heads/${branch}` ], { cwd: root }))
            await this.markPreserved(`task "${task.id}": branch "${branch}" not published to "${this.repo}" -- kept as branch "${rescue}"`)
            await log("error", `branch "${branch}" NOT published to "${this.repo}" -- kept as branch "${rescue}" ` +
                `in the temporary clone "${this.clone}", which is preserved for a manual recovery`)
        })
    }

    /*  preserve the uncommitted work <what> of a task, left in its working directory <root>
        (e.g. in a worktree nested inside it), if <root> belongs to the temporary clone of
        "--repo": keep its working directory (instead of removing it after the processing,
        and refuse its reuse by a later processing of the task in this run) and preserve the
        clone for a manual recovery; returns false if <root> does not belong to the clone  */
    protected async preserve (root: string, task: AgentTask, what: string, log: AgentLog): Promise<boolean> {
        if (!this.cloned(root))
            return false
        if (this.workdirs.get(task.id) === root) {
            this.workdirs.delete(task.id)
            this.keptdirs.add(root)
        }
        await this.markPreserved(`task "${task.id}": ${what} kept in "${root}"`)
        await log("error", `${what} kept in "${root}" of the temporary clone "${this.clone}", ` +
            "which is preserved for a manual recovery")
        return true
    }

    /*  mark the temporary directory as holding work preserved for a manual recovery  */
    private async markPreserved (note: string): Promise<void> {
        this.preserved = true
        await fs.promises.writeFile(path.join(this.temp!.dir, tempPreserved), `${note}\n`, { flag: "a" })
    }

    /*  whether a task is ready for the access of the working directory kind <workdir>
        ("project", "source", "changeset", "changeset-read", or "target"), see "workdirJob"  */
    protected async workdirReady (task: AgentTask, workdir: string): Promise<boolean> {
        if (workdir === "changeset")
            return this.changesetReady(task)
        else if (workdir === "changeset-read")
            return this.changesetReadReady(task)
        else if (workdir === "target")
            return this.targetReady(task)
        return true
    }

    /*  the work of a job in the working directory kind <workdir>: the project root
        ("project"), or the working copy of "sourceJob" (with the "branch:" source checked out
        on request), "changesetJob" (with the work committed on request), "changesetReadJob",
        or "targetJob", where the agent-owned worktrees are named with the suffix <suffix>  */
    protected async workdirJob (task: AgentTask, workdir: string, suffix: string, parallel: boolean,
        options: { checkout: boolean, commit: boolean }): Promise<AgentWork> {
        if (workdir === "source")
            return this.sourceJob(task, suffix, options.checkout)
        else if (workdir === "changeset")
            return this.changesetJob(task, suffix, parallel, options.commit)
        else if (workdir === "changeset-read")
            return this.changesetReadJob(task, suffix)
        else if (workdir === "target")
            return this.targetJob(task, suffix)
        return { cwd: Task.projectRoot(), dirs: [], sourceDir: "", changesetWorktree: "" }
    }

    /*  the work of a job in the working copy holding the "Source:" of a task (see "workdir"),
        where a "branch:" source is additionally checked out on request (<checkout>) in a
        temporary, detached Git worktree "<id>-<suffix>" (granted to the agent tool), which is
        removed afterwards  */
    protected async sourceJob (task: AgentTask, suffix: string, checkout: boolean): Promise<AgentWork> {
        const source = taskFlow(this.log, task, "Source")
        const root   = await this.workdir(task, [ source ])
        if (source.type !== "branch" || !checkout)
            return { cwd: root, dirs: [], sourceDir: "", changesetWorktree: "" }
        const dir = Worktree.dir(`${worktreeId(task.id)}-${suffix}`, true, true, root)
        await gitWorktreeDetached(root, dir, source.name)
        return {
            cwd:  root,
            dirs: [ dir ],
            sourceDir: dir,
            changesetWorktree: "",
            cleanup: async (log: AgentLog) => {
                await gitWorktreeRemove(root, dir)
                await log("info", `temporary worktree of source branch "${source.name}" removed`)
            }
        }
    }

    /*  whether a task is ready for the write access to its "Changeset:" (see "changesetJob"):
        a task with a "branch:" changeset is processed only while its changeset branch is held for
        it alone (see "holdBranch"), as two tasks with the same changeset branch would otherwise
        be processed in the same worktree at once (mixing their change sets into the commit,
        and removing the worktree under each other), and a task is processed directly in the
        working copy the agent is started in (a serially processed "worktree" changeset, or a
        "branch:" changeset checked out in it) only while the working copy is held for it alone
        (see "holdRoot") and while it carries no uncommitted changes (except the ASE state), as
        otherwise the uncommitted change set of an earlier task (e.g. one still to be reviewed and
        integrated) or the uncommitted work of a human would mix into the one of this task (and,
        for a "branch:" changeset, even be committed onto its branch), so the task is deferred
        (and not claimed) until then (re-checked on the next change of the tasks, e.g. once the
        earlier task was integrated)  */
    protected async changesetReady (task: AgentTask): Promise<boolean> {
        let source:    FlowValue
        let changeset: FlowValue
        try {
            source    = taskFlow(this.log, task, "Source")
            changeset = taskFlow(this.log, task, "Changeset")
        }
        catch (_err) {
            /*  an invalid value fails the processing of the task  */
            return true
        }
        const root = this.localRoot([ source, changeset ])
        if (changeset.type === "branch" && !this.holdBranch(task, root, changeset.name))
            return this.defer(task, `the changeset branch "${changeset.name}" used by another task`)
        else if (root === "")
            return true
        else if ((changeset.type === "worktree" && !this.parallelized)
            || (changeset.type === "branch" && (await gitWorktree(root, changeset.name).catch(() => "")) === root)) {
            if (!this.holdRoot(task, root))
                return this.defer(task, "the working copy used by another task")
            else if (!(await gitClean(root).catch(() => true))) {
                this.unhold(task.id)
                return this.defer(task, "the working copy without uncommitted changes (e.g. of an earlier task)")
            }
        }
        return true
    }

    /*  the work of a job with write access to the "Changeset:" of a task, processed from its
        "Source:" (see "changesetReady"): a "worktree" changeset in the working copy itself
        (switched to a "branch:" source, if processed serially, else in the ASE worktree of the
        task, created by the skill itself), a "branch:" changeset in the worktree in which it is
        checked out, else in an agent worktree "<id>-<suffix>" (with the branch created from the
        source if missing), and an "attachment:" changeset left to the skill, where the work on a
        "branch:" changeset is committed onto it on request (<commit>) and published  */
    protected async changesetJob (task: AgentTask, suffix: string, parallel: boolean, commit: boolean): Promise<AgentWork> {
        const source    = taskFlow(this.log, task, "Source")
        const changeset = taskFlow(this.log, task, "Changeset")
        const cwd       = await this.workdir(task, [ source, changeset ])
        if (changeset.type === "branch") {
            /*  check out the changeset branch (created from the source if missing) in a
                worktree of the agent, unless it is already checked out in the working copy
                or an ASE worktree (which then has to be without uncommitted changes, as
                they would be committed onto the branch, too), process the task inside it
                in place, and afterwards commit the result onto the branch (also a partial
                one, as the plan tracks it) and publish it to the origin of a temporarily
                cloned repository, where the worktree of the agent is removed only if clean
                and a branch which could not be published is rescued (as the commit would
                otherwise be lost with the clone, see "settle"), so the change set is not lost  */
            let dir   = await gitWorktree(cwd, changeset.name)
            const own = dir === ""
            if (own) {
                dir = Worktree.dir(`${worktreeId(task.id)}-${suffix}`, true, false, cwd)
                await gitWorktreeAdd(cwd, dir, changeset.name, source.type === "branch" ? source.name : "HEAD")
            }
            else if (!(await gitClean(dir)))
                throw new Error(`agent: working copy "${dir}" with branch "${changeset.name}" checked out has ` +
                    "uncommitted changes (e.g. the change set of an earlier task) -- cannot implement task into it")
            return {
                cwd,
                dirs: [],
                sourceDir: "",
                changesetWorktree: worktreeName(cwd, dir),
                ...(commit ? {
                    finish: async (log: AgentLog) => {
                        /*  the ASE state (e.g. the local task store) is never committed  */
                        await execaJob("git", [ "add", "--all", "--", ".", ":(exclude).ase" ], { cwd: dir })
                        if ((await execaJob("git", [ "diff", "--cached", "--quiet" ], { cwd: dir, reject: false })).exitCode !== 0) {
                            const message = `${task.keys.get("Kind") || "CRAFTING"}: ${task.title} (${task.id})`
                            await execaJob("git", [ "commit", "--quiet", "-m", message ], { cwd: dir })
                            await log("info", `change set committed onto branch "${changeset.name}"`)
                        }
                        else
                            await log("warning", `no change set to commit onto branch "${changeset.name}"`)
                        await this.publish(cwd, changeset.name, log).catch(async (err: unknown) => {
                            await this.rescue(cwd, changeset.name, task, log).catch((err2: unknown) =>
                                log("error", `rescuing branch "${changeset.name}" failed: ` +
                                    (err2 instanceof Error ? err2.message : String(err2))))
                            throw err
                        })
                    }
                } : {}),
                cleanup: async (log: AgentLog) => {
                    /*  a worktree nested inside the working directory of the task in the
                        temporary clone of "--repo" is kept only by preserving the clone  */
                    if (own && await gitClean(dir).catch(() => false))
                        await gitWorktreeRemove(cwd, dir)
                    else if (own && !(await this.preserve(cwd, task, `worktree "${dir}" with uncommitted change set`, log)))
                        await log("warning", `worktree "${dir}" with uncommitted change set kept for a manual recovery`)
                }
            }
        }
        else if (changeset.type === "worktree" && !parallel) {
            /*  process into the working copy (held for this task, see "changesetReady") only
                if it still carries no uncommitted changes (except the ASE state), and switch
                the working copy to the source branch  */
            if (!(await gitClean(cwd)))
                throw new Error("agent: working copy has uncommitted changes (e.g. the change set of an earlier task) " +
                    "-- cannot implement task into it")
            if (source.type === "branch") {
                const { stdout: branch } = await execaJob("git", [ "branch", "--show-current" ], { cwd })
                if (branch.trim() !== source.name)
                    await execaJob("git", [ "switch", "--quiet", source.name ], { cwd })
            }
        }
        return { cwd, dirs: [], sourceDir: "", changesetWorktree: changeset.type === "worktree" && parallel ? worktreeId(task.id) : "" }
    }

    /*  whether a task is ready for the review access to its "Changeset:" (see
        "changesetReadJob"): a task whose uncommitted "worktree" change set is located
        directly in the working copy the agent is started in (and not in an ASE worktree
        of it) is processed (and hence staged) only while the working copy is held for it
        alone (see "holdRoot"), else it is deferred  */
    protected async changesetReadReady (task: AgentTask): Promise<boolean> {
        let changeset: FlowValue
        try {
            changeset = taskFlow(this.log, task, "Changeset")
        }
        catch (_err) {
            /*  an invalid value fails the processing of the task  */
            return true
        }
        const root = this.localRoot([ changeset ])
        if (changeset.type === "worktree" && root !== ""
            && (await contextDir(root, task).catch(() => "")) === root && !this.holdRoot(task, root))
            return this.defer(task, "the working copy used by another task")
        return true
    }

    /*  the work of a job with review access to the "Changeset:" of a task (see
        "changesetReadReady"): a "worktree" changeset staged in its context worktree, a
        "branch:" changeset left in place (to be addressed by its name), and an "attachment:"
        changeset applied staged in a temporary worktree "<id>-<name>-<suffix>", detached at
        the commit it is based on, which is removed afterwards  */
    protected async changesetReadJob (task: AgentTask, suffix: string): Promise<AgentWork> {
        const changeset = taskFlow(this.log, task, "Changeset")
        const root      = await this.workdir(task, [ changeset ])
        if (changeset.type === "branch")
            return { cwd: root, dirs: [], sourceDir: "", changesetWorktree: "" }
        else if (changeset.type === "attachment") {
            /*  materialize the change set attachment in a temporary worktree,
                detached at the commit it is based on, staged for the review  */
            const kind = new RegExp(`^text/x-diff\\s*;.*\\bkind\\s*=\\s*"?${changeset.name}"?\\s*(?:;|$)`, "i")
            const attachment = (await Task.attachments(this.log, task.id)).filter((att) => kind.test(att.type)).pop()
            if (attachment?.data === undefined)
                throw new Error(`agent: no change set attachment "${changeset.name}" exists`)
            const base = /\bbase\s+([0-9a-f]+)\b/.exec(attachment.desc)?.[1] ?? "HEAD"
            const dir  = Worktree.dir(`${worktreeId(task.id)}-${changeset.name}-${suffix}`, true, true, root)
            await gitWorktreeDetached(root, dir, base)
            try {
                await execaJob("git", [ "apply", "--index" ], { cwd: dir, input: attachment.data })
            }
            catch (err: unknown) {
                await gitWorktreeRemove(root, dir)
                throw err
            }
            return { cwd: dir, dirs: [], sourceDir: "", changesetWorktree: "", cleanup: () => gitWorktreeRemove(root, dir) }
        }
        else {
            /*  stage the uncommitted change set in its context worktree  */
            const cwd = await contextDir(root, task)
            await execaJob("git", [ "add", "--all", "--", ".", ":(exclude).ase" ], { cwd })
            return { cwd, dirs: [], sourceDir: "", changesetWorktree: "" }
        }
    }

    /*  whether a task is ready for the integration access to its "Changeset:" and
        "Target:" (see "targetJob"): a task integrated from or into the working copy the
        agent is started in directly (an uncommitted "worktree" change set located in it, a
        "branch:" changeset checked out in it, whose uncommitted changes the skill commits and
        which it rebases in place, a "worktree" target, or a "branch:" target checked out in
        it) is processed only while the working copy is held for it alone (see "holdRoot"),
        and a task with a "branch:" changeset or target is processed only while these branches
        are held for it alone (see "holdBranch"), as another task (e.g. one implemented into
        the same changeset branch, or into this target branch) would otherwise be processed in
        the same worktree at once (mixing their change sets, and merging, rebasing, or removing
        the worktree under each other), else it is deferred  */
    protected async targetReady (task: AgentTask): Promise<boolean> {
        let changeset: FlowValue
        let target:    FlowValue
        try {
            changeset = taskFlow(this.log, task, "Changeset")
            target    = taskFlow(this.log, task, "Target")
        }
        catch (_err) {
            /*  an invalid value fails the processing of the task  */
            return true
        }
        const root = this.localRoot([ changeset, target ])
        if (changeset.type === "branch" && !this.holdBranch(task, root, changeset.name))
            return this.defer(task, `the changeset branch "${changeset.name}" used by another task`)
        else if (target.type === "branch" && !this.holdBranch(task, root, target.name))
            return this.defer(task, `the target branch "${target.name}" used by another task`)
        else if (root === "")
            return true
        const direct = target.type === "worktree"
            || (changeset.type === "worktree" && (await contextDir(root, task).catch(() => "")) === root)
            || (changeset.type === "branch" && (await gitWorktree(root, changeset.name).catch(() => "")) === root)
            || (target.type === "branch" && (await gitWorktree(root, target.name).catch(() => "")) === root)
        if (direct && !this.holdRoot(task, root))
            return this.defer(task, "the working copy used by another task")
        return true
    }

    /*  the work of a job with integration access to the "Changeset:" and "Target:" of a task
        (see "targetReady"), in the working copy itself, granting access to the context worktree
        of a "worktree" changeset (whose ASE worktree id the skill selects) and to the worktrees in
        which the changeset and target branches are checked out, where a target branch not checked
        out anywhere yet is checked out in a temporary worktree "<id>-<suffix>"  */
    protected async targetJob (task: AgentTask, suffix: string): Promise<AgentWork> {
        const changeset = taskFlow(this.log, task, "Changeset")
        const target    = taskFlow(this.log, task, "Target")
        const root      = await this.workdir(task, [ changeset, target ])
        const dirs: string[] = []
        let context = ""
        if (changeset.type === "worktree") {
            const dir = await contextDir(root, task)
            context = worktreeName(root, dir)
            dirs.push(dir)
        }
        else if (changeset.type === "branch")
            dirs.push(await gitWorktree(root, changeset.name))

        /*  check out a target branch not checked out anywhere yet in a temporary
            worktree, into which the merge commits, and afterwards publish the
            target branch to the origin of a temporarily cloned repository (deleting
            there a changeset branch which the merge deleted) and remove the
            temporary worktree again in any case, where a target branch not moved by
            the skill is not published (as it carries nothing to publish, but might be
            outdated by the origin meanwhile, whose rejected push would then needlessly
            fail the task and preserve the clone), a target branch which could
            not be published is rescued (as the skill already recorded the task as
            integrated, see "settle"), so its merge is not lost, while a changeset
            branch which could not be deleted is only reported (as the merge itself
            was already published)  */
        const tip = async (branch: string): Promise<string> =>
            (await execaJob("git", [ "rev-parse", "--verify", "--quiet", `refs/heads/${branch}` ],
                { cwd: root, reject: false })).stdout.trim()
        let temp = ""
        let base = ""
        if (target.type === "branch") {
            let dir = await gitWorktree(root, target.name)
            if (dir === "") {
                temp = Worktree.dir(`${worktreeId(task.id)}-${suffix}`, true, true, root)
                await gitWorktreeAdd(root, temp, target.name)
                dir = temp
            }
            dirs.push(dir)
            base = await tip(target.name)
        }
        return {
            cwd:  root,
            dirs: dirs.filter((dir) => dir !== ""),
            sourceDir: "",
            changesetWorktree: context,
            finish: async (log: AgentLog) => {
                const reason = (err: unknown) => err instanceof Error ? err.message : String(err)
                if (target.type === "branch" && await tip(target.name) === base)
                    await log("info", `target branch "${target.name}" unchanged -- nothing to publish`)
                else if (target.type === "branch")
                    await this.publish(root, target.name, log).catch(async (err: unknown) => {
                        await this.rescue(root, target.name, task, log).catch((err2: unknown) =>
                            log("error", `rescuing branch "${target.name}" failed: ${reason(err2)}`))
                        throw err
                    })
                if (changeset.type === "branch")
                    await this.unpublish(root, changeset.name, log).catch((err: unknown) =>
                        log("warning", `changeset branch "${changeset.name}" not deleted from origin: ${reason(err)}`))
            },
            cleanup: async () => {
                if (temp !== "")
                    await gitWorktreeRemove(root, temp)
            }
        }
    }

    /*  write a processing log line in the style of the regular logger to stdout (each
        line of a multi-line message as a full log line, with the line prefix of the logger,
        e.g. of an agent fleet member, and with the level tag styled on a terminal only),
        optionally collecting it for the processing log attachment of a task,
        and record it (of the task, or of the agent itself) in the presence of the agent  */
    protected async write (level: LineLevel, prefix: string, msg: string, lines?: string[], task = ""): Promise<void> {
        const timestamp = DateTime.now().toFormat("yyyy-LL-dd HH:mm:ss.SSS")
        lines?.push(`ase: [${timestamp}]: [${level.toUpperCase()}]: ${prefix}: ${msg}`)
        this.presence?.line(level, task, msg)
        const head = `${this.log.prefix()}ase: [${timestamp}]: ${this.log.tag(level, process.stdout.isTTY)}: ${prefix}: `
        await writeStdout(msg.split("\n").map((l) => `${head}${l}\n`).join(""))
    }

    /*  select the dispatchable tasks among all listed tasks <items> (except the
        <busy> ones already processed in a worker slot), the tasks waiting (with the reason),
        and the tasks with a notice (with the notice)  */
    protected abstract select (items: AgentItem[], busy: Set<string>): AgentSelection

    /*  claim a selected task, returning the description of the claim (for the processing
        log), or null if the task was silently skipped (throws if the task was not claimed)  */
    protected abstract claim (task: AgentTask): Promise<string | null>

    /*  settle a processed task after the skill invocation (successful by <ok>,
        with the job finished by <finished>, or interrupted by <aborted>)  */
    protected abstract settle (task: AgentTask, ok: boolean, finished: boolean, aborted: boolean,
        output: string[], log: AgentLog): Promise<void>

    /*  the description of the observed tasks (for the start log line)  */
    protected abstract observing (): string

    /*  run the skill of a prepared job via the headless agent tool, logging its decoded JSONL
        events in real-time and collecting its agent message text lines as the <output> (without
        buffering them, as the output of the agent tool can be huge), where the quiet entries are
        only echoed (i.e., not kept in the processing log attachment of the task), and return its success  */
    private async invoke (taskId: string, job: AgentJob, abort: AbortSignal, log: AgentLog, echo: AgentLog, output: string[]): Promise<boolean> {
        const { tool, timeout, timeoutSpec } = this
        const { cwd } = job
        const cli  = toolSpecs[tool].cli
        const cmd  = job.cmd ?? ""
        const i    = cmd.indexOf(" ")
        const args = toolArgs[tool](job.prompt ?? skillPrompt(tool, i < 0 ? cmd : cmd.slice(0, i), i < 0 ? "" : cmd.slice(i + 1)), (job.dirs ?? [])
            .filter((dir, i, dirs) => dir !== cwd && dirs.indexOf(dir) === i)
            .flatMap((dir) => [ "--add-dir", dir ]))
        await log("info", `running: ${cli} ${args.map((arg) => arg.includes(" ") ? `"${arg}"` : arg).join(" ")}`)
        const started = Date.now()
        const costs: ToolCosts = { costToken: null, costUSD: null, cread: 0, cwrite: 0, input: 0, apiMs: null }
        const subprocess = execa(cli, args, {
            cwd,
            env:                 { ASE_HEADLESS: "true" },
            stdin:               "ignore",
            all:                 true,
            buffer:              false,
            reject:              false,
            timeout,
            cancelSignal:        abort,
            forceKillAfterDelay: 10 * 1000
        })
        for await (const line of readline.createInterface({ input: subprocess.all })) {
            for (const entry of toolEntries(tool, line, costs)) {
                if (entry.text === true)
                    output.push(entry.msg)
                await (entry.quiet === true ? echo : log)(entry.level, `${cli}: ${entry.msg}`)
            }
        }
        const result = await subprocess

        /*  report the termination of the agent tool  */
        if (abort.aborted)
            await log("warning", `${cli} aborted by interrupt`)
        else if (result.timedOut)
            await log("warning", `${cli} timed out after ${timeoutSpec}`)
        else if (result.exitCode === undefined)
            await log("warning", `${cli} failed: ${result.shortMessage}`)
        else
            await log(result.exitCode === 0 ? "info" : "warning", `${cli} finished with exit code ${result.exitCode}`)

        /*  report the usage of the agent tool, with its wall time measured locally  */
        const walltimeMs = Date.now() - started
        const usage: AgentUsage = { walltimeSec: Math.round(walltimeMs / 1000), costToken: costs.costToken, costUSD: costs.costUSD }
        await log("info", `${cli} usage: walltime: ${usage.walltimeSec}s, ` +
            `tokens: ${usage.costToken ?? "n/a"}, ` +
            `cost: ${usage.costUSD !== null ? `$${usage.costUSD.toFixed(2)}` : "n/a"}`)
        this.presence?.used(usage)

        /*  book the usage onto the task, if the AI usage accounting is enabled ("telemetry.enabled"),
            (the AI request time falling back to the wall time and an unreported cost to the price
            table entry of the tool, as its model is unknown), without any human time and costs,
            as the headless agent tool runs unattended; the times are booked in rounded minutes,
            with the (signed) rounding remainder carried over to the next booking onto the task,
            where a failed booking is only reported  */
        const ok = !abort.aborted && !result.timedOut && result.exitCode === 0
        try {
            if (!telemetryEnabled(this.log))
                return ok
            const tokens: TokenCounts = { cread: costs.cread, cwrite: costs.cwrite, input: costs.input, output: costs.costToken ?? 0 }
            let cost = costs.costUSD
            if (cost === null) {
                const cfg = new Config("config", configSchema, this.log)
                cfg.read()
                cost = tokenCost(modelPrice(parsePrices(String(cfg.get("telemetry.prices.ai") ?? "")), tool), tokens)
            }
            const carry    = this.unbooked.get(taskId) ?? { aiMs: 0, realMs: 0 }
            const aiMs     = carry.aiMs   + (costs.apiMs ?? walltimeMs)
            const realMs   = carry.realMs + walltimeMs
            const timeAI   = Math.max(0, Math.round(aiMs   / (60 * 1000)))
            const timeReal = Math.max(0, Math.round(realMs / (60 * 1000)))
            this.unbooked.set(taskId, { aiMs: aiMs - timeAI * 60 * 1000, realMs: realMs - timeReal * 60 * 1000 })
            await Task.addUsage(this.log, taskId, {
                "time.ai":      timeAI,
                "time.real":    timeReal,
                "token.cread":  tokens.cread,
                "token.cwrite": tokens.cwrite,
                "token.input":  tokens.input,
                "token.output": tokens.output,
                "cost.ai":      Number(cost.toFixed(4))
            })
        }
        catch (err: unknown) {
            await log("warning", `usage not booked onto task: ${err instanceof Error ? err.message : String(err)}`)
        }
        return ok
    }

    /*  process a claimed task via the skill of the headless agent tool in a worker slot
        and afterwards settle it; finally the processing log is appended to the
        attachment of the task  */
    private async handle (task: AgentTask, claimed: string, slot: number, abort: AbortSignal): Promise<void> {
        const lines: string[] = []
        const prefix = `${this.name}[${slot}]: ${task.id}`
        const log    = (level: LineLevel, msg: string) => this.write(level, prefix, msg, lines, task.id)
        const echo   = (level: LineLevel, msg: string) => this.write(level, prefix, msg, undefined, task.id)

        /*  a timed out preparing, which keeps running, releases the resources it still
            creates (e.g. worktrees) and the resources of the task only once it ended  */
        let late: Promise<void> | null = null
        try {
            await log("info", claimed)

            /*  prepare the job and run its skill via the headless agent tool  */
            const output: string[] = []
            let ok = false
            let job: AgentJob | null = null
            try {
                job = await withinJobTimeout("preparing the job", () => this.prepare(task, this.parallelized, log), (pending) => {
                    late = pending
                        .then((orphan) => orphan.cleanup?.(log))
                        .catch(() => {})
                })
                ok = await this.invoke(task.id, job, abort, log, echo, output)
            }
            catch (err: unknown) {
                await log("error", err instanceof Error ? err.message : String(err))
            }

            /*  finish the job independent of the success of the skill,
                where a failure overrides even a success of the skill  */
            let finished = true
            const finish = job?.finish
            if (finish !== undefined) {
                try {
                    await withinJobTimeout("finishing the job", () => finish(log, { ok, output }))
                }
                catch (err: unknown) {
                    await log("error", err instanceof Error ? err.message : String(err))
                    ok       = false
                    finished = false
                }
            }

            /*  clean up the job in any case (a failure is reported only)  */
            const cleanup = job?.cleanup
            if (cleanup !== undefined) {
                try {
                    await withinJobTimeout("cleaning up the job", () => cleanup(log))
                }
                catch (err: unknown) {
                    await log("warning", err instanceof Error ? err.message : String(err))
                }
            }

            /*  settle the task by the results of the skill invocation and the job  */
            await this.settle(task, ok, finished, abort.aborted, output, log)
        }
        catch (err: unknown) {
            await log("error", err instanceof Error ? err.message : String(err))
        }
        finally {
            /*  release the resources of the task (after a timed out preparing ended)  */
            const pending = late as Promise<void> | null
            if (pending !== null)
                pending.finally(() => this.unbind(task.id)).catch(() => {})
            else
                await this.unbind(task.id)
        }

        /*  append the processing log to the attachment of the task  */
        const now = DateTime.now().toFormat("yyyy-LL-dd HH:mm")
        try {
            const attached = await Task.attach(this.log, task.id, {
                Type: `text/plain; charset=utf-8; kind="agent:${this.logName}"`,
                Created: now, Modified: now, Data: `${lines.join("\n")}\n`
            }, true)
            if (attached)
                await this.write("info", prefix, "processing log attached to task", undefined, task.id)
            else
                await this.write("warning", prefix, "task vanished -- processing log not attached", undefined, task.id)
        }
        catch (err: unknown) {
            await this.write("error", prefix, `processing log not attached: ${err instanceof Error ? err.message : String(err)}`, undefined, task.id)
        }
    }

    /*  the per-agent CLI command "start", parsing the options of the agent, where the
        options shared by all agents carry no defaults, as they fall back to those
        given to "setup" (see "ase agent <kind> start" and "ase agent fleet start")  */
    command (): Command {
        if (this.cmd === null) {
            this.cmd = new Command("start")
                .description(this.description)
                .exitOverride()
                .option("-n, --name <name>",        "name of the agent in its log lines, its processing log " +
                    `attachment "agent:<name>", the "Assignee:" of its tasks, and its runtime files (default: "${this.kind}")`)
                .option("-t, --tool <tool>",        "agent tool (\"claude\", \"copilot\", or \"codex\"; " +
                    "default: $ASE_TOOL, else \"claude\")")
                .option("-p, --parallel <num>",     "maximum number of tasks processed in parallel (default: 1)")
                .option("-T, --timeout <duration>", "maximum duration of processing a task " +
                    "as <number><unit> with unit s, m, or h (default: 60m)")
                .option("-o, --one-shot",           "terminate once all dispatchable incoming tasks are processed")
                .option("--agent-relay <url>",      "agent relay to pass the live presence of the agent to, " +
                    "as \"ase[s]://<addr>:<port>[/<token>]\" (default: the configured \"project.relay.url\", else none)")
            if (this.worktree)
                this.cmd
                    .option("-r, --repo <url>",    "Git repository to clone temporarily for the tasks " +
                        "without \"worktree\" values (default: the Git working copy the agent is started in)")
                    .option("-d, --tempdir <dir>", "directory for the temporary files like the clone of \"--repo\", " +
                        "with \"%p\" expanded to the process id and \"%h\" to a hash value (default: a fresh, private one)")
            this.options(this.cmd)
        }
        return this.cmd
    }

    /*  validate the own options of the agent ahead of its setup (e.g. before detaching it),
        throwing on an invalid one  */
    validate (_own: Partial<AgentOpts>): void {}

    /*  configure the agent from the default options, overridden by its own options,
        validate its configuration, and initialize it, where <relay> is the client
        of the agent relay to announce the presence of the agent to (if any)  */
    async setup (global: AgentOpts, own: Partial<AgentOpts>, relay: AgentRelayClient | null = null): Promise<void> {
        const opts = {
            ...global,
            ...Object.fromEntries(Object.entries(own).filter((entry) => entry[1] !== undefined))
        } as AgentOpts
        this._name = opts.name ?? ""
        if (this._name !== "" && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(this._name))
            throw new Error(`agent: invalid name "${this._name}" (expected letters, digits, "_", ".", or "-")`)
        this.relay = relay
        this.tool = parseTool(opts.tool)
        for (const cli of [ toolSpecs[this.tool].cli, ...(this.worktree ? [ "git" ] : []) ])
            await which(cli).catch(() => {
                throw new Error(`agent: ${this.name} requires "${cli}", which was not found in $PATH`)
            })
        if (this.worktree) {
            /*  the "worktree" values of the change set flow keys refer to the Git working
                copy the agent is started in, which hence is mandatory without "--repo",
                while with "--repo" the skills run inside its temporary clone and hence
                can only reach a task store not located inside the working copy  */
            this.repo    = opts.repo ?? ""
            this.tempdir = opts.tempdir ?? ""
            if (this.repo === "" && !(await gitInside()))
                throw new Error(`agent: ${this.name} has to be started inside a Git working copy (or be given "--repo")`)
            else if (this.repo !== "" && Task.isLocal(this.log))
                throw new Error(`agent: ${this.name} with "--repo" requires a non-local task store ` +
                    "(project uses a local \"ase:<path>\" one)")
        }
        if (!/^\d+$/.test(opts.parallel) || Number.parseInt(opts.parallel, 10) < 1)
            throw new Error(`agent: invalid number of parallel workers "${opts.parallel}" (expected a positive integer)`)
        this.parallel = Number.parseInt(opts.parallel, 10)
        if (this.serial && this.parallel > 1) {
            if (own.parallel !== undefined)
                await this.write("warning", this.name, `processing tasks serially only -- ignoring "--parallel ${opts.parallel}"`)
            this.parallel = 1
        }
        this.timeoutSpec = opts.timeout
        this.timeout     = parseDuration(opts.timeout)
        this.oneShot     = opts.oneShot
        this.lifecycle   = await Task.lifecycle(this.log)
        if (!this.lifecycles.includes(this.lifecycle.name))
            throw new Error(`agent: ${this.name} requires the ` +
                `${this.lifecycles.map((name) => `"${name}"`).join(" or ")} task lifecycle model ` +
                `(project uses "${this.lifecycle.name}")`)
        await this.init(opts)
    }

    /*  clone the repository of "--repo" temporarily, with its default
        branch detached, so all branches can be refreshed from its origin  */
    private async cloneRepo (): Promise<void> {
        this.temp  = await tempDir(this.name, this.tempdir)
        this.clone = path.join(this.temp.dir, "clone")
        await execaJob("git", [ "clone", "--quiet", this.repo, this.clone ])
        this.head = (await execaJob("git", [ "branch", "--show-current" ], { cwd: this.clone })).stdout.trim()
        await execaJob("git", [ "checkout", "--quiet", "--detach" ], { cwd: this.clone })
        await this.write("info", this.name, `cloned "${this.repo}" temporarily (default branch "${this.head}")`)
    }

    /*  remove the temporary directory (if any), unless it holds work preserved for a manual recovery  */
    private async removeTemp (): Promise<void> {
        if (this.temp === null)
            return
        if (this.preserved)
            await this.write("error", this.name, `temporary directory "${this.temp.dir}" preserved ` +
                `for a manual recovery (see "${path.join(this.temp.dir, tempPreserved)}")`)
        else {
            await fs.promises.rm(this.temp.dir, { recursive: true, force: true })
            if (this.temp.base !== "")
                await fs.promises.rmdir(this.temp.base).catch(() => {})
        }
        this.temp  = null
        this.clone = ""
    }

    /*  claim all dispatchable tasks in natural id order into free worker slots,
        reporting the waiting and the noticed tasks once per change of their reason resp. notice  */
    private async dispatch (state: RunState): Promise<void> {
        const { slots, running, abort, notify } = state
        const { items } = await Task.listHeaders(this.log)
        const selected  = this.select(items, new Set(slots.values()))
        const tasks     = selected.tasks
        const notices   = selected.notices ?? new Map<string, string>()
        for (const [ id, notice ] of notices)
            if (state.notices.get(id) !== notice)
                await this.write("warning", this.name, `task "${id}" ${notice}`)
        state.notices = notices
        for (const [ id, reason ] of selected.waiting)
            if (state.waiting.get(id) !== reason)
                await this.write("info", this.name, `task "${id}" waits for ${reason}`)
        state.waiting = selected.waiting
        tasks.sort((a, b) => TaskFormat.compareIds(a.id, b.id))
        for (const task of tasks) {
            if (slots.size >= this.parallel || abort.signal.aborted)
                break
            let claimed: string | null = null
            try {
                /*  a task not ready for the agent (e.g. one already carrying the result of
                    a previous processing, or one deferred) is skipped, where the resources
                    held for a task not claimed (e.g. its working copy) are released again  */
                if (await this.ready(task))
                    claimed = await this.claim(task)
            }
            catch (err: unknown) {
                await this.write("warning", this.name, `task "${task.id}" not claimed: ${err instanceof Error ? err.message : String(err)}`)
            }
            if (claimed === null) {
                this.unhold(task.id)
                continue
            }
            this.deferred.delete(task.id)
            let slot = 1
            while (slots.has(slot))
                slot++
            slots.set(slot, task.id)
            busyAgents.add(this)
            this.presence?.busy([ ...slots.values() ])

            /*  a task is processed in parallel to others also by the peer agents of its kind,
                where an agent becoming idle wakes up all agents of this process, as its
                processed task can have become dispatchable to another one  */
            const job: Promise<void> = this.handle(task, claimed, slot, abort.signal)
                .finally(() => {
                    slots.delete(slot)
                    this.presence?.busy([ ...slots.values() ])
                    running.delete(job)
                    notify()
                    if (slots.size === 0) {
                        if (!state.dispatching)
                            busyAgents.delete(this)
                        for (const wakeAgent of wakeAgents)
                            wakeAgent()
                    }
                })
            running.add(job)
        }
    }

    /*  observe the tasks and dispatch each selected one (see "select"), after
        claiming it (see "claim"), to a free worker slot, until interrupted (or,
        in one-shot mode, until no task is dispatchable and no task is processed anymore)  */
    async run (): Promise<void> {
        const { tool, parallel } = this

        /*  the worker slots (slot number to task id), their jobs, and the wake-up
            of the dispatcher on task store changes, freed slots, and interrupts  */
        const slots   = new Map<number, string>()
        const running = new Set<Promise<void>>()
        const abort   = new AbortController()
        let dirty     = true
        let wake      = () => {}
        const notify  = () => {
            dirty = true
            wake()
        }
        const interrupt = (signal: NodeJS.Signals) => {
            if (abort.signal.aborted)
                return
            abort.abort()
            const write = running.size > 0 ?
                this.write("warning", this.name, `interrupted (received ${signal}) -- aborting ${running.size} running processing(s)`) :
                this.write("info", this.name, `interrupted (received ${signal})`)
            write.catch(() => {})
            notify()
        }

        /*  a repeated terminating signal terminates the process at once (instead of
            awaiting the aborted processings and their cleanups, which can take minutes),
            leaving the claimed tasks to the recovery by a later run of an agent of its kind  */
        const signalled = (signal: NodeJS.Signals) => {
            if (abort.signal.aborted) {
                this.log.write("warning", `agent: ${this.name}: interrupted again (received ${signal}) -- terminating immediately`)
                process.exit(128 + (os.constants.signals[signal] ?? 0))
            }
            interrupt(signal)
        }

        /*  the state of the run shared with its dispatching  */
        const state: RunState = { slots, running, abort, waiting: new Map(), notices: new Map(), dispatching: false, notify }

        /*  dispatch on every change until interrupted (or, in one-shot mode, until a
            dispatching leaves all worker slots free while all agents of this process
            are idle), then await the aborted jobs, where the interrupt is triggered by
            all terminating signals which can be caught, so no claimed task keeps its "active" tag  */
        process.on("SIGINT",  signalled)
        process.on("SIGTERM", signalled)
        process.on("SIGHUP",  signalled)
        process.on("SIGQUIT", signalled)
        wakeAgents.add(notify)
        this.wakeup = notify
        const unsubscribe = Task.subscribe(this.log, notify)

        /*  announce the presence of the agent to the agent relay (if any) while it runs  */
        if (this.relay !== null) {
            this.presence = new AgentPresenceReporter(this.log, this.relay, this.kind, this.name, this.mode, this.presenceRequest)
            this.presence.start()
        }

        /*  a failed dispatching (e.g. on a transient failure of the task store) is retried
            after a growing delay, but in one-shot mode only a limited number of times in a row,
            after which the agent fails (instead of terminating as if no task were dispatchable)  */
        const retries = 3
        let failures  = 0
        let retry: ReturnType<typeof setTimeout> | undefined

        /*  an agent counts as busy for the termination of the peer agents of this process in
            one-shot mode not only while processing tasks, but also while starting up and while
            dispatching (where it might still claim a task), and an agent becoming idle after a
            dispatching wakes up all other agents of this process waiting for it to re-check
            their termination (but not itself, as it re-checks it right away)  */
        busyAgents.add(this)
        const dispatched = (): boolean => {
            state.dispatching = false
            if (slots.size > 0)
                return false
            if (busyAgents.delete(this) && this.oneShot)
                for (const wakeAgent of wakeAgents)
                    if (wakeAgent !== notify)
                        wakeAgent()
            return this.oneShot && busyAgents.size === 0
        }
        try {
            /*  acquire the run lock of the agent and recover the tasks
                left behind by terminated runs of agents of its kind  */
            await this.runLock.acquire()
            await this.recover().catch((err: unknown) =>
                this.write("warning", this.name, `recovery failed: ${err instanceof Error ? err.message : String(err)}`))

            /*  clone the repository of "--repo" temporarily  */
            if (this.repo !== "")
                await this.cloneRepo()

            await this.write("info", this.name, `observing ${this.observing()} ` +
                `(tool: ${tool}, parallel: ${parallel}, timeout: ${this.timeoutSpec}${this.oneShot ? ", one-shot" : ""})`)
            let finished = false
            let failure: unknown = null
            while (!abort.signal.aborted && !finished) {
                if (dirty && slots.size < parallel) {
                    dirty             = false
                    state.dispatching = true
                    busyAgents.add(this)
                    try {
                        await this.dispatch(state)
                        failures = 0
                        finished = dispatched()
                    }
                    catch (err: unknown) {
                        dispatched()
                        failures++
                        await this.write("error", this.name, `dispatching failed (${failures}. time): ` +
                            `${err instanceof Error ? err.message : String(err)}`)
                        if (this.oneShot && failures >= retries) {
                            failure = err
                            break
                        }
                        clearTimeout(retry)
                        retry = setTimeout(notify, Math.min(failures, 30) * 1000)
                    }
                }
                else
                    await new Promise<void>((resolve) => { wake = resolve })
            }
            await Promise.all(running)
            if (failure !== null)
                throw new Error(`agent: ${this.name}: dispatching failed ${failures} times in a row -- giving up ` +
                    `(${failure instanceof Error ? failure.message : String(failure)})`)
            await this.write("info", this.name, finished ? "no more dispatchable tasks -- terminated" : "terminated")
        }
        finally {
            clearTimeout(retry)
            unsubscribe()
            await this.presence?.stop()
            this.presence = null
            process.off("SIGINT",  signalled)
            process.off("SIGTERM", signalled)
            process.off("SIGHUP",  signalled)
            process.off("SIGQUIT", signalled)

            /*  let the agents of this process waiting for this one re-check their termination  */
            this.wakeup = null
            wakeAgents.delete(notify)
            busyAgents.delete(this)
            for (const wakeAgent of wakeAgents)
                wakeAgent()

            /*  retry the failed finalizations a last time (those still failing are
                recovered by a later run, as the run lock is retained for them)  */
            if (this.unsettled.size > 0)
                await this.retryUnsettled()

            /*  remove the temporary directory (if any)  */
            await this.removeTemp().catch((err: unknown) =>
                this.write("warning", this.name, `temporary directory not removed: ${err instanceof Error ? err.message : String(err)}`))
            await this.teardown()
            if (!this.retainRun())
                await this.runLock.release()
        }
    }
}

