/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Command }             from "commander"

import type Log                     from "./ase-lib-log.js"
import { Task }                     from "./ase-task.js"
import * as TaskFormat              from "./ase-task-format.js"
import { TaskRequests, attachmentTime } from "./ase-task-request.js"
import type {
    AgentOpts, AgentTask, AgentItem, AgentJob,
    AgentLog, AgentResult, AgentWork, AgentSelection
}                                   from "./ase-agent-common.js"
import {
    Agent, taskFlow, taskFlowRaw, tagsOf,
    skillErrored, verdictOf, shellJob, updateTask
}                                   from "./ase-agent-common.js"
import { PhaseAgent }               from "./ase-agent-common-phase.js"
import type { AgentStates }         from "./ase-agent-common-phase.js"
import { RequestAgent }             from "./ase-agent-common-request.js"
import type { RequestOutcome }      from "./ase-agent-common-request.js"
import type { AgentRelayClient }    from "./ase-agent-relay-client.js"
import type { CustomDefinition }    from "./ase-agent-custom-config.js"
import {
    customOptions, resolveDefinition,
    renderTemplate, attachMatches
}                                   from "./ase-agent-custom-config.js"

/*  the result of the processing of a task by a custom agent, as evaluated in the
    finishing of its job: the found verdict (else empty), the checks of the success
    criteria and output line matches (with the reasons of the unmet ones), and the
    reason of a failed preparing or finishing command (else empty)  */
type CustomRecord = {
    verdict: string
    checks:  { criterion: string, ok: boolean, reason: string }[]
    fixed:   string
}

/*  the selected tasks (and the waiting ones, with the reason, and the noticed ones, with the notice)  */
type Selection = AgentSelection

/*  whether a record of a custom agent succeeded (where a missing one counts as failure)  */
const recordSuccess = (record: CustomRecord | undefined): boolean =>
    record !== undefined && record.fixed === "" && record.checks.every((check) => check.ok)

/*  escape a text for its literal use in a regular expression  */
const escapeRe = (text: string): string =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/*  the assignee to hand a processed task over to by an assignee specification
    of "--assign-success" or "--assign-failure" (empty to unassign it)  */
const handoverTo = (spec: string, previous: string): string =>
    spec === "none" ? "" : spec === "previous" ? previous : spec

/*  the functionality shared by the phase and the request agents of a custom definition:
    the tag filtering, the attachment skipping, the preparing of the job (rendering the
    prompt, running the preparing commands), and the finishing of the job (storing the
    output, evaluating the success criteria, and running the finishing commands)  */
class CustomCore {
    /*  the records of the processed tasks per task id (see "CustomRecord")  */
    readonly records = new Map<string, CustomRecord>()

    constructor (private log: Log, readonly def: CustomDefinition) {}

    /*  whether a task is claimable by its tags (see "--tag-require" and "--tag-exclude"),
        where a plain tag is carried plain or with any value  */
    selectable (keys: Map<string, string>): boolean {
        const tags    = tagsOf(keys)
        const carries = (tag: string) => tags.includes(tag) || (!tag.includes(":") && tags.some((t) => t.startsWith(`${tag}:`)))
        return this.def.tag.require.every(carries) && !this.def.tag.exclude.some(carries)
    }

    /*  the tasks held off from their retry after a failed processing (see "--tag-retry"),
        per task id: the number of failed processings in a row and the end of the hold-off  */
    private retries = new Map<string, { count: number, until: number }>()

    /*  record the result of a processed task for its retry, returning the duration it
        is held off from its retry (or zero if not retried): an exponentially growing
        delay (from one minute up to one hour), so a failing task is not processed again
        and again at once (which, in one-shot mode, even keeps the agent from terminating)  */
    retry (id: string, failed: boolean): number {
        if (!failed) {
            this.retries.delete(id)
            return 0
        }
        const count = (this.retries.get(id)?.count ?? 0) + 1
        const delay = Math.min(60 * 1000 * 2 ** (count - 1), 60 * 60 * 1000)
        this.retries.set(id, { count, until: Date.now() + delay })
        return delay
    }

