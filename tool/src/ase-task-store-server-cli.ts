/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                       from "node:path"

import type { Command }           from "commander"
import { Option }                 from "commander"
import { isMap }                  from "yaml"
import * as v                     from "valibot"

import { ServerCommand, configuredTls } from "./ase-lib-server-cli.js"
import type {
    ServerContext, ServerStartOptions,
    ServerConfig, ServerInstance, ServerFacts
}                                 from "./ase-lib-server-cli.js"
import { Config }                 from "./ase-config-core.js"
import { configSchema }           from "./ase-config-schema.js"
import * as Delegate              from "./ase-task-store-plugin-delegate.js"
import * as Server                from "./ase-task-store-server-bind.js"

/*  schema for the per-user "store.yaml"  */
export const storeSchema = v.nullish(v.strictObject({
    address: v.optional(v.string()),
    port:    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
    token:   v.optional(v.string()),
    pid:     v.optional(v.pipe(v.number(), v.integer())),
    relay:   v.optional(v.boolean()),
    cors:    v.optional(v.array(v.string())),
    tls:     v.optional(v.strictObject({
        cert:    v.optional(v.string()),
        key:     v.optional(v.string())
    })),
    storage: v.optional(v.strictObject({
        plugin:  v.optional(v.string()),
        options: v.optional(v.record(v.string(), v.unknown()))
    }))
}))

/*  the resolved "store.yaml" context  */
type StoreContext = ServerContext & {
    relay:   boolean
    plugin:  string | null
    options: Record<string, unknown>
}

/*  the options of "ase task store start"  */
type StartOptions = ServerStartOptions & {
    module?:            string
    basedir?:           string
    solo?:              boolean
    withAgentRelay?:    boolean
    withoutAgentRelay?: boolean
}

/*  CLI command group "ase task store"  */
export default class TaskStoreCommand extends ServerCommand<StoreContext, StartOptions> {
    protected readonly label       = "task store"
    protected readonly description = "Manage the per-user task store REST API server"
    protected readonly name        = "store"
    protected readonly schema      = storeSchema
    protected readonly prefix      = "ASE_TASK_STORE"
    protected readonly words       = "task store"
    protected readonly probePath   = "/projects"

    /*  extend the context by the co-hosting of the agent relay and the storage plugin  */
    protected context (ctx: ServerContext, scalar: (key: string) => string | number | null): StoreContext {
        const relay  = scalar("relay")
        const plugin = scalar("storage.plugin")
        const opts   = ctx.cfg.get("storage.options")
        return {
            ...ctx,
            relay:   relay === "true",
            plugin:  plugin !== null ? String(plugin) : null,
            options: isMap(opts) ? (opts.toJSON() as Record<string, unknown>) : {}
        }
    }

    /*  the TLS certificate and key configured in the project configuration:
        "project.task.store.crt" and "project.task.store.key", unless
        "project.task.store.url" selects HTTP on this host  */
    protected tlsDefaults (): { cert: string | null, key: string | null } {
        const cfg = new Config("config", configSchema, this.log)
        cfg.read()
        return configuredTls(cfg, "project.task.store")
    }

    /*  the base directory of the built-in storage plugin of the context  */
    private basedir (ctx: StoreContext): string {
        return typeof ctx.options.basedir === "string" && ctx.options.basedir !== "" ?
            path.resolve(ctx.dir, ctx.options.basedir) : path.join(ctx.dir, "tasks")
    }

