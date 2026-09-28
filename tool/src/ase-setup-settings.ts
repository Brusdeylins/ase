/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                from "node:fs/promises"
import os                from "node:os"
import path              from "node:path"

import writeFileAtomic   from "write-file-atomic"
import { mkdirp }        from "mkdirp"
import JsonAsty          from "json-asty"
import type { AstNode }  from "json-asty"

import type Log          from "./ase-lib-log.js"
import { toolSpecs }     from "./ase-setup-common.js"
import type { Tool, Scope } from "./ase-setup-common.js"

/*  settings file handling of "ase setup statusline" and the output style  */
export class SetupSettings {
    constructor (private log: Log) {}

    /*  the default "ase statusline" format lines used when the user does
        not override them with positional arguments to "activate"  */
    private readonly statuslineFormatDflt = [
        "<blue>%u</blue> <red>%p</red> <black>%T</black> %s",
        "%m %e %t",
        "%P %h %B %c"
    ]

    /*  resolve the tool settings file for a given installation scope  */
    private settingsFile (tool: Tool, scope: Scope): string {
        if (tool === "copilot") {
            const home = process.env.COPILOT_HOME ?? ""
            const base = home !== "" ? home : path.join(os.homedir(), ".copilot")
            return path.join(base, "settings.json")
        }
        else if (scope === "project")
            return path.join(process.cwd(), ".claude", "settings.json")
        else if (scope === "local")
            return path.join(process.cwd(), ".claude", "settings.local.json")
        else
            return path.join(os.homedir(), ".claude", "settings.json")
    }

    /*  reject the statusline operation for tools without a scriptable
        statusline mechanism (only the OpenAI Codex CLI lacks one)  */
    private requireStatuslineTool (tool: Tool): void {
        if (tool === "codex")
            throw new Error("statusline configuration is not supported for --tool codex " +
                `(the ${toolSpecs[tool].label} has no scriptable statusline mechanism)`)
    }

    /*  reject a non-default --scope for the GitHub Copilot CLI, which has a
        single per-user settings file and thus no scope concept  */
    private requireStatuslineScope (tool: Tool, scope: Scope): void {
        if (tool === "copilot" && scope !== "user")
            throw new Error("--scope is only supported for --tool claude " +
                `(the ${toolSpecs[tool].label} has a single per-user settings file)`)
    }

    /*  build the "ase statusline ..." command string from the activate
        options and the effective format lines  */
    private statuslineCommand (tool: Tool, opts: { width: number, margin: number, padding: number, icons: boolean, labels: boolean }, format: string[]): string {
        const parts = [ "ase", "statusline", "--tool", tool, "-w", String(opts.width), "-m", String(opts.margin),
            "-p", String(opts.padding) ]
        if (!opts.icons)
            parts.push("--no-icons")
        if (!opts.labels)
            parts.push("--no-labels")
        const lines = format.length > 0 ? format : this.statuslineFormatDflt
        for (const line of lines)
            parts.push(`'${line.replace(/'/g, "'\\''")}'`)
        return parts.join(" ")
    }

    /*  determine whether an existing "statusLine" value object is owned by us  */
    private statuslineIsOwned (member: AstNode): boolean {
        const obj = member.query("/ * [ pos() == 2 ]")[0]
        if (obj === undefined)
            return false
        for (const m of obj.query("/ member")) {
            const key = m.query("/ string [ pos() == 1 ]")[0]
            if (key !== undefined && key.get("value") === "command") {
                const val = m.query("/ string [ pos() == 2 ]")[0]
                const cmd = val !== undefined ? String(val.get("value") ?? "") : ""
                return cmd.startsWith("ase statusline")
            }
        }
        return false
    }

    /*  locate a top-level member node by key within the root object  */
    private settingsFindMember (root: AstNode, name: string): AstNode | undefined {
        for (const m of root.query("/ member")) {
            const key = m.query("/ string [ pos() == 1 ]")[0]
            if (key !== undefined && key.get("value") === name)
                return m
        }
        return undefined
    }