    /*  filter the selected tasks (and the waiting ones) by their tags and their retry hold-off  */
    filter (items: AgentItem[], selected: Selection): Selection {
        const known   = new Map(items.map((item) => [ item.id, item.keys ]))
        const now     = Date.now()
        const waiting = new Map([ ...selected.waiting ].filter(([ id ]) => this.selectable(known.get(id) ?? new Map())))
        const notices = new Map([ ...(selected.notices ?? []) ].filter(([ id ]) => this.selectable(known.get(id) ?? new Map())))
        const tasks   = selected.tasks.filter((task) => {
            if (!this.selectable(task.keys))
                return false
            const until = this.retries.get(task.id)?.until ?? 0
            if (until <= now)
                return true
            waiting.set(task.id, `its retry after a failed processing (in ${Math.ceil((until - now) / 1000)}s)`)
            return false
        })
        return { tasks, waiting, notices }
    }

    /*  whether a task is left unclaimed by an attachment (see "--attach-skip")  */
    async skipped (task: AgentTask): Promise<boolean> {
        const skip = this.def.attach.skip
        return skip !== null && (await Task.attachments(this.log, task.id)).some((att) => attachMatches(skip, att.type))
    }

    /*  the current status of a task (else empty if it vanished)  */
    private async status (task: AgentTask): Promise<string> {
        return (await Task.inspect(this.log, task.id, (plan, lifecycle) => TaskFormat.taskStatus(plan.header, lifecycle))) ?? ""
    }

    /*  the environment variables of the shell commands  */
    private env (task: AgentTask, cwd: string): Record<string, string> {
        return {
            ASE_TASK_ID:        task.id,
            ASE_TASK_TITLE:     task.title,
            ASE_TASK_SOURCE:    taskFlowRaw(this.log, task, "Source"),
            ASE_TASK_CHANGESET: taskFlowRaw(this.log, task, "Changeset"),
            ASE_TASK_TARGET:    taskFlowRaw(this.log, task, "Target"),
            ASE_AGENT_NAME:     this.def.name,
            ASE_AGENT_WORKDIR:  cwd
        }
    }

    /*  prepare the job of a task in its work <work>: render the prompt (with the request
        prompt <prompt> of a request agent) and run the preparing commands, where the work
        is cleaned up again on a failure, and where <changed> decides preliminarily whether
        the plan content of a request agent changed  */
    async prepare (task: AgentTask, log: AgentLog, work: AgentWork, prompt: string,
        changed?: () => Promise<boolean>): Promise<AgentJob> {
        this.records.delete(task.id)
        try {
            const flow  = (key: "Source" | "Changeset" | "Target") => taskFlow(this.log, task, key)
            const value = (name: string): string => {
                if (name.startsWith("key:"))
                    return task.keys.get(name.slice(4)) ?? ""
                switch (name) {
                    case "id":                 return task.id
                    case "title":              return task.title
                    case "prompt":             return prompt.replace(/\s+/g, " ")
                    case "source":             return taskFlowRaw(this.log, task, "Source")
                    case "changeset":          return taskFlowRaw(this.log, task, "Changeset")
                    case "target":             return taskFlowRaw(this.log, task, "Target")
                    case "source-type":        return flow("Source").type
                    case "source-name":        return flow("Source").name
                    case "changeset-type":     return flow("Changeset").type
                    case "changeset-name":     return flow("Changeset").name
                    case "target-type":        return flow("Target").type
                    case "target-name":        return flow("Target").name
                    case "workdir":            return work.cwd
                    case "source-dir":         return work.sourceDir
                    case "changeset-worktree": return work.changesetWorktree
                }
                return ""
            }
            const rendered = renderTemplate(this.def.prompt.template, value)
            const env      = this.env(task, work.cwd)
            for (const cmd of this.def.prepare) {
                try {
                    await shellJob(cmd, work.cwd, env, log)
                }
                catch (err: unknown) {
                    this.records.set(task.id, { verdict: "", checks: [], fixed: `preparing command "${cmd}" failed` })
                    throw err
                }
            }
            return {
                ...(this.def.prompt.skill !== "" ?
                    { cmd: `${this.def.prompt.skill}${rendered !== "" ? ` ${rendered}` : ""}` } :
                    { prompt: rendered }),
                cwd:     work.cwd,
                dirs:    work.dirs,
                finish:  (log: AgentLog, result: AgentResult) => this.finish(task, log, result, work, env, changed),
                cleanup: work.cleanup
            }
        }
        catch (err: unknown) {
            await work.cleanup?.(log).catch((err2: unknown) =>
                log("warning", err2 instanceof Error ? err2.message : String(err2)))
            throw err
        }
    }

