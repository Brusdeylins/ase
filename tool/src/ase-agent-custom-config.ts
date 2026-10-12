/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import fs                           from "node:fs"
import path                         from "node:path"

import YAML                         from "yaml"

import * as TaskFormat              from "./ase-task-format.js"
import { requestsOf, typeParam }    from "./ase-task-request.js"

/*  the processing types, the working directory kinds, and the success criteria of a custom agent  */
export const customTypes    = [ "phase", "request" ] as const
export const customWorkdirs = [ "project", "source", "changeset", "changeset-read", "target" ] as const
export const customCriteria = [ "exit", "clean", "changed", "verdict", "attachment", "status" ] as const
export type CustomType      = typeof customTypes[number]
export type CustomWorkdir   = typeof customWorkdirs[number]
export type CustomCriterion = typeof customCriteria[number]

/*  the groups of the options of a custom agent (their options named "<group>-<item>")  */
export const customGroups = [ "state", "tag", "assign", "request", "prompt", "prepare", "success", "verdict", "attach", "finish" ]

/*  the options of a custom agent: their long name (without "--"), their kind (a single
    value, a repeatable value, or a flag), the name of their argument, and their description  */
export type CustomOption = { key: string, kind: "value" | "list" | "flag", arg: string, desc: string }
const opt = (key: string, kind: CustomOption["kind"], arg: string, desc: string): CustomOption => ({ key, kind, arg, desc })
export const customOptions: CustomOption[] = [
    opt("definition",        "value", "file",          "YAML file with the definition of the agent (with the same keys as these options, " +
        "flat or nested by group, where the given options win)"),
    opt("type",              "value", "type",          "processing type: \"phase\" (claim tasks by their lifecycle status) or " +
        "\"request\" (process the attached prompt requests of tasks) (default: \"phase\")"),
    opt("workdir",           "value", "kind",          "working directory: \"project\", \"source\", \"changeset\", " +
        "\"changeset-read\", or \"target\" (default: \"project\")"),
    opt("lifecycle",         "list",  "model",         "supported task lifecycle model (repeatable) " +
        "(default: every model containing all given states)"),
    opt("serial",            "flag",  "",              "process the tasks serially only (ignoring \"--parallel\")"),
    opt("state-incoming",    "value", "state",         "state of the tasks to claim (mandatory for \"phase\")"),
    opt("state-activity",    "value", "state",         "state of a task during its processing (default: incoming)"),
    opt("state-success",     "value", "state",         "target state on success (default: incoming)"),
    opt("state-failure",     "value", "state",         "target state on failure (default: incoming)"),
    opt("state-phase",       "value", "state",         "phase success state, into which the skill itself can move a task " +
        "(default: success)"),
    opt("state-passed",      "value", "state",         "first state from which on a task has passed the phase " +
        "for its \"After:\" successors (default: phase)"),
    opt("state-verdict",     "list",  "verdict=state", "target state per verdict (repeatable)"),
    opt("tag-name",          "value", "tag",           "tag of the processed tasks (default: \"ase-agent-<name>\")"),
    opt("tag-success",       "value", "tag",           "tag on success: \"<tag-name>\", \"<tag-name>:<value>\", " +
        "or \"none\" (default: \"<tag-name>\")"),
    opt("tag-failure",       "value", "tag",           "tag on failure: \"<tag-name>\", \"<tag-name>:<value>\", " +
        "or \"none\" (default: \"<tag-name>\")"),
    opt("tag-require",       "list",  "tag",           "tag a claimable task has to carry (repeatable)"),
    opt("tag-exclude",       "list",  "tag",           "tag a claimable task must not carry (repeatable)"),
    opt("tag-retry",         "flag",  "",              "untag a failed task, so it is claimed again (shorthand for \"--tag-failure none\")"),
    opt("assign-name",       "value", "who",           "assignee under which the tasks are claimed and which names " +
        "the agent-owned worktrees (default: the agent name)"),
    opt("assign-required",   "flag",  "",              "claim only the tasks explicitly assigned to \"--assign-name\""),
    opt("assign-success",    "value", "who",           "assignee of a task after its successful processing: " +
        "a name, \"none\", or \"previous\" (default: \"none\" for \"phase\", \"previous\" for \"request\")"),
    opt("assign-failure",    "value", "who",           "assignee of a task after its failed processing: " +
        "a name, \"none\", or \"previous\" (default: \"none\" for \"phase\", \"previous\" for \"request\")"),
    opt("request-name",      "value", "name",          "name of the processed requests (default: the agent name)"),
    opt("request-done",      "value", "word",          "word naming a processed task in the log lines (default: \"processed\")"),
    opt("prompt-skill",      "value", "name",          "skill to invoke"),
    opt("prompt-args",       "value", "template",      "arguments of the skill " +
        "(default: \"{id}\" for \"phase\", \"{id}: {prompt}\" for \"request\")"),
    opt("prompt-text",       "value", "template",      "prompt text to invoke (instead of a skill)"),
    opt("prompt-file",       "value", "file",          "file with the prompt text to invoke (instead of a skill)"),
    opt("prepare-run",       "list",  "cmd",           "shell command to run before the prompt (repeatable)"),
    opt("success-criterion", "list",  "criterion",     "success criterion: \"exit\", \"clean\", \"changed\", " +
        "\"verdict\", \"attachment\", or \"status\" (repeatable) " +
        "(default: \"exit\" and \"clean\" for \"phase\", \"clean\" and \"changed\" for \"request\")"),
    opt("success-match",     "list",  "regex",         "regular expression an output line has to match (repeatable)"),
    opt("verdict-label",     "value", "label",         "label after which the verdict is given in the output"),
    opt("verdict-allow",     "list",  "verdict",       "accepted verdict (repeatable) " +
        "(default: the verdicts of \"--state-verdict\", else any)"),
    opt("attach-log",        "value", "name",          "name of the processing log attachment \"agent:<name>\" " +
        "(default: the agent name)"),
    opt("attach-output",     "value", "kind",          "kind of the attachment storing the output lines of the prompt"),
    opt("attach-expect",     "value", "spec",          "attachment \"[<mime-type>;]<kind>\" required by the " +
        "\"attachment\" success criterion"),
    opt("attach-skip",       "value", "spec",          "attachment \"[<mime-type>;]<kind>\" leaving a task unclaimed"),
    opt("finish-commit",     "flag",  "",              "commit the work onto a \"branch:\" changeset and publish it " +
        "(with \"--workdir changeset\" only)"),
    opt("finish-success",    "value", "cmd",           "shell command to run after a successful processing"),
    opt("finish-failure",    "value", "cmd",           "shell command to run after a failed processing")
]