    /*  build the "statusLine" member subtree natively inside the target
        AST, reproducing the exact whitespace tokens json-asty emits for a
        canonically 4-space-indented settings.json  */
    private statuslineBuildMember (root: AstNode, command: string): AstNode {
        const member = (key: string, val: string | number, epilog?: string): AstNode => {
            const type = typeof val === "number" ? "number"    : "string"
            const body = typeof val === "number" ? String(val) : JSON.stringify(val)
            const k = root.create("string").set({ body: JSON.stringify(key), value: key, epilog: ": " })
            const v = root.create(type).set({ body, value: val })
            const m = root.create("member")
            if (epilog !== undefined)
                m.set({ epilog })
            return m.add(k, v)
        }
        const obj = root.create("object").set({ prolog: "{\n        ", epilog: "\n    }\n" })
        obj.add(
            member("type",    "command", ",\n        "),
            member("command", command,   ",\n        "),
            member("padding", 0)
        )
        const key = root.create("string").set({
            body:  JSON.stringify("statusLine"),
            value: "statusLine",
            epilog: ": "
        })
        return root.create("member").add(key, obj)
    }

    /*  normalize the previous-last member so a following ",\n    " comma reads cleanly  */
    private settingsMakeNonLast (member: AstNode): void {
        const val = member.query("/ * [ pos() == 2 ]")[0]
        if (val !== undefined) {
            const ep = val.get("epilog")
            if (typeof ep === "string" && ep.endsWith("\n"))
                val.set({ epilog: ep.replace(/\n$/, "") })
        }
        member.set({ epilog: ",\n    " })
    }

    /*  append a member to the root object, repairing the whitespace at
        the seam: a scalar value carries no pre-"}" newline of its own
        (a container value carries it in its own epilog already), so the
        root epilog has to supply it  */
    private settingsAddMember (root: AstNode, member: AstNode, scalar: boolean): void {
        const members = root.query("/ member")
        if (members.length === 0)
            root.set({ prolog: "{\n    " })
        else
            this.settingsMakeNonLast(members[members.length - 1]!)
        root.set({ epilog: scalar ? "\n}\n" : "}\n" })
        root.add(member)
    }

    /*  remove a member from the root object, repairing the whitespace at the seam  */
    private settingsRemoveMember (root: AstNode, target: AstNode): void {
        const members = root.query("/ member")
        const wasLast = members[members.length - 1] === target
        root.del(target)
        if (wasLast) {
            if (members.length > 1) {
                /*  promote the new last member: strip its comma epilog and
                    restore the pre-"}" newline into the root epilog when the
                    new-last value is a scalar (a container value carries the
                    newline in its own epilog already)  */
                const newLast = members[members.length - 2]!
                newLast.set({ epilog: undefined })
                const val = newLast.query("/ * [ pos() == 2 ]")[0]
                const ep  = val !== undefined ? val.get("epilog") : undefined
                root.set({ epilog: (typeof ep === "string" && ep.endsWith("\n")) ? "}\n" : "\n}\n" })
            }
            else
                root.set({ epilog: "}\n" })
        }
    }

    /*  read a settings.json file into a JSON-ASTy AST  */
    private async settingsReadAst (file: string): Promise<AstNode> {
        let text = ""
        try {
            text = await fs.readFile(file, "utf8")
        }
        catch (err: unknown) {
            /*  missing file: start from an empty object  */
            if ((err as NodeJS.ErrnoException).code !== "ENOENT")
                throw err
        }
        if (text.trim() === "")
            text = "{}"
        return JsonAsty.parse(text)
    }

    /*  write a JSON-ASTy AST back to a settings.json file  */
    private async settingsWriteAst (file: string, root: AstNode): Promise<void> {
        await mkdirp(path.dirname(file))
        const text = JsonAsty.unparse(root)
        await writeFileAtomic(file, text, { encoding: "utf8" })
    }