    /*  finish the job of a task: store its output lines (see "--attach-output"), finish its
        work (e.g. commit and publish it), evaluate its success criteria (recorded for the
        settling, but never thrown), and run the finishing command of its success (whose
        failure fails the finishing) or of its failure (whose failure is only reported)  */
    private async finish (task: AgentTask, log: AgentLog, result: AgentResult, work: AgentWork,
        env: Record<string, string>, changed?: () => Promise<boolean>): Promise<void> {
        const { def } = this
        const reason  = (err: unknown) => err instanceof Error ? err.message : String(err)
        const failed  = async () => {
            if (def.finish.failure !== "")
                await shellJob(def.finish.failure, work.cwd, { ...env, ASE_TASK_STATUS: await this.status(task) }, log)
                    .catch((err: unknown) => log("warning", reason(err)))
        }
        if (def.attach.output !== "")
            await this.attachOutput(task, result.output).catch((err: unknown) =>
                log("warning", `output not attached to task: ${reason(err)}`))
        try {
            await work.finish?.(log, result)
        }
        catch (err: unknown) {
            this.records.set(task.id, { verdict: "", checks: [], fixed: "finishing failed" })
            await failed()
            throw err
        }
        const record = await this.evaluate(task, result, changed)
        this.records.set(task.id, record)
        for (const check of record.checks.filter((check) => !check.ok && check.criterion !== "changed"))
            await log("warning", `success criterion "${check.criterion}" not met: ${check.reason}`)
        if (!recordSuccess(record))
            await failed()
        else if (def.finish.success !== "") {
            try {
                await shellJob(def.finish.success, work.cwd, { ...env, ASE_TASK_STATUS: await this.status(task) }, log)
            }
            catch (err: unknown) {
                record.fixed = `finishing command "${def.finish.success}" failed`
                throw err
            }
        }
    }

    /*  evaluate the success criteria of a processed task (see "--success-criterion" and
        "--success-match"), and determine its verdict (see "--verdict-label")  */
    private async evaluate (task: AgentTask, result: AgentResult, changed?: () => Promise<boolean>): Promise<CustomRecord> {
        const { def } = this
        const output  = result.output
        let verdict   = ""
        if (def.verdict.label !== "" && result.ok) {
            const found = verdictOf(output, escapeRe(def.verdict.label))
            if (found !== "" && (def.verdict.allow.length === 0 || def.verdict.allow.includes(found)))
                verdict = found
        }
        const checks: CustomRecord["checks"] = []
        for (const criterion of def.success.criteria) {
            if (criterion === "exit")
                checks.push({ criterion, ok: result.ok, reason: "agent tool failed" })
            else if (criterion === "clean")
                checks.push({ criterion, ok: !skillErrored(output), reason: "skill reported an error" })
            else if (criterion === "changed")
                checks.push({ criterion, ok: changed !== undefined && await changed(), reason: "plan not changed" })
            else if (criterion === "verdict")
                checks.push({ criterion, ok: verdict !== "", reason: "no verdict" })
            else if (criterion === "attachment") {
                const expect = def.attach.expect!
                const ok     = (await Task.attachments(this.log, task.id)).some((att) => attachMatches(expect, att.type))
                checks.push({ criterion, ok, reason: `no attachment "${expect.mime !== "" ? `${expect.mime};` : ""}${expect.kind}"` })
            }
            else if (criterion === "status")
                checks.push({ criterion, ok: await this.status(task) === def.state.phase, reason: `status not "${def.state.phase}"` })
        }
        for (const re of def.success.match)
            checks.push({ criterion: "match", ok: output.some((line) => re.test(line)), reason: `no output line matching "${re.source}"` })
        return { verdict, checks, fixed: "" }
    }

