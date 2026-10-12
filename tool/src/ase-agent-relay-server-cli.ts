/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as v                     from "valibot"

import { ServerCommand, configuredTls } from "./ase-lib-server-cli.js"
import type {
    ServerContext, ServerStartOptions,
    ServerConfig, ServerInstance, ServerFacts
}                                 from "./ase-lib-server-cli.js"
import { Config }                 from "./ase-config-core.js"
import { configSchema }           from "./ase-config-schema.js"
import * as Server                from "./ase-agent-relay-server-bind.js"

/*  schema for the per-user "relay.yaml"  */
export const relaySchema = v.nullish(v.strictObject({
    address: v.optional(v.string()),
    port:    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
    token:   v.optional(v.string()),
    pid:     v.optional(v.pipe(v.number(), v.integer())),
    cors:    v.optional(v.array(v.string())),
    tls:     v.optional(v.strictObject({
        cert:    v.optional(v.string()),
        key:     v.optional(v.string())
    }))
}))

/*  the configured TLS certificate and key of the agent relay: "project.relay.crt" and
    "project.relay.key" of the configuration <cfg>, unless "project.relay.url" selects
    HTTP on this host (as the agents and task boards following it would then fail)  */
export const relayTls = (cfg: Config): { cert: string | null, key: string | null } =>
    configuredTls(cfg, "project.relay")

/*  CLI command group "ase agent relay"  */
export default class AgentRelayCommand extends ServerCommand<ServerContext, ServerStartOptions> {
    protected readonly label       = "relay"
    protected readonly description = "Manage the per-user agent relay server, passing the live presence of the agents to the task boards"
    protected readonly name        = "relay"
    protected readonly schema      = relaySchema
    protected readonly prefix      = "ASE_AGENT_RELAY"
    protected readonly words       = "agent relay"
    protected readonly probePath   = "/agents"

    /*  the agent relay has no specific configuration  */
    protected context (ctx: ServerContext): ServerContext {
        return ctx
    }

    /*  the TLS certificate and key configured in the project configuration  */
    protected tlsDefaults (): { cert: string | null, key: string | null } {
        const cfg = new Config("config", configSchema, this.log)
        cfg.read()
        return relayTls(cfg)
    }

    /*  create the standalone agent relay server  */
    protected async create (_ctx: ServerContext, config: ServerConfig): Promise<{ server: ServerInstance, facts: ServerFacts }> {
        return { server: new Server.AgentRelayServer(this.log, config), facts: {} }
    }
}