/*  the camel-cased attribute name of an option (as by "commander")  */
export const optionAttr = (key: string): string =>
    key.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())

/*  a node of a parsed template: literal text, a placeholder, or a conditional
    (on a non-empty placeholder, or on a placeholder equal to a value) with its body  */
type TemplateNode = { text: string } | { name: string } | { cond: string, equals: string | null, body: TemplateNode[] }

/*  a parsed template: its nodes and the names of all its placeholders  */
export type Template = { nodes: TemplateNode[], names: Set<string> }

/*  the placeholders of the templates (besides "key:<Header>")  */
const placeholders = [
    "id", "title", "prompt", "source", "changeset", "target",
    "source-type", "source-name", "changeset-type", "changeset-name", "target-type", "target-name",
    "workdir", "source-dir", "changeset-worktree"
]

/*  parse a template of the option <option>: placeholders "{<name>}" (where "{prompt}" is
    known for "request" only), conditionals "{?<name>:<text>}" and "{?<name>=<value>:<text>}"
    (with placeholders, but without nested conditionals in <text>), and "{{" and "}}" for
    literal braces, keeping all other text verbatim  */
export const parseTemplate = (spec: string, option: string, type: CustomType): Template => {
    const fail = (msg: string): never => {
        throw new Error(`agent: option "--${option}": ${msg}`)
    }
    const names = new Set<string>()
    const known = (name: string): string => {
        if (!/^key:[A-Za-z][A-Za-z0-9-]*$/.test(name) && !(placeholders.includes(name) && (name !== "prompt" || type === "request")))
            fail(`unknown placeholder "${name}"` + (name === "prompt" ? " (known for \"--type request\" only)" : ""))
        names.add(name)
        return name
    }
    /*  parse the nodes of the template or, from the position <open> of its opening
        brace on, of the body of a conditional (up to its closing brace)  */
    let i = 0
    const parse = (open: number): TemplateNode[] => {
        const nodes: TemplateNode[] = []
        let text = ""
        const flush = () => {
            if (text !== "")
                nodes.push({ text })
            text = ""
        }
        while (i < spec.length) {
            if (spec.startsWith("{{", i) || spec.startsWith("}}", i)) {
                text += spec[i]
                i += 2
            }
            else if (spec[i] === "}") {
                if (open < 0)
                    fail(`unbalanced "}" at position ${i + 1} (use "}}" for a literal brace)`)
                i++
                flush()
                return nodes
            }
            else if (spec.startsWith("{?", i)) {
                if (open >= 0)
                    fail(`nested conditional at position ${i + 1}`)
                const m = /^\{\?(key:[A-Za-z][A-Za-z0-9-]*|[a-z][a-z-]*)(?:=([^:}]*))?:/.exec(spec.slice(i))
                if (m === null)
                    fail(`invalid conditional at position ${i + 1} (expected "{?<name>:<text>}" or "{?<name>=<value>:<text>}")`)
                const cond = known(m![1])
                const at   = i
                i += m![0].length
                flush()
                nodes.push({ cond, equals: m![2] ?? null, body: parse(at) })
            }
            else if (spec[i] === "{") {
                const m = /^\{(key:[A-Za-z][A-Za-z0-9-]*|[a-z][a-z-]*)\}/.exec(spec.slice(i))
                if (m === null)
                    fail(`invalid placeholder at position ${i + 1} (use "{{" for a literal brace)`)
                flush()
                nodes.push({ name: known(m![1]) })
                i += m![0].length
            }
            else
                text += spec[i++]
        }
        if (open >= 0)
            fail(`unclosed conditional at position ${open + 1}`)
        flush()
        return nodes
    }
    return { nodes: parse(-1), names }
}

