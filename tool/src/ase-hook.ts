/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import path           from "node:path"
import fs             from "node:fs"

import { Command }    from "commander"
import { execaSync }  from "execa"

import type Log       from "./ase-log.js"

/*  CLI command "ase hook"  */
export default class HookCommand {
    constructor (private log: Log) {}

    /*  handler for "ase hook session-start"  */
    private doSessionStart (): number {
        /*  determine plugin root  */
        const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? ""
        if (pluginRoot === "")
            throw new Error("CLAUDE_PLUGIN_ROOT environment variable is not set")

        /*  determine path to external files  */
        const filePkg = path.join(pluginRoot, ".claude-plugin", "plugin.json")
        const fileMd  = path.join(pluginRoot, "meta", "ase-constitution.md")

        /*  read external files  */
        const pkg = fs.readFileSync(filePkg, "utf8")
        let   md  = fs.readFileSync(fileMd,  "utf8")

        /*  determine own version  */
        const version = (JSON.parse(pkg).version as string | undefined) ?? ""

        /*  read session information  */
        const stdin = fs.readFileSync(0, "utf8")
        const input = stdin.trim() !== "" ? JSON.parse(stdin) as { session_id?: string } : {}

        /*  determine session id  */
        const sessionId = input.session_id ?? ""

        /*  determine task id  */
        const taskId = process.env.ASE_TASK_ID ?? "default"
        try {
            execaSync("ase",
                [ "config", `--scope=session:${sessionId}`, "set", "task.id", taskId ],
                { stdio: [ "ignore", "ignore", "ignore" ] })
        }
        catch (_e) {
            /*  best-effort: ignore failures  */
        }

        /*  provide session and task id to Claude Code shell commands  */
        const envFile = process.env.CLAUDE_ENV_FILE ?? ""
        if (envFile !== "") {
            const script =
                `export ASE_VERSION="${version}"\n` +
                `export ASE_SESSION_ID="${sessionId}"\n` +
                `export ASE_TASK_ID="${taskId}"\n`
            fs.appendFileSync(envFile, script, "utf8")
        }

        /*  prepend ASE information to constitution markdown  */
        md =
            `<ase-version>${version}</ase-version>\n` +
            `<ase-task-id>${taskId}</ase-task-id>\n` +
            `<ase-session-id>${sessionId}</ase-session-id>\n` +
            "\n" + md

        /*  inject markdown into session context  */
        process.stdout.write(JSON.stringify({
            "hookSpecificOutput": {
                "hookEventName":    "SessionStart",
                "additionalContext": md
            }
        }))
        return 0
    }

    /*  register commands  */
    register (program: Command): void {
        /*  register CLI top-level command "ase hook"  */
        const hookCmd = program
            .command("hook")
            .description("Claude Code hook entry points")
            .action(() => {
                hookCmd.outputHelp()
                process.exit(1)
            })

        /*  register CLI sub-command "ase hook session-start"  */
        hookCmd
            .command("session-start")
            .description("handle Claude Code SessionStart hook event")
            .action(() => {
                process.exit(this.doSessionStart())
            })
    }
}
