/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                      from "node:path"
import fs                        from "node:fs"
import os                        from "node:os"
import crypto                    from "node:crypto"
import { fileURLToPath }         from "node:url"
import { quote }                 from "shell-quote"
import writeFileAtomic           from "write-file-atomic"

import { userStateDir }          from "./ase-config-scope.js"
import { Task }                  from "./ase-task.js"

/*  the models and efforts of the chat of a task (as accepted by the "--model" and "--effort" options
    of the agent tool, where the empty one is its default)  */
export const terminalModels  = [ "", "opus", "sonnet", "haiku", "fable" ]
export const terminalEfforts = [ "", "low", "medium", "high", "xhigh", "max" ]

/*  the persisted chat of a task: its session of the agent tool, and its model and effort  */
export type TerminalChat = { session: string, model: string, effort: string }

/*  the state file of the chats of the tasks of the current project (next to the board state)  */
const chatFile = (): string =>
    path.join(userStateDir(), "board", `${Task.projectIdOf(Task.projectRoot())}-chat.json`)
const chatLoad = (): Record<string, Partial<TerminalChat>> => {
    try {
        return JSON.parse(fs.readFileSync(chatFile(), "utf8")) as Record<string, Partial<TerminalChat>>
    }
    catch {
        return {}
    }
}

/*  get the persisted chat of a task, allocating its session on first use  */
export const terminalChat = (id: string): TerminalChat => {
    const chats = chatLoad()
    const chat  = chats[id] ?? {}
    if (chat.session === undefined) {
        chat.session = crypto.randomUUID()
        chats[id] = chat
        fs.mkdirSync(path.dirname(chatFile()), { recursive: true })
        writeFileAtomic.sync(chatFile(), JSON.stringify(chats, null, 4), { encoding: "utf8" })
    }
    return { session: chat.session, model: chat.model ?? "", effort: chat.effort ?? "" }
}

/*  change the model and effort of the persisted chat of a task  */
export const terminalConfigure = (id: string, model: string, effort: string): void => {
    terminalChat(id)
    const chats = chatLoad()
    chats[id] = { ...chats[id], model, effort }
    writeFileAtomic.sync(chatFile(), JSON.stringify(chats, null, 4), { encoding: "utf8" })
}

/*  the transcript file of the session of the agent tool, if it exists  */
const sessionFile = (session: string): string | null => {
    const root = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "projects")
    try {
        for (const dir of fs.readdirSync(root))
            if (fs.existsSync(path.join(root, dir, `${session}.jsonl`)))
                return path.join(root, dir, `${session}.jsonl`)
    }
    catch {
        /*  no such directory  */
    }
    return null
}

/*  whether the session of the agent tool already exists (as it then has to be resumed, not created)  */
const sessionExists = (session: string): boolean =>
    sessionFile(session) !== null

/*  the background tasks (shell commands and agents) of the chat of a task, as the agent tool records them in the transcript of
    its session: a task starts with a tool result carrying its "backgroundTaskId" resp. (for an agent) its "agentId" as asynchronously
    launched, and ends with a "task-notification" it queues (completed, failed, or killed, where a monitor queues one per event before), or with the result of the tool stopping it;
    the transcript is read incrementally from the offset of the last poll on (as it is only appended to), where an incomplete
    last line is left to the next poll  */
export type TerminalTasks = { session: string, file: string | null, offset: number, running: Set<string> }

/*  start tracking the background tasks of a chat, which begin with its next process (as the tasks of an earlier one ended with it)  */
export const terminalTasksNew = (id: string): TerminalTasks => {
    const session = terminalChat(id).session
    const file    = sessionFile(session)
    return { session, file, offset: file !== null ? fs.statSync(file).size : 0, running: new Set() }
}

/*  take over the start or end of a background task from a line of the transcript  */
const terminalTasksLine = (running: Set<string>, line: string): void => {
    if (!line.includes("\"toolUseResult\"") && !line.includes("\"queue-operation\""))
        return
    let rec: { type?: string, operation?: string, content?: unknown, toolUseResult?: { backgroundTaskId?: unknown, agentId?: unknown, taskId?: unknown, timeoutMs?: unknown, isAsync?: unknown, status?: unknown, task_id?: unknown, message?: unknown } | null }
    try {
        rec = JSON.parse(line) as typeof rec
    }
    catch {
        return
    }
    const result = rec.toolUseResult
    if (typeof result === "object" && result !== null) {
        if (typeof result.backgroundTaskId === "string")
            running.add(result.backgroundTaskId)
        else if (result.isAsync === true && result.status === "async_launched" && typeof result.agentId === "string")
            running.add(result.agentId)

        /*  a monitor (which also queues a notification per event of it, ending only with the one carrying its status)  */
        else if (typeof result.taskId === "string" && typeof result.timeoutMs === "number")
            running.add(result.taskId)

        /*  stopping a shell command (unlike an agent) queues no notification, but is reported by the result of the stopping tool  */
        else if (typeof result.task_id === "string" && typeof result.message === "string" && result.message.startsWith("Successfully stopped task"))
            running.delete(result.task_id)
    }
    else if (rec.type === "queue-operation" && rec.operation === "enqueue" && typeof rec.content === "string") {
        const id = /<task-id>([^<]+)<\/task-id>/.exec(rec.content)?.[1]
        if (id !== undefined && rec.content.includes("<status>"))
            running.delete(id)
    }
}

