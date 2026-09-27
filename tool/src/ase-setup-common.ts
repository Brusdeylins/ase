/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                from "node:fs/promises"
import path              from "node:path"

import { execa }         from "execa"
import which             from "which"

import type Log          from "./ase-lib-log.js"

/*  type of supported tool (host) systems  */
export type Tool = "claude" | "copilot" | "codex"

/*  type of supported plugin/MCP installation scopes (Anthropic Claude Code CLI only)  */
export type Scope = "user" | "project" | "local"

/*  per-tool dispatch table for the parts that actually differ between
    Anthropic Claude Code CLI, GitHub Copilot CLI, and OpenAI Codex CLI plugin
    marketplace integrations  */
export type ToolSpec = {
    cli:       string
    label:     string
    pInstall:  string  /*  plugin subcommand to install   a plugin  */
    pRemove:   string  /*  plugin subcommand to uninstall a plugin  */
    pUpdate:   string  /*  plugin marketplace subcommand to refresh a snapshot  */
}
export const toolSpecs: Record<Tool, ToolSpec> = {
    "claude":  { cli: "claude",  label: "Anthropic Claude Code CLI", pInstall: "install", pRemove: "uninstall", pUpdate: "update"  },
    "copilot": { cli: "copilot", label: "GitHub Copilot CLI",        pInstall: "install", pRemove: "uninstall", pUpdate: "update"  },
    "codex":   { cli: "codex",   label: "OpenAI Codex CLI",          pInstall: "add",     pRemove: "remove",    pUpdate: "upgrade" }
}

/*  parse and validate the --tool option  */
export const parseTool = (value: string): Tool => {
    if (value !== "claude" && value !== "copilot" && value !== "codex")
        throw new Error(`invalid --tool value: "${value}" (expected "claude", "copilot", or "codex")`)
    return value
}

/*  parse and validate the --scope option  */
export const parseScope = (value: string): Scope => {
    if (value !== "user" && value !== "project" && value !== "local")
        throw new Error(`invalid --scope value: "${value}" (expected "user", "project", or "local")`)
    return value
}

/*  reject a non-default --scope for tools which have no scope concept
    at all (only Anthropic Claude Code CLI supports plugin/MCP scopes)  */
export const requireClaudeScope = (tool: Tool, scope: Scope): void => {
    if (tool !== "claude" && scope !== "user")
        throw new Error("--scope is only supported for --tool claude")
}

/*  sub-process runner of "ase setup"  */
export class SetupRunner {
    constructor (private log: Log) {}

    /*  ensure a tool is available  */
    async ensureTool (tool: string) {
        return which(tool).catch(() => {
            throw new Error(`mandatory tool "${tool}" not found in $PATH`)
        })
    }

    /*  determine whether a global "npm" operation requires "sudo" by
        checking whether the npm global install root is writable by the
        current user; on Windows or when already running as root, no
        elevation is needed  */
    private async npmGlobalNeedsSudo (): Promise<boolean> {
        /*  Windows has no "sudo" concept here  */
        if (process.platform === "win32")
            return false

        /*  already running as root  */
        const getuid = (process as unknown as { getuid?: () => number }).getuid
        if (typeof getuid === "function" && getuid.call(process) === 0)
            return false

        /*  determine the npm global prefix and probe writability of the
            directories that "npm -g" actually mutates  */
        let prefix: string
        try {
            const result = await execa("npm", [ "prefix", "-g" ], { stdio: "pipe" })
            prefix = result.stdout.trim()
        }
        catch {
            /*  if we cannot determine the prefix, fall back to "no sudo"  */
            return false
        }
        if (prefix === "")
            return false
        const candidates = [
            prefix,
            path.join(prefix, "bin"),
            path.join(prefix, "lib", "node_modules")
        ]
        const accessible = (dir: string, mode: number): Promise<boolean> =>
            fs.access(dir, mode).then(() => true, () => false)
        for (const dir of candidates) {
            /*  a writable directory needs no elevation at all  */
            if (await accessible(dir, fs.constants.W_OK))
                continue

            /*  the directory exists, but is not writable: require sudo  */
            if (await accessible(dir, fs.constants.F_OK))
                return true

            /*  the directory does not exist: require sudo unless it can
                be created inside a writable parent directory  */
            if (!(await accessible(path.dirname(dir), fs.constants.W_OK)))
                return true
        }
        return false
    }

    /*  build the (cmd, args) pair for an "npm" invocation, prefixing
        with "sudo" when necessary for global operations  */
    async npmCmd (args: string[], global: boolean): Promise<{ cmd: string, args: string[] }> {
        if (global && await this.npmGlobalNeedsSudo()) {
            const sudo = await which("sudo").catch(() => "")
            if (sudo !== "") {
                this.log.write("info",
                    "setup: npm global install root not writable: using \"sudo\"")
                return { cmd: "sudo", args: [ "npm", ...args ] }
            }
            this.log.write("warning",
                "setup: npm global install root is not writable by current user " +
                "and \"sudo\" not found in $PATH: attempting without elevation")
        }
        return { cmd: "npm", args }
    }

    /*  run a sub-process, suppressing output on success and emitting it on failure  */
    async run (cmd: string, args: string[], opts: { cwd?: string, quiet?: boolean, retries?: number, ignoreError?: string } = {}): Promise<void> {
        const { cwd, quiet = false, retries = 1, ignoreError } = opts
        const argsLog = args.map((arg) => arg.replace(/(\w*key=)([^\s&]+)/gi, (_, k, v) => k + "*".repeat(v.length)))
        this.log.write("info", `setup: $ ${cmd} ${argsLog.join(" ")}` +
            (cwd !== undefined ? ` (cwd: ${cwd})` : ""))
        for (let i = 0; i < retries; i++) {
            const final = (i === retries - 1)
            try {
                await execa(cmd, args, { stdio: quiet ? "ignore" : "pipe", cwd })
                return
            }
            catch (err: unknown) {
                if (!final) {
                    this.log.write("info",
                        `setup: attempt ${i + 1}/${retries} failed for "${cmd} ${argsLog.join(" ")}": retrying...`)
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    continue
                }
                if (ignoreError !== undefined) {
                    this.log.write("info", `setup: ${ignoreError} (skipped)`)
                    return
                }
                const e = err as { exitCode?: number, stdout?: string, stderr?: string }
                const exitCode = typeof e.exitCode === "number" ? e.exitCode : -1
                this.log.write("error", `setup: command failed: exit code: ${exitCode}`)
                if (typeof e.stdout === "string" && e.stdout.length > 0) {
                    this.log.write("error", "setup: command failed: stdout:")
                    process.stdout.write(e.stdout)
                }
                if (typeof e.stderr === "string" && e.stderr.length > 0) {
                    this.log.write("error", "setup: command failed: stderr:")
                    process.stderr.write(e.stderr)
                }
                throw err
            }
        }
    }
}

