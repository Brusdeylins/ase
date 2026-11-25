/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                      from "node:path"
import fs                        from "node:fs"
import os                        from "node:os"
import { fileURLToPath }         from "node:url"

import { quote }                 from "shell-quote"
import writeFileAtomic           from "write-file-atomic"

import { userStateDir }          from "./ase-config-scope.js"
import { Task }                  from "./ase-task.js"

/*  The local extras of the task chats (of the agent tool Claude only): the model and effort of the chat
    of a task, the guard against changes of other tasks, the status line of the chats (recording their
    context usage), the busy and background task detection (vetoing the restart and the idle end of a
    chat), and the fixed color theme of the agent tool for the web board  */

/*  the models and efforts of the chat of a task (as accepted by the "--model" and "--effort" options
    of the agent tool, where the empty one is its default)  */
export const chatModels  = [ "", "fable", "opus", "sonnet", "haiku" ]
export const chatEfforts = [ "", "max", "xhigh", "high", "medium", "low" ]

/*  the chosen model and effort of the chats of the tasks of the current project  */
type Config = { model: string, effort: string }
const configFile = (): string =>
    path.join(userStateDir(), "chat", `${Task.projectIdOf(Task.projectRoot())}-config.json`)
const configLoad = (): Record<string, Partial<Config>> => {
    try {
        return JSON.parse(fs.readFileSync(configFile(), "utf8")) as Record<string, Partial<Config>>
    }
    catch {
        return {}
    }
}
export const chatConfig = (id: string): Config => {
    const config = configLoad()[id] ?? {}
    return { model: config.model ?? "", effort: config.effort ?? "" }
}
export const chatConfigure = (id: string, model: string, effort: string): void => {
    const all = configLoad()
    all[id] = { model, effort }
    fs.mkdirSync(path.dirname(configFile()), { recursive: true })
    writeFileAtomic.sync(configFile(), JSON.stringify(all, null, 4) + "\n", { encoding: "utf8" })
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

/*  the background tasks (shell commands, agents, and monitors) of a chat, as the agent tool records them
    in the transcript of its session (started by a tool result carrying their id, ended by a queued
    task notification with a status, or by the result of the tool stopping them), read incrementally  */
export type ChatTasks = { session: string, file: string | null, offset: number, running: Set<string> }
export const chatTasksNew = (session: string): ChatTasks => {
    const file = sessionFile(session)
    return { session, file, offset: file !== null ? fs.statSync(file).size : 0, running: new Set() }
}
const chatTasksLine = (running: Set<string>, line: string): void => {
    if (!line.includes("\"toolUseResult\"") && !line.includes("\"queue-operation\""))
        return
    type Result = {
        backgroundTaskId?: unknown, agentId?: unknown, taskId?: unknown, timeoutMs?: unknown,
        isAsync?: unknown, status?: unknown, task_id?: unknown, message?: unknown
    }
    let rec = null as { type?: string, operation?: string, content?: unknown, toolUseResult?: Result | null } | null
    try {
        rec = JSON.parse(line) as typeof rec
    }
    catch {
        return
    }
    const result = rec?.toolUseResult
    if (typeof result === "object" && result !== null) {
        if (typeof result.backgroundTaskId === "string")
            running.add(result.backgroundTaskId)
        else if (result.isAsync === true && result.status === "async_launched" && typeof result.agentId === "string")
            running.add(result.agentId)
        else if (typeof result.taskId === "string" && typeof result.timeoutMs === "number")
            running.add(result.taskId)
        else if (typeof result.task_id === "string" && typeof result.message === "string"
            && result.message.startsWith("Successfully stopped task"))
            running.delete(result.task_id)
    }
    else if (rec?.type === "queue-operation" && rec.operation === "enqueue" && typeof rec.content === "string") {
        const id = /<task-id>([^<]+)<\/task-id>/.exec(rec.content)?.[1]
        if (id !== undefined && rec.content.includes("<status>"))
            running.delete(id)
    }
}
export const chatTasksPoll = (tasks: ChatTasks): number => {
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
                    chatTasksLine(tasks.running, line)
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

/*  the file recording the context usage of the chat of a task (see "ase-task-chat-statusline-cli")  */
const contextFile = (id: string): string =>
    path.join(userStateDir(), "chat", `${Task.projectIdOf(Task.projectRoot())}-context`, `${id}.json`)

/*  the context usage, model, and effort of the chat of a task as last reported by the agent tool since
    the start of its process, if any (the model as its alias, if it has one)  */
export type ChatReport = { pct: number, tokens: number, size: number, model: string, effort: string }
export const chatReport = (id: string, since: number): ChatReport | null => {
    try {
        const r = JSON.parse(fs.readFileSync(contextFile(id), "utf8")) as
            { pct: number, tokens: number, size: number, model?: string, effort?: string, at?: number }
        if (typeof r.at !== "number" || r.at < since)
            return null
        const model  = chatModels.find((m) => m !== "" && (r.model ?? "").includes(m)) ?? ""
        const effort = chatEfforts.includes(r.effort ?? "") ? r.effort ?? "" : ""
        return { pct: r.pct, tokens: r.tokens, size: r.size, model, effort }
    }
    catch {
        return null
    }
}

/*  the defaults of the agent tool (the model and effort without "--model" and "--effort"): the ones it
    reported for a process started without them since the start of the service, else the ones of its
    settings (the most specific settings file first), else unknown (the empty string)  */
const observed = { model: "", efforts: new Map<string, string>() }
const setting = (key: string): string => {
    const config = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")
    const dir    = Task.projectRoot()
    for (const file of [ path.join(dir, ".claude", "settings.local.json"), path.join(dir, ".claude", "settings.json"),
        path.join(config, "settings.json") ])
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
export const chatDefaults = (model: string): Config => {
    const effort = setting("effortLevel")
    return {
        model:  observed.model !== "" ? observed.model : chatModels.find((m) => m !== "" && setting("model").includes(m)) ?? "",
        effort: observed.efforts.get(model) ?? (chatEfforts.includes(effort) ? effort : "")
    }
}
export const chatLearn = (args: string[], report: ChatReport): void => {
    if (report.model !== "" && report.effort !== "" && !args.includes("--effort"))
        observed.efforts.set(report.model, report.effort)
    if (report.model !== "" && !args.includes("--model") && !args.includes("--resume"))
        observed.model = report.model
}

/*  the system prompt appended to the chat of a task  */
const chatPrompt = (id: string): string =>
    `This session works on the ASE task "${id}" (the current task). You may edit only this task. ` +
    "You may only CREATE other tasks (\"ase task save -c\") and never change them afterwards, " +
    "as further edits of a new task happen in the own chat of that task. " +
    `"This task", "the task", "dieser Task", and "der Task" always mean the task "${id}". ` +
    `Call the ASE task skills either with the id "${id}" or without any id (they default to the current task), ` +
    "and never pass words of the user (like \"this\" or \"dieser\") as the task id argument."

/*  the further arguments of the agent tool of the chat of a task: its model (the default one passed
    explicitly on resuming, as the agent tool otherwise keeps the model of the session) and effort,
    the system prompt, and the settings with the guard hook, the status line, and (for a client
    mapping the 256-color palette, see "chatSpec") the fixed dark color theme  */
export const chatExtraArgs = (id: string, resume: boolean, dark: boolean): string[] => {
    const config = chatConfig(id)
    const args   = [] as string[]
    const model  = config.model !== "" ? config.model : resume ? chatDefaults("").model : ""
    if (model !== "")
        args.push("--model", model)
    if (config.effort !== "")
        args.push("--effort", config.effort)
    args.push("--append-system-prompt", chatPrompt(id))
    const dir = path.dirname(fileURLToPath(import.meta.url))
    args.push("--settings", JSON.stringify({
        ...(dark ? { theme: "dark" } : {}),
        hooks:      {
            PreToolUse: [ {
                hooks: [ {
                    type: "command",
                    command: quote([ process.execPath, path.join(dir, "ase-task-chat-guard-cli.js") ])
                } ]
            } ]
        },
        statusLine: {
            type: "command", padding: 0,
            command: quote([ process.execPath, path.join(dir, "ase-task-chat-statusline-cli.js"), contextFile(id) ])
        }
    }))
    return args
}