    /*  handler for "ase setup statusline activate"  */
    async doStatuslineActivate (tool: Tool, scope: Scope,
        opts: { width: number, margin: number, padding: number, icons: boolean, labels: boolean }, format: string[]): Promise<number> {
        this.requireStatuslineTool(tool)
        this.requireStatuslineScope(tool, scope)
        const file    = this.settingsFile(tool, scope)
        const command = this.statuslineCommand(tool, opts, format)
        const root    = await this.settingsReadAst(file)

        const existing = this.settingsFindMember(root, "statusLine")
        if (existing !== undefined) {
            /*  preserve a foreign, hand-crafted statusLine: skip and warn  */
            if (!this.statuslineIsOwned(existing)) {
                this.log.write("warning", "setup: statusline: activate: a non-ASE \"statusLine\" " +
                    `is already present in ${file}: preserving it (skipped)`)
                return 0
            }
            /*  replace the value object in place, preserving its epilog  */
            const valNew = this.statuslineBuildMember(root, command).query("/ object")[0]!
            const valOld = existing.query("/ * [ pos() == 2 ]")[0]!
            valNew.set({ epilog: valOld.get("epilog") })
            existing.del(valOld).add(valNew)
            this.log.write("info", `setup: statusline: activate: updating ASE "statusLine" in ${file}`)
        }
        else {
            /*  insert a fresh statusLine member  */
            this.settingsAddMember(root, this.statuslineBuildMember(root, command), false)
            this.log.write("info", `setup: statusline: activate: adding ASE "statusLine" to ${file}`)
        }
        await this.settingsWriteAst(file, root)
        return 0
    }

    /*  handler for "ase setup statusline deactivate"  */
    async doStatuslineDeactivate (tool: Tool, scope: Scope): Promise<number> {
        this.requireStatuslineTool(tool)
        this.requireStatuslineScope(tool, scope)
        const file = this.settingsFile(tool, scope)

        /*  a missing settings file means nothing to remove  */
        try {
            await fs.access(file)
        }
        catch {
            this.log.write("info", `setup: statusline: deactivate: no settings file ${file} (skipped)`)
            return 0
        }

        /*  read file  */
        const root   = await this.settingsReadAst(file)
        const target = this.settingsFindMember(root, "statusLine")
        if (target === undefined) {
            this.log.write("info", `setup: statusline: deactivate: no "statusLine" in ${file} (skipped)`)
            return 0
        }

        /*  preserve a foreign, hand-crafted statusLine: skip and warn  */
        if (!this.statuslineIsOwned(target)) {
            this.log.write("warning", "setup: statusline: deactivate: a non-ASE \"statusLine\" " +
                `is present in ${file}: preserving it (skipped)`)
            return 0
        }

        /*  remove the member and repair the whitespace at the seam  */
        this.settingsRemoveMember(root, target)
        await this.settingsWriteAst(file, root)
        this.log.write("info", `setup: statusline: deactivate: removing ASE "statusLine" from ${file}`)
        return 0
    }

    /*  probe the ASE statusline registrations by inspecting the tool
        settings files of all applicable installation scopes  */
    async statuslineStatus (tool: Tool): Promise<{ file: string, scope: string, status: string }[]> {
        /*  the OpenAI Codex CLI has no scriptable statusline mechanism at all  */
        if (tool === "codex")
            return []
        const home    = os.homedir()
        const scopes: Scope[] = tool === "claude" ? [ "user", "project", "local" ] : [ "user" ]
        const entries: { file: string, scope: string, status: string }[] = []
        for (const scope of scopes) {
            const file = this.settingsFile(tool, scope)
            let root: AstNode
            try {
                root = await this.settingsReadAst(file)
            }
            catch {
                /*  an unparsable settings file carries no usable state  */
                continue
            }
            const member = this.settingsFindMember(root, "statusLine")
            if (member === undefined)
                continue
            entries.push({
                file:   file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file,
                scope:  tool === "claude" ? scope : "(n/a)",
                status: this.statuslineIsOwned(member) ? "activated" : "foreign"
            })
        }
        return entries
    }