    /*  store the output lines of the prompt as a task attachment of the kind of
        "--attach-output" (replacing the one of an earlier processing)  */
    private async attachOutput (task: AgentTask, output: string[]): Promise<void> {
        const kind = this.def.attach.output
        const time = attachmentTime()
        await updateTask(this.log, task.id, (plan) => {
            plan.attachment = plan.attachment.filter((att) => !(/^text\/plain\s*(?:;|$)/i.test(att.Type ?? "")
                && attachMatches({ mime: "", kind }, att.Type ?? "")))
            plan.attachment.push({
                Type: `text/plain; charset=utf-8; kind="${kind}"`, Desc: `output of agent "${this.def.name}"`,
                Created: time, Modified: time, Data: output.length > 0 ? `${output.join("\n")}\n` : ""
            })
            return true
        })
    }
}

/*  the phase agent of a custom definition (see "--type phase")  */
class CustomPhaseAgent extends PhaseAgent {
    readonly kind = "custom"
    protected readonly description = ""
    protected readonly states:     AgentStates
    protected readonly assigned:   boolean  = false
    protected readonly finishing:  boolean  = false
    protected readonly serial:     boolean  = false
    protected readonly worktree:   boolean  = false
    protected readonly lifecycles: string[] = []
    private core: CustomCore

    constructor (log: Log, private def: CustomDefinition) {
        super(log)
        this.core       = new CustomCore(log, def)
        this.states     = { incoming: def.state.incoming, activity: def.state.activity, success: def.state.phase, passed: def.state.passed }
        this.assigned   = def.assign.required
        this.finishing  = def.finish.commit || def.finish.success !== "" || def.workdir === "target"
        this.serial     = def.serial
        this.worktree   = def.workdir !== "project"
        this.lifecycles = def.lifecycles
        this.mode       = def.assign.name
    }

    /*  the identity of the agent  */
    protected get tag (): string {
        return this.def.tag.name
    }
    protected get assignee (): string {
        return this.def.assign.name
    }
    protected get logName (): string {
        return this.def.attach.log
    }
    protected get role (): string {
        return this.def.assign.name
    }
    protected get runKind (): string {
        return `custom-${this.def.tag.name}`
    }

    /*  select the tasks by the phase semantics and by their tags  */
    protected select (items: AgentItem[], busy: Set<string>): Selection {
        return this.core.filter(items, super.select(items, busy))
    }

    /*  a task is claimed only without a skipping attachment and while its working directory is free  */
    protected async ready (task: AgentTask): Promise<boolean> {
        return !(await this.core.skipped(task)) && this.workdirReady(task, this.def.workdir)
    }

    /*  prepare the job of a task in its working directory  */
    protected async prepare (task: AgentTask, parallel: boolean, log: AgentLog): Promise<AgentJob> {
        const work = await this.workdirJob(task, this.def.workdir, this.def.assign.name, parallel,
            { checkout: this.def.prompt.template.names.has("source-dir"), commit: this.def.finish.commit })
        return this.core.prepare(task, log, work, "")
    }