/*  take over the new lines of the transcript, and get the number of the background tasks running  */
export const terminalTasksPoll = (tasks: TerminalTasks): number => {
    tasks.file ??= sessionFile(tasks.session)
    if (tasks.file === null)
        return 0
    try {
        const fd = fs.openSync(tasks.file, "r")
        try {
            const size = fs.fstatSync(fd).size
            if (size < tasks.offset) {
                tasks.offset = 0
                tasks.running.clear()
            }
            if (size > tasks.offset) {
                const buf = Buffer.alloc(size - tasks.offset)
                const len = fs.readSync(fd, buf, 0, buf.length, tasks.offset)
                const end = buf.subarray(0, len).lastIndexOf(0x0a) + 1
                tasks.offset += end
                for (const line of buf.subarray(0, end).toString("utf8").split("\n"))
                    terminalTasksLine(tasks.running, line)
            }
        }
        finally {
            fs.closeSync(fd)
        }
    }
    catch {
        /*  an unreadable transcript keeps the tasks as they are  */
    }
    return tasks.running.size
}

/*  the file recording the context usage of the chat of a task (see "ase-task-board-statusline-cli")  */
const contextFile = (id: string): string =>
    path.join(userStateDir(), "board", `${Task.projectIdOf(Task.projectRoot())}-chat-context`, `${id}.json`)

/*  the context usage, model, and effort of the chat of a task as last reported by the agent tool since the given time (the start of
    its process), if any, as the report of an earlier process (or session) is stale; the model as its alias, if it has one  */
export type TerminalReport = { pct: number, tokens: number, size: number, model: string, effort: string }
export const terminalReport = (id: string, since: number): TerminalReport | null => {
    try {
        const r = JSON.parse(fs.readFileSync(contextFile(id), "utf8")) as { pct: number, tokens: number, size: number, model?: string, effort?: string, at?: number }
        if (typeof r.at !== "number" || r.at < since)
            return null
        const model  = terminalModels.find((m) => m !== "" && (r.model ?? "").includes(m)) ?? ""
        const effort = terminalEfforts.includes(r.effort ?? "") ? r.effort ?? "" : ""
        return { pct: r.pct, tokens: r.tokens, size: r.size, model, effort }
    }
    catch {
        return null
    }
}

/*  the defaults of the agent tool, i.e., the model and effort it uses without the options "--model" and "--effort": the ones
    it reported (as the model alias, resp. the effort of that model) for a process started without them since the start of the
    service (not for a resumed one, which keeps the model of its session), else the ones of its settings (the most specific
    settings file first), else unknown (the empty string)  */
const observed = { model: "", efforts: new Map<string, string>() }
const setting = (key: string): string => {
    const config = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")
    const dir    = Task.projectRoot()
    for (const file of [ path.join(dir, ".claude", "settings.local.json"), path.join(dir, ".claude", "settings.json"), path.join(config, "settings.json") ])
        try {
            const value = (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>)[key]
            if (typeof value === "string")
                return value
        }
        catch {
            /*  no such settings file, or an unreadable one  */
        }
    return ""
}
export const terminalDefaults = (model: string): { model: string, effort: string } => {
    const effort = setting("effortLevel")
    return {
        model:  observed.model !== "" ? observed.model : terminalModels.find((m) => m !== "" && setting("model").includes(m)) ?? "",
        effort: observed.efforts.get(model) ?? (terminalEfforts.includes(effort) ? effort : "")
    }
}
export const terminalLearn = (args: string[], report: TerminalReport): void => {
    if (report.model !== "" && report.effort !== "" && !args.includes("--effort"))
        observed.efforts.set(report.model, report.effort)
    if (report.model !== "" && !args.includes("--model") && args[0] !== "--resume")
        observed.model = report.model
}

/*  the system prompt appended to the chat of a task  */
const terminalPrompt = (id: string): string =>
    `This session works on the ASE task "${id}" (the current task). You may edit only this task. ` +
    "You may only CREATE other tasks (\"ase task save -c\") and never change them afterwards, " +
    "as further edits of a new task happen in the own chat of that task. " +
    `"This task", "the task", "dieser Task", and "der Task" always mean the task "${id}". ` +
    `Call the ASE task skills either with the id "${id}" or without any id (they default to the current task), ` +
    "and never pass words of the user (like \"this\" or \"dieser\") as the task id argument."

