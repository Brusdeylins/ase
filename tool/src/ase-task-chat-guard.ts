/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { parse as shParse } from "shell-quote"

/*  the "ase task" sub-commands whose first positional argument is the task they change (a
    "save" only if it does not create), "purge" changes all old tasks, and "status" and
    "assign" change a task only with a second argument (as the one of a single argument
    is the status resp. assignee of the current task)  */
const taskCommands = [ "save", "edit", "delete", "rename", "request" ]
const pairCommands = [ "status", "assign" ]

/*  the options of "ase task" sub-commands taking a value  */
const valueOptions = [ "-s", "--session" ]

/*  split a shell command into the argument lists of its simple commands, skipping the
    bodies of here-documents and resolving the variables of the environment  */
const simpleCommands = (command: string): string[][] => {
    const lines = [] as string[]
    let ending  = ""
    for (const line of command.split(/\r?\n/)) {
        if (ending !== "") {
            if (line.trim() === ending)
                ending = ""
            continue
        }
        lines.push(line)
        ending = /<<-?\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(line)?.slice(1).find((m) => m !== undefined) ?? ""
    }
    const commands = [] as string[][]
    for (const line of lines) {
        let words = [] as string[]
        for (const entry of shParse(line, process.env as Record<string, string>)) {
            if (typeof entry === "string")
                words.push(entry)
            else if ("pattern" in entry)
                words.push(entry.pattern)
            else if ("op" in entry && words.length > 0) {
                commands.push(words)
                words = []
            }
        }
        if (words.length > 0)
            commands.push(words)
    }
    return commands
}

/*  determine the task a shell command changes by "ase task", if it is not the given one  */
const foreignByShell = (taskId: string, command: string): string => {
    for (const words of simpleCommands(command)) {
        /*  skip the environment assignments and prefix commands, and the path of the program  */
        let i = 0
        while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || [ "env", "command", "exec", "time", "nohup" ].includes(words[i])))
            i++
        if (words[i]?.split("/").pop() !== "ase" || words[i + 1] !== "task")
            continue
        const sub  = words[i + 2] ?? ""
        const args = [] as string[]
        let create = false
        for (let j = i + 3; j < words.length; j++) {
            if (valueOptions.includes(words[j]))
                j++
            else if (words[j] === "-c" || words[j] === "--create")
                create = true
            else if (!words[j].startsWith("-"))
                args.push(words[j])
        }
        if (sub === "purge")
            return "purge"
        if (sub === "save" && create)
            continue
        if (taskCommands.includes(sub) && args.length >= 1 && args[0] !== taskId)
            return args[0]
        if (pairCommands.includes(sub) && args.length >= 2 && args[0].replace(/:$/, "") !== taskId)
            return args[0].replace(/:$/, "")
    }
    return ""
}

/*  determine the task an ASE MCP task tool changes, if it is not the given one  */
const foreignByTool = (taskId: string, tool: string, input: Record<string, unknown>): string => {
    const sub = /^mcp__(?:plugin_ase_)?ase__ase_task_([a-z]+)$/.exec(tool)?.[1] ?? ""
    const str = (key: string): string => typeof input[key] === "string" ? input[key] : ""
    const id  = str(sub === "rename" ? "old" : "id")
    if (sub === "save")
        return input.create === true || id === taskId ? "" : id || "?"
    if (sub === "delete" || sub === "rename" || sub === "request" || sub === "assign")
        return id === taskId ? "" : id || "?"
    if ((sub === "status" && str("status") !== "") || (sub === "id" && id !== ""))
        return id === taskId ? "" : id || "?"
    return ""
}

/*  guard the tools of a chat bound to a task: determine the reason to deny a tool
    invocation which changes another task than the given one (or purges the tasks), or
    the empty string if it is fine, where the creation of further tasks is always fine  */
export const taskGuard = (taskId: string, tool: string, input: Record<string, unknown>): string => {
    const foreign = tool === "Bash" && typeof input.command === "string" ?
        foreignByShell(taskId, input.command) : foreignByTool(taskId, tool, input)
    if (foreign === "")
        return ""
    return foreign === "purge" ?
        `ASE: this chat works on the task "${taskId}" only, so it must not purge tasks` :
        `ASE: this chat works on the task "${taskId}" only, so it must not change the task "${foreign}": ` +
        "other tasks may only be created (\"ase task save -c\"), and further edits of a new task happen in its own chat"
}

/*  the answer of a "PreToolUse" hook of the agent tool for the payload of a tool invocation of the chat
    of the given task, as JSON text: the denial with its reason, or the empty string if it is fine  */
export const taskGuardAnswer = (taskId: string, payload: unknown): string => {
    const event  = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {}
    const input  = typeof event.tool_input === "object" && event.tool_input !== null ? event.tool_input as Record<string, unknown> : {}
    const reason = typeof event.tool_name === "string" ? taskGuard(taskId, event.tool_name, input) : ""
    return reason === "" ? "" : JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason }
    })
}