    /*  load the storage plugin and create the server  */
    protected async create (ctx: StoreContext, config: ServerConfig, env: NodeJS.ProcessEnv): Promise<{ server: ServerInstance, facts: ServerFacts }> {
        const module = (env[this.env("MODULE")] ?? ctx.plugin) || null
        const relay  = env[this.env("RELAY")] === "1" ? true : env[this.env("RELAY")] === "0" ? false : ctx.relay

        /*  the built-in plugin additionally takes its base directory
            (default: "tasks" below the per-user config dir) and "solo"
            mode ("--solo" or "--no-solo") from the command line,
            persisted for subsequent starts  */
        const options = { ...ctx.options }
        const storage: ServerFacts = {}
        if (module === null || module === Delegate.BUILTIN_PLUGIN) {
            const basedir = env[this.env("BASEDIR")]
            const solo    = env[this.env("SOLO")]
            options.basedir = this.basedir(ctx)
            if (basedir !== undefined && basedir !== "")
                options.basedir = storage["storage.options.basedir"] = basedir
            if (solo === "1")
                options.solo = storage["storage.options.solo"] = true
            else if (solo === "0") {
                options.solo = false
                storage["storage.options.solo"] = null
            }
        }
        const plugin = await Delegate.loadTaskStoragePlugin(module, {
            options,
            log:     (level, message) => this.log.write(level, `task store: plugin "${module ?? Delegate.BUILTIN_PLUGIN}": ${message}`)
        })
        const server = new Server.TaskStoreServer(this.log, {
            ...config, relay,
            store: new Delegate.TaskStore(plugin)
        })
        return {
            server,
            facts: {
                relay: relay ? true : null,
                "storage.plugin": module,
                ...storage
            }
        }
    }

    /*  the options of the storage plugin and the co-hosting of the agent relay  */
    protected options (cmd: Command): void {
        cmd
            .option("-m, --module <name>", "storage plugin to load: \"ase\" for the built-in one, \"github\", \"gitlab\", resp. \"gitea\" " +
                "for the built-in GitHub, GitLab, resp. Gitea Issues one, else the NPM package \"ase-task-store-<name>\" " +
                "(default: the configured \"storage.plugin\", else \"ase\")")
            .option("-d, --basedir <dir>", "base directory of the built-in storage plugin " +
                "(default: the configured \"storage.options.basedir\", else \"tasks\" below the per-user config dir)")
            .option("-s, --solo", "let the built-in storage plugin store a single project flat in the base " +
                "directory, accepting any project id (default: the configured \"storage.options.solo\", " +
                "else one sub-directory per project)")
            .option("--no-solo", "let the built-in storage plugin store one sub-directory per project, " +
                "resetting a configured \"storage.options.solo\"")
            .addOption(new Option("--with-agent-relay", "co-host the agent relay (see \"ase agent relay\") under the same token " +
                "(default: the configured \"relay\", else not co-hosted)").conflicts("withoutAgentRelay"))
            .addOption(new Option("--without-agent-relay", "do not co-host the agent relay, resetting a configured \"relay\"")
                .conflicts("withAgentRelay"))
    }

    /*  the explicitly given options of the storage plugin and the co-hosting
        of the agent relay deviating from the configuration of the running server  */
    protected deviating (ctx: StoreContext, opts: StartOptions): string[] {
        const module = ctx.plugin || Delegate.BUILTIN_PLUGIN
        const solo   = ctx.options.solo === true
        return [
            opts.module  !== undefined && (opts.module || Delegate.BUILTIN_PLUGIN) !== module ? "--module"    : "",
            opts.basedir !== undefined && path.resolve(opts.basedir) !== this.basedir(ctx)    ? "--basedir"   : "",
            opts.solo    !== undefined && opts.solo !== solo                                  ? "--[no-]solo" : "",
            opts.withAgentRelay    === true && !ctx.relay ? "--with-agent-relay"    : "",
            opts.withoutAgentRelay === true &&  ctx.relay ? "--without-agent-relay" : ""
        ]
    }

    /*  the environment variables handing the storage plugin and the co-hosting of the agent relay to the server  */
    protected environment (ctx: StoreContext, opts: StartOptions): NodeJS.ProcessEnv {
        return {
            [this.env("MODULE")]:  (opts.module ?? ctx.plugin) || Delegate.BUILTIN_PLUGIN,
            [this.env("BASEDIR")]: opts.basedir !== undefined ? path.resolve(opts.basedir) : "",
            [this.env("SOLO")]:    opts.solo === true ? "1" : opts.solo === false ? "0" : "",
            [this.env("RELAY")]:   opts.withAgentRelay === true ? "1" : opts.withoutAgentRelay === true ? "0" : ""
        }
    }

    /*  the storage plugin of the started server  */
    protected started (env: NodeJS.ProcessEnv): string {
        return ` (storage plugin "${env[this.env("MODULE")]}")`
    }

    /*  the co-hosting of the agent relay by the running server  */
    protected running (ctx: StoreContext): string {
        return ctx.relay ? " with agent relay" : ""
    }
}

