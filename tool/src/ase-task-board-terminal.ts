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

/*  whether the session of the agent tool already exists (as it then has to be resumed, not created)  */
const sessionExists = (session: string): boolean => {
    const root = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "projects")
    try {
        return fs.readdirSync(root).some((dir) => fs.existsSync(path.join(root, dir, `${session}.jsonl`)))
    }
    catch {
        return false
    }
}

/*  the file recording the context usage of the chat of a task (see "ase-task-board-statusline-cli")  */
const contextFile = (id: string): string =>
    path.join(userStateDir(), "board", `${Task.projectIdOf(Task.projectRoot())}-chat-context`, `${id}.json`)

/*  the context usage of the chat of a task as last reported by the agent tool (its percentage, tokens, and
    window size) since the given time (the start of its process), if any, as the report of an earlier process
    (or session) is stale  */
export const terminalContext = (id: string, since: number): { pct: number, tokens: number, size: number } | null => {
    try {
        const { pct, tokens, size, at } = JSON.parse(fs.readFileSync(contextFile(id), "utf8")) as { pct: number, tokens: number, size: number, at?: number }
        return typeof at === "number" && at >= since ? { pct, tokens, size } : null
    }
    catch {
        return null
    }
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
    if (chat.model !== "")
        args.push("--model", chat.model)
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