/*  render a parsed template with the values of its placeholders  */
export const renderTemplate = (template: Template, value: (name: string) => string): string => {
    const render = (nodes: TemplateNode[]): string => nodes.map((node) => {
        if ("text" in node)
            return node.text
        else if ("name" in node)
            return value(node.name)
        const val = value(node.cond)
        return (node.equals === null ? val !== "" : val === node.equals) ? render(node.body) : ""
    }).join("")
    return render(template.nodes)
}

/*  an attachment specification "[<mime-type>;]<kind>", and whether an attachment type matches it
    (by its "kind" parameter exactly, and, if given, by its MIME type)  */
export type AttachSpec = { mime: string, kind: string }
export const attachMatches = (spec: AttachSpec, type: string): boolean =>
    typeParam(type, "kind") === spec.kind
    && (spec.mime === "" || (type.split(";")[0] ?? "").trim().toLowerCase() === spec.mime)

/*  the definition of a custom agent  */
export type CustomDefinition = {
    name:       string
    type:       CustomType
    workdir:    CustomWorkdir
    lifecycles: string[]
    serial:     boolean
    state: {
        incoming: string, activity: string, success: string, failure: string,
        phase: string, passed: string, verdict: Record<string, string>
    }
    tag: {
        name: string, success: string | null | undefined, failure: string | null | undefined,
        require: string[], exclude: string[]
    }
    assign:  { name: string, required: boolean, success: string, failure: string }
    request: { name: string, done: string }
    prompt:  { skill: string, template: Template }
    prepare: string[]
    success: { criteria: CustomCriterion[], match: RegExp[] }
    verdict: { label: string, allow: string[] }
    attach:  { log: string, output: string, expect: AttachSpec | null, skip: AttachSpec | null }
    finish:  { commit: boolean, success: string, failure: string }
}