    /*  the tag value of a processed task: its verdict, else the one of "--tag-success" or "--tag-failure"  */
    protected label (_ok: boolean, _output: string[], task: AgentTask): string | null | undefined {
        const record = this.core.records.get(task.id)
        if (record !== undefined && record.verdict !== "")
            return record.verdict.toLowerCase()
        return recordSuccess(record) ? this.def.tag.success : this.def.tag.failure
    }

    /*  the target state of a processed task: the one of its verdict, else the
        one of "--state-success" or "--state-failure"  */
    protected outcome (_ok: boolean, _output: string[], task: AgentTask): string {
        const record = this.core.records.get(task.id)
        const state  = record !== undefined && record.verdict !== "" ? this.def.state.verdict[record.verdict] : undefined
        return state ?? (recordSuccess(record) ? this.def.state.success : this.def.state.failure)
    }

    /*  whether a task was processed successfully  */
    protected succeeded (_to: string, _value: string | null | undefined, task: AgentTask): boolean {
        return recordSuccess(this.core.records.get(task.id))
    }

    /*  the assignee to hand a processed task over to  */
    protected handover (success: boolean, previous: string): string {
        return handoverTo(success ? this.def.assign.success : this.def.assign.failure, previous)
    }

    /*  settle a processed task, holding off a failed one untagged for its retry  */
    protected async settle (task: AgentTask, ok: boolean, finished: boolean, aborted: boolean,
        output: string[], log: AgentLog): Promise<void> {
        await super.settle(task, ok, finished, aborted, output, log)
        const failed = !aborted && this.def.tag.failure === null && !recordSuccess(this.core.records.get(task.id))
        const delay  = this.core.retry(task.id, failed)
        if (delay > 0) {
            await log("info", `task held off from its retry for ${delay / 1000}s`)
            this.redispatch(delay)
        }
    }
}

/*  the request agent of a custom definition (see "--type request")  */
class CustomRequestAgent extends RequestAgent {
    readonly kind = "custom"
    protected readonly description = ""
    protected readonly requests:   TaskRequests
    protected readonly serial:     boolean  = false
    protected readonly worktree:   boolean  = false
    protected readonly lifecycles: string[] = []
    private core: CustomCore

    constructor (log: Log, private def: CustomDefinition) {
        super(log)
        this.core            = new CustomCore(log, def)
        this.requests        = new TaskRequests(def.request.name, def.tag.name, def.request.done)
        this.presenceRequest = def.request.name
        this.serial          = def.serial
        this.worktree        = def.workdir !== "project"
        this.lifecycles      = def.lifecycles
        this.mode            = def.assign.name
    }

    /*  the identity of the agent  */
    protected get assignee (): string {
        return this.def.assign.name
    }
    protected get logName (): string {
        return this.def.attach.log
    }
    protected get role (): string {
        return this.def.assign.name
    }
    protected get runKind (): string {
        return `custom-${this.def.tag.name}`
    }

    /*  select the tasks by the request semantics and by their tags  */
    protected select (items: AgentItem[], busy: Set<string>): Selection {
        return this.core.filter(items, super.select(items, busy))
    }

    /*  a task is claimed only without a skipping attachment and while its working directory is free  */
    protected async ready (task: AgentTask): Promise<boolean> {
        return !(await this.core.skipped(task)) && this.workdirReady(task, this.def.workdir)
    }

    /*  prepare the job of a task in its working directory  */
    protected async prepare (task: AgentTask, parallel: boolean, log: AgentLog): Promise<AgentJob> {
        const claim = this.claims.get(task.id)!
        const work  = await this.workdirJob(task, this.def.workdir, this.def.assign.name, parallel,
            { checkout: this.def.prompt.template.names.has("source-dir"), commit: this.def.finish.commit })
        return this.core.prepare(task, log, work, claim.prompt, async () =>
            (await Task.inspect(this.log, task.id, (plan) => this.digest(plan) !== claim.digest)) ?? false)
    }