/*  the guard of the chat of a task against changes of other tasks, as a hook of the agent tool: by default
    the standalone hook program (which has to start up before every tool invocation), resp. with an URL a
    hook request to it (answered by the running web board, without any startup, authenticated by the
    bearer token in the environment variable "ASE_GUARD_TOKEN" of the agent tool)  */
const terminalGuard = (url: string | null): Record<string, unknown> => {
    if (url !== null)
        return {
            type: "http", url, headers: { Authorization: "Bearer $ASE_GUARD_TOKEN" }, allowedEnvVars: [ "ASE_GUARD_TOKEN" ]
        }
    const program = path.join(path.dirname(fileURLToPath(import.meta.url)), "ase-task-board-guard-cli.js")
    return { type: "command", command: quote([ process.execPath, program ]) }
}

/*  the arguments of the agent tool for the chat of a task, which first creates and later resumes its session
    (or, with "create", creates it again, if resuming failed), and, with a theme, with the ANSI variant of the color theme of
    its terminal UI (so it draws with the 16 ANSI colors of the terminal, which the palette of the board maps, instead of its own
    truecolor ones), which it takes from its settings, so a change takes effect with the next start only  */
export const terminalArgs = (id: string, options: { create?: boolean, guard?: string, theme?: "dark" | "light" } = {}): string[] => {
    const chat = terminalChat(id)
    const args = [ options.create !== true && sessionExists(chat.session) ? "--resume" : "--session-id", chat.session ]

    /*  the default model is passed explicitly when resuming, as the agent tool otherwise keeps the model of the session  */
    const model = chat.model !== "" ? chat.model : args[0] === "--resume" ? terminalDefaults("").model : ""
    if (model !== "")
        args.push("--model", model)
    if (chat.effort !== "")
        args.push("--effort", chat.effort)
    args.push("--append-system-prompt", terminalPrompt(id))
    const dir = path.dirname(fileURLToPath(import.meta.url))
    args.push("--settings", JSON.stringify({
        ...options.theme !== undefined ? { theme: `${options.theme}-ansi` } : {},
        hooks:      { PreToolUse: [ { hooks: [ terminalGuard(options.guard ?? null) ] } ] },
        statusLine: { type: "command", command: quote([ process.execPath, path.join(dir, "ase-task-board-statusline-cli.js"), contextFile(id) ]), padding: 0 }
    }))
    return args
}

/*  whether the start of the agent tool with these arguments failed to resume the session of a task, as it ended
    with an error printing "No conversation found with session ID", resp. (without its output) at once, while the
    session does not exist, so the session is to be created instead  */
export const terminalResumeFailed = (id: string, args: string[], code: number | null, ms: number, output?: string): boolean =>
    args[0] === "--resume" && code !== 0
        && (output !== undefined ? output.includes("No conversation found") : ms < 10 * 1000 && !sessionExists(terminalChat(id).session))

/*  the variables of the environment of the process starting a chat which must not reach the agent tool, as they
    belong to the session and service of whoever started that process (like "ASE_PROJECT_ID", "ASE_SESSION_ID",
    or "ASE_SERVICE_PORT", which make the "ase mcp" of the chat resolve the wrong project and service), or
    to its agent tool session, kept are the user configuration ones: the directories of the ASE configuration and
    state, the keys of the foreign MCP servers, and the authentication and provider ones of the agent tool;
    the ones of the terminal hosting the process are dropped only with "host", i.e., when the chat runs in a terminal
    emulator of its own (and not in the very terminal of the user)  */
const envKeep = /^(?:ASE_CONFIG_DIR|ASE_STATE_DIR|ASE_MCP_KEY_.*|CLAUDE_CODE_(?:OAUTH_TOKEN|API_KEY.*|USE_.*|SKIP_.*_AUTH|MAX_OUTPUT_TOKENS))$/
const envDrop = /^(?:ASE_.*|CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_PID|CLAUDE_EFFORT)$/
const envHost = /^(?:HC_.*|TERM_PROGRAM(?:_VERSION)?|TMUX.*|STY|KITTY_.*|GHOSTTY_.*|ITERM.*|WT_.*)$/

/*  the environment of the agent tool for the chat of a task: the given environment without the variables of its
    session and service (and, with "host", of its terminal), plus the one making the task its current task  */
export const terminalEnv = (id: string, base: NodeJS.ProcessEnv, host: boolean): Record<string, string> => {
    const env = {} as Record<string, string>
    for (const [ key, val ] of Object.entries(base))
        if (val !== undefined && (envKeep.test(key) || !(envDrop.test(key) || (host && envHost.test(key)))))
            env[key] = val
    env.ASE_TASK_ID = id
    return env
}
