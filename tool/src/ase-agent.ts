/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { Command }                       from "commander"

import type Log                          from "./ase-lib-log.js"
import { writeStdout }                   from "./ase-lib-stdio.js"
import type { Agent, AgentOpts }         from "./ase-agent-common.js"
import AgentPlannerCommand               from "./ase-agent-planner.js"
import AgentImplementerCommand           from "./ase-agent-implementer.js"
import AgentApproverCommand              from "./ase-agent-approver.js"
import AgentIntegratorCommand            from "./ase-agent-integrator.js"
import AgentEditorCommand                from "./ase-agent-editor.js"
import AgentRelayCommand                 from "./ase-agent-relay-server-cli.js"
import { relaySpec, AgentRelayClient }   from "./ase-agent-relay-client.js"

/*  CLI command "ase agent"  */
export default class AgentCommand {
    constructor (private log: Log) {}

    /*  register command  */
    register (program: Command): void {
        /*  the available agent kinds, each with a template agent for the help texts
            and the creation of a fresh agent for each occurrence on the command line  */
        const kinds = new Map<string, { agent: Agent, create: () => Agent }>([
            () => new AgentPlannerCommand(this.log),
            () => new AgentImplementerCommand(this.log),
            () => new AgentApproverCommand(this.log),
            () => new AgentIntegratorCommand(this.log),
            () => new AgentEditorCommand(this.log)
        ].map((create) => {
            const agent = create()
            return [ agent.kind, { agent, create } ]
        }))

        /*  default for --tool derived from ASE_TOOL environment variable
            (validated lazily by "parseTool" in the agent setup)  */
        const envTool  = process.env.ASE_TOOL ?? ""
        const toolDflt = envTool !== "" ? envTool : "claude"

        /*  register CLI top-level command "ase agent", where all options following
            the first agent name are passed through for the per-agent parsing  */
        const cmd = program
            .command("agent")
            .description("Autonomous agents driving the task lifecycle phases (planner, implementer, approver, integrator) " +
                "and processing the edit requests of tasks (editor), running concurrently")
            .usage("[options] <agent> [<agent-options>] [<agent> [<agent-options>] ...]")
            .argument("[args...]")
            .option("-t, --tool <tool>",        "agent tool (\"claude\", \"copilot\", or \"codex\")", toolDflt)
            .option("-p, --parallel <num>",     "maximum number of tasks processed in parallel per agent", "1")
            .option("-T, --timeout <duration>", "maximum duration of processing a task " +
                "as <number><unit> with unit s, m, or h", "60m")
            .option("-o, --one-shot",           "terminate once all dispatchable incoming tasks are processed", false)
            .option("-r, --repo <url>",         "Git repository to clone temporarily for the tasks " +
                "without \"worktree\" values (default: the Git working copy the agents are started in)")
            .option("-d, --tempdir <dir>",      "directory for the temporary files like the clone of \"--repo\", " +
                "with \"%p\" expanded to the process id and \"%h\" to a hash value (default: a fresh, private one)")
            .option("--agent-relay <url>",      "agent relay to pass the live presence of the agents to, " +
                "as \"ase[s]://<addr>:<port>[/<token>]\" (default: the configured \"project.agent.relay\", else none)")
            .passThroughOptions()
            .addHelpText("after", () => "\nAgents:\n\n" + [ ...kinds.values() ]
                .map(({ agent }) => agent.command().helpInformation().replace(/^(?=.)/gm, "  "))
                .join("\n"))
            .action(async (args: string[], opts: AgentOpts) => {
                if (args.length === 0) {
                    cmd.outputHelp()
                    await writeStdout("")
                    process.exitCode = 1
                    return
                }

                /*  parse the agent kinds and their options, each up to the next agent kind,
                    where multiple agents of the same kind have to be distinguished by
                    their names, which must not be the name of another agent kind  */
                const selected: { agent: Agent, own: Partial<AgentOpts> }[] = []
                const names = new Set<string>()
                let rest = args
                while (rest.length > 0) {
                    const kind = kinds.get(rest[0])
                    if (kind === undefined)
                        throw new Error(`agent: unknown agent "${rest[0]}" ` +
                            `(expected ${[ ...kinds.keys() ].map((name) => `"${name}"`).join(", ")})`)
                    const agent = kind.create()
                    const sub   = agent.command()
                    sub.parse(rest.slice(1), { from: "user" })
                    const own   = sub.opts<Partial<AgentOpts>>()
                    const name  = own.name ?? agent.kind
                    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name) || name.length > 64)
                        throw new Error(`agent: invalid agent name "${name}" ` +
                            "(expected up to 64 letters, digits, underscores, and dashes, starting with a letter or digit)")
                    if (name !== agent.kind && kinds.has(name))
                        throw new Error(`agent: agent name "${name}" clashes with the agent kind "${name}"`)
                    if (names.has(name))
                        throw new Error(`agent: agent name "${name}" given more than once ` +
                            "(distinguish multiple agents of the same kind with \"--name\")")
                    names.add(name)
                    selected.push({ agent, own })
                    rest = sub.args
                }

                /*  set up all agents (with the client of the agent relay, if any) before running any
                    of them concurrently, where a failed agent interrupts all its peers, so their claimed
                    tasks are released before the termination of the process (instead of keeping their "active" tags)  */
                const spec  = relaySpec(this.log, opts.agentRelay)
                const relay = spec !== null ? new AgentRelayClient(this.log, spec) : null
                for (const { agent, own } of selected)
                    await agent.setup(opts, own, selected.filter((entry) => entry.agent.kind === agent.kind).length, relay)
                const results = await Promise.allSettled(selected.map(({ agent }) =>
                    agent.run().catch((err: unknown) => {
                        for (const { agent: peer } of selected)
                            if (peer !== agent)
                                peer.interrupt()
                        throw err
                    })))

                /*  report all failed agents, but raise the first failure only  */
                const failed = results.filter((result) => result.status === "rejected")
                for (const { reason } of failed.slice(1))
                    this.log.write("error", reason instanceof Error ? reason.message : String(reason))
                if (failed.length > 0)
                    throw failed[0].reason
            })

        /*  register CLI sub-command group "ase agent relay" (dispatched before
            the positional agent names, as "relay" is no agent kind)  */
        new AgentRelayCommand(this.log).register(cmd)
    }
}

