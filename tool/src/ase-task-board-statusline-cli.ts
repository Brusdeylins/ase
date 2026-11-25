/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                from "node:fs"
import path              from "node:path"
import os                from "node:os"
import { spawnSync }     from "node:child_process"

/*  the standalone status line program of the chats of the task boards: it records the context usage of
    the chat (the percentage, its tokens and the size of the window, as reported by the agent tool) into the
    file of its first argument, for the footer of the chat, and then runs the status line command the user
    configured (if any), passing it the same input and printing its output, so the status line of the chat
    stays the usual one  */
type Payload = {
    cwd?:       string
    workspace?: { current_dir?: string }
    model?:     { id?: string }
    effort?:    { level?: string }
    context_window?: {
        used_percentage?:     number | null
        context_window_size?: number
        current_usage?: {
            input_tokens?: number, cache_creation_input_tokens?: number, cache_read_input_tokens?: number
        } | null
    }
}

/*  determine the status line command of the settings of the user (the most specific settings file first)  */
const userCommand = (dir: string): string => {
    const config = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")
    for (const file of [ path.join(dir, ".claude", "settings.local.json"), path.join(dir, ".claude", "settings.json"), path.join(config, "settings.json") ])
        try {
            const line = (JSON.parse(fs.readFileSync(file, "utf8")) as { statusLine?: { type?: string, command?: string } }).statusLine
            if (line?.type === "command" && typeof line.command === "string")
                return line.command
        }
        catch {
            /*  no such settings file, or an unreadable one  */
        }
    return ""
}

const chunks = [] as Buffer[]
process.stdin.on("data", (chunk: Buffer) => { chunks.push(chunk) })
process.stdin.on("end", () => {
    const input = Buffer.concat(chunks).toString("utf8")
    let dir = process.cwd()
    try {
        const payload = JSON.parse(input) as Payload
        dir = payload.workspace?.current_dir ?? payload.cwd ?? dir
        const cw     = payload.context_window
        const usage  = cw?.current_usage
        const tokens = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0)
        if (typeof cw?.context_window_size === "number") {
            fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true })
            fs.writeFileSync(process.argv[2], JSON.stringify({
                pct: cw.used_percentage ?? 0, tokens, size: cw.context_window_size, model: payload.model?.id, effort: payload.effort?.level, at: Date.now()
            }))
        }
    }
    catch {
        /*  an unreadable input is not recorded  */
    }
    const command = userCommand(dir)
    if (command !== "")
        process.stdout.write(spawnSync("sh", [ "-c", command ], { input, encoding: "utf8", cwd: dir }).stdout)
})