    /*  determine whether an existing "outputStyle" value is owned by us  */
    private outputStyleIsOwned (member: AstNode): boolean {
        const val = member.query("/ string [ pos() == 2 ]")[0]
        return val !== undefined && val.get("value") === "ase:ase-terse"
    }

    /*  build the "outputStyle" member subtree natively inside the target AST  */
    private outputStyleBuildMember (root: AstNode): AstNode {
        const key = root.create("string").set({ body: JSON.stringify("outputStyle"), value: "outputStyle", epilog: ": " })
        const val = root.create("string").set({ body: JSON.stringify("ase:ase-terse"), value: "ase:ase-terse" })
        return root.create("member").add(key, val)
    }

    /*  activate the plugin-shipped ASE output style by selecting it in
        the settings file of the scope (Anthropic Claude Code CLI only:
        the other tools have no output style concept, so the session-start
        hook injects the style into their session context instead)  */
    async outputStyleActivate (action: string, scope: Scope): Promise<void> {
        const file     = this.settingsFile("claude", scope)
        const root     = await this.settingsReadAst(file)
        const existing = this.settingsFindMember(root, "outputStyle")
        if (existing !== undefined) {
            /*  preserve a foreign, hand-selected outputStyle: skip and warn  */
            if (!this.outputStyleIsOwned(existing))
                this.log.write("warning", `setup: ${action}: a non-ASE "outputStyle" ` +
                    `is already selected in ${file}: preserving it (skipped)`)
            return
        }
        this.settingsAddMember(root, this.outputStyleBuildMember(root), true)
        await this.settingsWriteAst(file, root)
        this.log.write("info", `setup: ${action}: selecting ASE "outputStyle" in ${file}`)
    }

    /*  deactivate the plugin-shipped ASE output style by removing its
        selection from the settings file of the scope (Anthropic Claude Code CLI only)  */
    async outputStyleDeactivate (action: string, scope: Scope): Promise<void> {
        const file = this.settingsFile("claude", scope)

        /*  a missing settings file means nothing to remove  */
        try {
            await fs.access(file)
        }
        catch {
            return
        }
        const root   = await this.settingsReadAst(file)
        const target = this.settingsFindMember(root, "outputStyle")
        if (target === undefined)
            return

        /*  preserve a foreign, hand-selected outputStyle: skip and warn  */
        if (!this.outputStyleIsOwned(target)) {
            this.log.write("warning", `setup: ${action}: a non-ASE "outputStyle" ` +
                `is selected in ${file}: preserving it (skipped)`)
            return
        }
        this.settingsRemoveMember(root, target)
        await this.settingsWriteAst(file, root)
        this.log.write("info", `setup: ${action}: deselecting ASE "outputStyle" in ${file}`)
    }

    /*  probe the output style selections by inspecting the tool
        settings files of all installation scopes (Anthropic Claude Code CLI only)  */
    async outputStyleStatus (tool: Tool): Promise<{ file: string, scope: string, status: string }[]> {
        if (tool !== "claude")
            return []
        const home    = os.homedir()
        const scopes: Scope[] = [ "user", "project", "local" ]
        const entries: { file: string, scope: string, status: string }[] = []
        for (const scope of scopes) {
            const file = this.settingsFile(tool, scope)
            let root: AstNode
            try {
                root = await this.settingsReadAst(file)
            }
            catch {
                /*  an unparsable settings file carries no usable state  */
                continue
            }
            const member = this.settingsFindMember(root, "outputStyle")
            if (member === undefined)
                continue
            entries.push({
                file:   file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file,
                scope,
                status: this.outputStyleIsOwned(member) ? "selected" : "foreign"
            })
        }
        return entries
    }
}