    /*  the reason of a failed processing of a request (or null on success): the reason
        of a failed preparing or finishing command, else of a reported error of the skill,
        else of a failed agent tool, else of the first unmet success criterion, where the
        plan change is finally decided from the settling plan  */
    protected failure (outcome: RequestOutcome): string | null {
        const record = this.core.records.get(outcome.id)
        const checks = (record?.checks ?? []).map((check) => check.criterion === "changed" ? { ...check, ok: outcome.changed } : check)
        if (record !== undefined && record.fixed === "" && checks.every((check) => check.ok))
            return null
        else if (record !== undefined && record.fixed !== "")
            return record.fixed
        return outcome.errored ? "skill reported an error" : !outcome.ok ? "agent tool failed" :
            checks.find((check) => !check.ok)?.reason ?? "agent tool failed"
    }

    /*  the assignee to hand a processed task over to  */
    protected handover (success: boolean, previous: string): string {
        return handoverTo(success ? this.def.assign.success : this.def.assign.failure, previous)
    }
}

/*  agent "ase agent custom": a facade to the phase or request agent of its definition,
    created on its setup (as the definition decides on the kind of the agent)  */
export default class AgentCustomCommand extends Agent {
    readonly kind = "custom"

    protected readonly description =
        "Run a custom agent, whose entire behavior is configured instead of hard-coded: with " +
        "\"--type phase\", claim every task in the \"--state-incoming\" status, process it via the " +
        "headless agent tool with a skill or a prompt text, tag it, and move it into the state of " +
        "its success or failure, or, with \"--type request\", process the prompt requests of " +
        "\"--request-name\" attached to tasks in any status (see \"ase task request\"), " +
        "logging to stdout and to the \"agent:<name>\" attachment of the task"

    /*  the "--repo" and "--tempdir" options are registered (but ignored with "--workdir project")  */
    protected readonly worktree = true

    /*  the delegate agent of the definition (once set up)  */
    private delegate: Agent | null = null

    get name (): string {
        return this.delegate?.name ?? this.kind
    }
    get serialOnly (): boolean {
        return this.delegate?.serialOnly ?? false
    }

    /*  register the options of all definitions (as flat long options)  */
    protected options (cmd: Command): void {
        for (const option of customOptions) {
            const flags = (option.key === "definition" ? "-D, " : "") + `--${option.key}` +
                (option.kind !== "flag" ? ` <${option.arg}>` : "")
            if (option.kind === "list")
                cmd.option(flags, option.desc, (value: string, prev?: string[]) => [ ...(prev ?? []), value ])
            else
                cmd.option(flags, option.desc)
        }
    }

    /*  validate the definition of the given options  */
    validate (own: Partial<AgentOpts>): void {
        resolveDefinition(own as Record<string, unknown>, own.name ?? this.kind)
    }

    /*  set up the delegate agent of the definition of the given options  */
    async setup (global: AgentOpts, own: Partial<AgentOpts>, relay: AgentRelayClient | null = null): Promise<void> {
        const def = resolveDefinition(own as Record<string, unknown>, own.name ?? global.name ?? this.kind)
        const delegate = def.type === "phase" ? new CustomPhaseAgent(this.log, def) : new CustomRequestAgent(this.log, def)
        await delegate.setup(global, own, relay)
        this.delegate = delegate
    }

    /*  run the delegate agent  */
    async run (): Promise<void> {
        if (this.delegate === null)
            throw new Error("agent: custom agent not set up")
        await this.delegate.run()
    }

    /*  the processing is done by the delegate agent only  */
    private unsupported (): never {
        throw new Error("agent: custom agent processes tasks through its delegate only")
    }
    protected prepare (): Promise<AgentJob> {
        return this.unsupported()
    }
    protected select (): Selection {
        return this.unsupported()
    }
    protected claim (): Promise<string | null> {
        return this.unsupported()
    }
    protected settle (): Promise<void> {
        return this.unsupported()
    }
    protected observing (): string {
        return this.unsupported()
    }
}