/*  flatten the nested option groups of a definition (e.g. "state: { incoming: PLANNED }"
    into "state-incoming: PLANNED"), where <where> names the definition in errors  */
export const flattenDefinition = (data: Record<string, unknown>, where: string): Record<string, unknown> => {
    const flat: Record<string, unknown> = {}
    const set = (key: string, value: unknown) => {
        if (Object.hasOwn(flat, key))
            throw new Error(`${where}: option "${key}" given twice (flat and nested)`)
        flat[key] = value
    }
    for (const [ key, value ] of Object.entries(data)) {
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            if (!customGroups.includes(key))
                throw new Error(`${where}: option "${key}" is no option group (expected one of ` +
                    `${customGroups.map((group) => `"${group}"`).join(", ")})`)
            for (const [ item, val ] of Object.entries(value as Record<string, unknown>))
                set(`${key}-${item}`, val)
        }
        else
            set(key, value)
    }
    return flat
}

/*  load a definition file into its flattened and normalized option values (by long option
    name), where a relative "prompt-file" is resolved against the directory of the file  */
const loadDefinition = (file: string): Record<string, string | string[] | boolean> => {
    let data: unknown
    try {
        data = YAML.parse(fs.readFileSync(file, "utf8"))
    }
    catch (err: unknown) {
        throw new Error(`agent: option "--definition": cannot read definition "${file}": ` +
            `${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }
    if (data === null || typeof data !== "object" || Array.isArray(data))
        throw new Error(`agent: option "--definition": definition "${file}" carries no options`)
    const where  = `agent: option "--definition": definition "${file}"`
    const values: Record<string, string | string[] | boolean> = {}
    for (const [ key, value ] of Object.entries(flattenDefinition(data as Record<string, unknown>, where))) {
        const option = customOptions.find((opt) => opt.key === key)
        if (option === undefined || key === "definition")
            throw new Error(`${where}: unknown option "${key}"`)
        const scalar = (val: unknown): string => {
            if (typeof val !== "string" && typeof val !== "number")
                throw new Error(`${where}: invalid value of option "${key}" (expected a string)`)
            return String(val)
        }
        if (value === null || value === undefined)
            continue
        else if (option.kind === "flag") {
            if (typeof value !== "boolean")
                throw new Error(`${where}: invalid value of option "${key}" (expected a boolean)`)
            if (value)
                values[key] = true
        }
        else if (option.kind === "list")
            values[key] = (Array.isArray(value) ? value : [ value ]).map(scalar)
        else
            values[key] = scalar(value)
    }
    if (typeof values["prompt-file"] === "string")
        values["prompt-file"] = path.resolve(path.dirname(file), values["prompt-file"])
    return values
}

/*  resolve the definition of the custom agent named <name> from its (camel-cased) command-line
    options <opts>: the defaults, overridden by the definition file of "--definition" (if any),
    overridden by the given options, validated against the task lifecycle models  */
export const resolveDefinition = (opts: Record<string, unknown>, name: string): CustomDefinition => {
    /*  merge the values of the definition file and of the given options  */
    const given: Record<string, string | string[] | boolean> = {}
    for (const option of customOptions) {
        const value = opts[optionAttr(option.key)]
        if (value !== undefined && value !== false)
            given[option.key] = value as string | string[] | boolean
    }
    const file   = typeof given.definition === "string" ? path.resolve(given.definition) : ""
    const values = { ...(file !== "" ? loadDefinition(file) : {}), ...given }
    const str    = (key: string, def = ""): string => typeof values[key] === "string" ? values[key] as string : def
    const list   = (key: string): string[] => Array.isArray(values[key]) ? values[key] as string[] : []
    const flag   = (key: string): boolean => values[key] === true
    const has    = (key: string): boolean => values[key] !== undefined
    const fail   = (key: string, msg: string): never => {
        throw new Error(`agent: option "--${key}": ${msg}`)
    }
    const choice = <T extends string> (key: string, choices: readonly T[], def: T): T => {
        const value = str(key, def)
        if (!choices.includes(value as T))
            fail(key, `invalid value "${value}" (expected ${choices.map((c) => `"${c}"`).join(", ")})`)
        return value as T
    }

    /*  the processing type, the working directory, and the type-specific options  */
    const type    = choice("type", customTypes, "phase")
    const workdir = choice("workdir", customWorkdirs, "project")
    const phaseOnly = [ "state-incoming", "state-activity", "state-success", "state-failure", "state-phase",
        "state-passed", "state-verdict", "tag-success", "tag-failure", "tag-retry", "assign-required", "attach-skip" ]
    const requestOnly = [ "request-name", "request-done" ]
    for (const key of type === "request" ? phaseOnly : requestOnly)
        if (has(key))
            fail(key, `not allowed with "--type ${type}" (for "--type ${type === "request" ? "phase" : "request"}" only)`)
    if (has("finish-commit") && workdir !== "changeset")
        fail("finish-commit", `not allowed with "--workdir ${workdir}" (for "--workdir changeset" only)`)

    /*  the states, validated against the task lifecycle models  */
    const verdicts: Record<string, string> = {}
    for (const spec of list("state-verdict")) {
        const m = /^([A-Z]+)=([A-Z]+)$/.exec(spec)
        if (m === null)
            fail("state-verdict", `invalid value "${spec}" (expected "<VERDICT>=<STATE>")`)
        verdicts[m![1]] = m![2]
    }
    const upper    = (key: string, def: string): string => str(key, def).toUpperCase()
    const incoming = upper("state-incoming", "")
    if (type === "phase" && incoming === "")
        fail("state-incoming", "mandatory for \"--type phase\"")
    const activity = upper("state-activity", incoming)
    const success  = upper("state-success", incoming)
    const failure  = upper("state-failure", incoming)
    const phase    = upper("state-phase", success)
    const passed   = upper("state-passed", phase)
    const stateKeys: [ string, string ][] = type === "phase" ? [
        [ "state-incoming", incoming ], [ "state-activity", activity ], [ "state-success", success ],
        [ "state-failure", failure ], [ "state-phase", phase ], [ "state-passed", passed ],
        ...Object.values(verdicts).map((state): [ string, string ] => [ "state-verdict", state ])
    ] : []
    const models = Object.values(TaskFormat.taskLifecycles)
    for (const model of list("lifecycle"))
        if (!Object.hasOwn(TaskFormat.taskLifecycles, model))
            fail("lifecycle", `unknown task lifecycle model "${model}" ` +
                `(expected ${models.map((m) => `"${m.name}"`).join(", ")})`)
    for (const [ key, state ] of stateKeys)
        if (!models.some((model) => model.states.includes(state)))
            fail(key, `state "${state}" is not a state of any task lifecycle model`)
    const lifecycles = has("lifecycle") ? [ ...new Set(list("lifecycle")) ] :
        models.filter((model) => stateKeys.every(([ , state ]) => model.states.includes(state))).map((model) => model.name)
    if (lifecycles.length === 0)
        fail("lifecycle", "no task lifecycle model contains all the given states")
    for (const model of lifecycles.map((name) => TaskFormat.taskLifecycles[name])) {
        for (const [ key, state ] of stateKeys)
            if (!model.states.includes(state))
                fail(key, `state "${state}" is not a state of the "${model.name}" task lifecycle model`)
        if (type !== "phase")
            continue
        const transitions: [ string, string, string ][] = [
            [ "state-activity", incoming, activity ], [ "state-activity", activity, incoming ],
            [ "state-success", activity, success ], [ "state-failure", activity, failure ],
            ...Object.values(verdicts).map((state): [ string, string, string ] => [ "state-verdict", activity, state ])
        ]
        for (const [ key, from, to ] of transitions) {
            const error = TaskFormat.checkStatus(model, from, to)
            if (error !== "")
                fail(key, error)
        }
    }

    /*  the tag and the assignee  */
    const assignName = str("assign-name", name)
    if (!/^[A-Za-z0-9][A-Za-z0-9_.@-]*$/.test(assignName))
        fail("assign-name", `invalid assignee "${assignName}"`)
    const requestName = str("request-name", name)
    let tagName = str("tag-name", "")
    if (type === "request") {
        let tag = ""
        try {
            tag = requestsOf(requestName).tag
        }
        catch (err: unknown) {
            fail(has("request-name") ? "request-name" : "name", err instanceof Error ? err.message : String(err))
        }
        if (tagName !== "" && tagName !== tag)
            fail("tag-name", `has to be "${tag}" for the requests "${requestName}" (as attached by "ase task request")`)
        tagName = tag
    }
    else if (tagName === "")
        tagName = `ase-agent-${name.toLowerCase()}`
    if (!/^ase-agent-[a-z0-9][a-z0-9_.-]*$/.test(tagName))
        fail("tag-name", `invalid tag "${tagName}" (expected "ase-agent-<word>" in lower-case, without ":")`)
    const tagValue = (key: string): string | null | undefined => {
        const spec = str(key, tagName)
        if (spec === "none")
            return null
        else if (spec === tagName)
            return undefined
        const m = /^([^:]+):([a-z0-9][a-z0-9_.-]*)$/.exec(spec)
        if (m === null || m[1] !== tagName)
            fail(key, `invalid tag "${spec}" (expected "${tagName}", "${tagName}:<value>" in lower-case, or "none", ` +
                "as a foreign tag would let the agent claim the task again)")
        if (m![2] === "active")
            fail(key, `invalid tag "${spec}" (the value "active" marks a claimed task)`)
        return m![2]
    }
    if (flag("tag-retry") && has("tag-failure"))
        fail("tag-retry", "not allowed together with \"--tag-failure\"")
    const tagSuccess = tagValue("tag-success")
    const tagFailure = flag("tag-retry") ? null : tagValue("tag-failure")
    if (tagSuccess === null && type === "phase" && (success === incoming || Object.values(verdicts).includes(incoming)) && !has("attach-skip"))
        fail("tag-success", "\"none\" would let the agent claim a task again, which returns into the incoming state " +
            "(unless guarded by \"--attach-skip\")")
    for (const key of [ "tag-require", "tag-exclude" ])
        for (const tag of list(key))
            if (!/^[^\s,]+$/.test(tag))
                fail(key, `invalid tag "${tag}"`)
    const assignee = (key: string, def: string): string => {
        const who = str(key, def)
        if (who !== "none" && who !== "previous" && !/^[A-Za-z0-9][A-Za-z0-9_.@-]*$/.test(who))
            fail(key, `invalid assignee "${who}" (expected a name, "none", or "previous")`)
        return who
    }
    const handover = type === "phase" ? "none" : "previous"

    /*  the prompt  */
    const prompts = [ "prompt-skill", "prompt-text", "prompt-file" ].filter((key) => has(key))
    if (prompts.length !== 1)
        fail(prompts[1] ?? "prompt-skill", "exactly one of \"--prompt-skill\", \"--prompt-text\", or \"--prompt-file\" is required")
    if (has("prompt-args") && !has("prompt-skill"))
        fail("prompt-args", "allowed with \"--prompt-skill\" only")
    const skill = str("prompt-skill")
    if (has("prompt-skill") && !/^(?:[A-Za-z0-9_.-]+:)?[A-Za-z0-9_.-]+$/.test(skill))
        fail("prompt-skill", `invalid skill name "${skill}"`)
    let template: Template
    if (has("prompt-skill"))
        template = parseTemplate(str("prompt-args", type === "phase" ? "{id}" : "{id}: {prompt}"), "prompt-args", type)
    else if (has("prompt-text"))
        template = parseTemplate(str("prompt-text"), "prompt-text", type)
    else {
        let text = ""
        try {
            text = fs.readFileSync(path.resolve(str("prompt-file")), "utf8")
        }
        catch (err: unknown) {
            fail("prompt-file", `cannot read prompt file: ${err instanceof Error ? err.message : String(err)}`)
        }
        template = parseTemplate(text, "prompt-file", type)
    }

    /*  the success criteria and the verdict  */
    const criteria = has("success-criterion") ? [ ...new Set(list("success-criterion")) ] :
        (type === "phase" ? [ "exit", "clean" ] : [ "clean", "changed" ])
    for (const criterion of criteria) {
        if (!(customCriteria as readonly string[]).includes(criterion))
            fail("success-criterion", `invalid criterion "${criterion}" ` +
                `(expected ${customCriteria.map((c) => `"${c}"`).join(", ")})`)
        else if (criterion === "changed" && type !== "request")
            fail("success-criterion", "criterion \"changed\" is for \"--type request\" only")
        else if (criterion === "status" && type !== "phase")
            fail("success-criterion", "criterion \"status\" is for \"--type phase\" only")
        else if (criterion === "verdict" && !has("verdict-label"))
            fail("success-criterion", "criterion \"verdict\" requires \"--verdict-label\"")
        else if (criterion === "attachment" && !has("attach-expect"))
            fail("success-criterion", "criterion \"attachment\" requires \"--attach-expect\"")
    }
    const match = list("success-match").map((spec) => {
        try {
            return new RegExp(spec)
        }
        catch (err: unknown) {
            return fail("success-match", `invalid regular expression "${spec}": ${err instanceof Error ? err.message : String(err)}`)
        }
    })
    if ((Object.keys(verdicts).length > 0 || has("verdict-allow")) && !has("verdict-label"))
        fail(Object.keys(verdicts).length > 0 ? "state-verdict" : "verdict-allow", "requires \"--verdict-label\"")
    const allow = has("verdict-allow") ? list("verdict-allow") : Object.keys(verdicts)
    for (const verdict of allow)
        if (!/^[A-Z]+$/.test(verdict))
            fail("verdict-allow", `invalid verdict "${verdict}" (expected an upper-case word)`)
    for (const verdict of Object.keys(verdicts))
        if (!allow.includes(verdict))
            fail("state-verdict", `verdict "${verdict}" is not accepted by "--verdict-allow"`)

    /*  the attachments  */
    const kindRe = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/
    const attachSpec = (key: string): AttachSpec | null => {
        if (!has(key))
            return null
        const spec = str(key)
        const i    = spec.indexOf(";")
        const mime = i < 0 ? "" : spec.slice(0, i).trim().toLowerCase()
        const kind = i < 0 ? spec.trim() : spec.slice(i + 1).trim()
        if (!kindRe.test(kind) || (i >= 0 && !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)))
            fail(key, `invalid attachment "${spec}" (expected "[<mime-type>;]<kind>")`)
        return { mime, kind }
    }
    const attachLog = str("attach-log", name)
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(attachLog))
        fail("attach-log", `invalid name "${attachLog}"`)
    if (has("attach-output") && !kindRe.test(str("attach-output")))
        fail("attach-output", `invalid kind "${str("attach-output")}"`)
    for (const key of [ "prepare-run", "finish-success", "finish-failure" ])
        if ((has(key) && str(key, "-") === "") || list(key).some((cmd) => cmd.trim() === ""))
            fail(key, "empty shell command")

    return {
        name, type, workdir, lifecycles,
        serial:  flag("serial"),
        state:   { incoming, activity, success, failure, phase, passed, verdict: verdicts },
        tag:     { name: tagName, success: tagSuccess, failure: tagFailure, require: list("tag-require"), exclude: list("tag-exclude") },
        assign:  {
            name: assignName, required: flag("assign-required"),
            success: assignee("assign-success", handover), failure: assignee("assign-failure", handover)
        },
        request: { name: requestName, done: str("request-done", "processed") },
        prompt:  { skill, template },
        prepare: list("prepare-run"),
        success: { criteria: criteria as CustomCriterion[], match },
        verdict: { label: str("verdict-label"), allow },
        attach:  { log: attachLog, output: str("attach-output"), expect: attachSpec("attach-expect"), skip: attachSpec("attach-skip") },
        finish:  { commit: flag("finish-commit"), success: str("finish-success"), failure: str("finish-failure") }
    }
}

