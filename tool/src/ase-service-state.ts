/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { z }                  from "zod"
import type { McpServer }     from "@modelcontextprotocol/sdk/server/mcp.js"

import type Log               from "./ase-lib-log.js"
import { sessionState }       from "./ase-config-core.js"

/*  the keys of the internal session state  */
const stateKeys = [ "basedir", "task", "skill" ] as const

/*  render a caught error as an MCP tool error result  */
const mcpToolError = (err: unknown) => ({
    isError: true,
    content: [ { type: "text" as const, text: `ERROR: ${err instanceof Error ? err.message : String(err)}` } ]
})

/*  MCP registration entry point for the internal session state access  */
export class StateMCP {
    constructor (private log: Log) {}

    /*  register the MCP tools  */
    register (mcp: McpServer): void {
        /*  state get  */
        mcp.registerTool("ase_state_get", {
            title: "ASE state get",
            description:
                "Read the value of a `key` from the internal state of a `session`: " +
                "`basedir` (the project directory, recorded for GitHub Copilot CLI only), " +
                "`task` (the id of the active task), or `skill` (the id of the active " +
                "edit-capable skill). Returns the value as `text`; returns an empty string " +
                "if no value is set.",
            inputSchema: {
                key: z.enum(stateKeys)
                    .describe("state key (\"basedir\", \"task\", or \"skill\")"),
                session: z.string()
                    .describe("session identifier (allowed characters: A-Z, a-z, 0-9, '.', '_', '-')")
            }
        }, async (args) => {
            try {
                const state = sessionState(this.log, args.session)
                state.read()
                const val = state.get(args.key)
                return { content: [ { type: "text", text: typeof val === "string" ? val : "" } ] }
            }
            catch (err: unknown) {
                return mcpToolError(err)
            }
        })

        /*  state set  */
        mcp.registerTool("ase_state_set", {
            title: "ASE state set",
            description:
                "Write the non-empty `val` to a `key` of the internal state of a `session`. " +
                "The value is validated against the state schema before being persisted.",
            inputSchema: {
                key: z.enum(stateKeys)
                    .describe("state key (\"basedir\", \"task\", or \"skill\")"),
                val: z.string().min(1)
                    .describe("value to store under `key`"),
                session: z.string()
                    .describe("session identifier (allowed characters: A-Z, a-z, 0-9, '.', '_', '-')")
            }
        }, async (args) => {
            try {
                const state = sessionState(this.log, args.session)
                state.lock(() => {
                    state.read()
                    state.set(args.key, args.val)
                    state.write()
                })
                return { content: [ { type: "text", text: `OK: stored "${args.key}" for session "${args.session}"` } ] }
            }
            catch (err: unknown) {
                return mcpToolError(err)
            }
        })

        /*  state delete  */
        mcp.registerTool("ase_state_delete", {
            title: "ASE state delete",
            description:
                "Delete the value of a `key` from the internal state of a `session`. " +
                "No-op if the key is not present.",
            inputSchema: {
                key: z.enum(stateKeys)
                    .describe("state key (\"basedir\", \"task\", or \"skill\")"),
                session: z.string()
                    .describe("session identifier (allowed characters: A-Z, a-z, 0-9, '.', '_', '-')")
            }
        }, async (args) => {
            try {
                const state = sessionState(this.log, args.session)
                state.lock(() => {
                    state.read()
                    state.delete(args.key)
                    state.write()
                })
                return { content: [ { type: "text", text: `OK: removed "${args.key}" for session "${args.session}"` } ] }
            }
            catch (err: unknown) {
                return mcpToolError(err)
            }
        })
    }
}
