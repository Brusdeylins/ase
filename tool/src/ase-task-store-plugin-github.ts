/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { Octokit }             from "@octokit/core"
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods"
import { paginateRest }        from "@octokit/plugin-paginate-rest"
import { DateTime }            from "luxon"
import { LRUCache }            from "lru-cache"

import * as API                from "./ase-task-store-plugin-api.js"
import * as TaskFormat         from "./ase-task-format.js"

/*  the options of the GitHub storage plugin: the access token (default:
    $GITHUB_TOKEN, else $GH_TOKEN), the mapping of project ids onto
    "<owner>/<repo>" repositories, and the polling interval of the change
    detection in seconds (default: 60, 0 disables it)  */
export type TaskStoragePluginOptions = {
    token?: string
    repos?: Record<string, string>
    poll?:  number
}

/*  the GitHub REST API client: the core with the endpoint methods and the pagination  */
const GitHub = Octokit.plugin(restEndpointMethods, paginateRest)
type Client  = InstanceType<typeof GitHub>

/*  the used parts of the issues and comments as delivered by the GitHub REST API  */
type Repo    = { owner: string, repo: string }
type Issue   = {
    id:                          number
    number:                      number
    title:                       string
    body?:                       string | null
    state:                       string
    state_reason?:               string | null
    labels:                      (string | { name?: string })[]
    assignees?:                  { login: string }[] | null
    milestone:                   { title: string } | null
    comments:                    number
    created_at:                  string
    updated_at:                  string
    repository_url:              string
    pull_request?:               unknown
    parent_issue_url?:           string | null
    issue_dependencies_summary?: { total_blocked_by: number }
}
type Comment = {
    id:          number
    body?:       string
    user:        { login: string } | null
    created_at:  string
    updated_at:  string
}

/*  the "seq" task id scheme, the only one whose ids can be issue numbers  */
type SeqScheme = Extract<TaskFormat.TaskIdScheme, { kind: "seq" }>

/*  the change detection state of a project: the "since" timestamp and the
    entity tag of the last poll, and the last seen update time per issue number  */
type PollState = { since: string, etag?: string, seen: Map<number, string> }

/*  the reserved labels: the project registry entry (carrying the lifecycle model
    and task id scheme in its description), the soft deletion marker, and the
    "ase:<key>:<value>" labels of the header keys without a native counterpart  */
const LABEL_PROJECT = "ase:project"
const LABEL_DELETED = "ase:deleted"
const LABEL_KEY_RE  = /^ase:([A-Za-z]+):(.*)$/

/*  the header keys mapped onto native issue fields (or derived from them),
    hence never carried by "ase:<key>:<value>" labels  */
const nativeKeys = [ "Type", "Id", "Created", "Modified", "Group", "Phase", "After", "Tags", "Assignee" ]

/*  the hidden metadata header of an attachment comment  */
const ATTACH_RE = /^<!-- ase:attachment\n([\s\S]*?)\n-->\n?([\s\S]*)$/

/*  escape a hidden metadata value, so it can never close the HTML comment  */
const escapeValue   = (value: string): string => value.replace(/&/g, "&amp;").replace(/-->/g, "--&gt;")
const unescapeValue = (value: string): string => value.replace(/--&gt;/g, "-->").replace(/&amp;/g, "&")

/*  the timestamp of the task plan format for an ISO timestamp of GitHub  */
const stamp = (iso: string): string => DateTime.fromISO(iso).toFormat("yyyy-LL-dd HH:mm")

/*  the current time as ISO timestamp in the second-precise shape of GitHub  */
const now = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z")

/*  map a "not found" (404) or "gone" (410) request failure onto null  */
const statusOf = (err: unknown): unknown => (err as { status?: unknown } | null)?.status
const found = <T>(p: Promise<T>): Promise<T | null> => p.catch((err: unknown) => {
    if (statusOf(err) === 404 || statusOf(err) === 410)
        return null
    throw err
})

/*  the task id of an issue number, and the issue number of a task id (0 if not conforming)  */
const idOf = (scheme: SeqScheme, n: number): string =>
    `${scheme.prefix}${String(n).padStart(scheme.width, "0")}${scheme.suffix}`
const numberOf = (scheme: SeqScheme, id: string): number => {
    const n = TaskFormat.seqNumber(scheme, id)
    return n > 0 && idOf(scheme, n) === id ? n : 0
}

/*  the label names of an issue, and whether an issue is a live task (no pull request, not soft deleted)  */
const labelNames = (issue: Issue): string[] =>
    issue.labels.map((label) => typeof label === "string" ? label : label.name ?? "")
const live = (issue: Issue): boolean =>
    (issue.pull_request === undefined || issue.pull_request === null) && !labelNames(issue).includes(LABEL_DELETED)

/*  the issue number an API URL of the given repository refers to (else null)  */
const sameRepo = (loc: Repo, owner: string, repo: string): boolean =>
    owner.toLowerCase() === loc.owner.toLowerCase() && repo.toLowerCase() === loc.repo.toLowerCase()
const parentOf = (loc: Repo, issue: Issue): number | null => {
    const m = /\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/.exec(issue.parent_issue_url ?? "")
    return m !== null && sameRepo(loc, m[1], m[2]) ? Number.parseInt(m[3], 10) : null
}
const inRepo = (loc: Repo, issue: Issue): boolean => {
    const m = /\/repos\/([^/]+)\/([^/]+)$/.exec(issue.repository_url)
    return m !== null && sameRepo(loc, m[1], m[2])
}

/*  whether an attachment is embedded as-is (Markdown) instead of as fenced code block  */
const isMarkdown = (type: string | undefined): boolean => /^text\/markdown\b/i.test(type ?? "")

/*  whether two attachments are equal  */
const same = (a: API.TaskAttachment, b: API.TaskAttachment): boolean => {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    return ka.length === kb.length && ka.every((key, i) => key === kb[i] && a[key] === b[key])
}

/*  the GitHub storage plugin: a project is a repository (registered by its
    "ase:project" label) and a task plan is a live issue, its id being the issue
    number rendered through the mandatory "seq" task id scheme; the title maps onto
    the issue title (and the "#   TASK:" heading), the body onto the issue body,
    "Status" onto the issue state refined by an "ase:Status:<state>" label, "Tags"
    onto labels, "Assignee" onto the assignee, "Phase" onto the milestone, "Group"
    onto the parent issue, "After" onto the blocking issues, "Created"/"Modified"
    onto the issue timestamps, any other key onto "ase:<key>:<value>" labels, and
    the attachments onto the issue comments  */
class GitHubTaskStoragePlugin implements API.TaskStoragePlugin {
    readonly name = "github"
    private gh:         Client
    private repos       = new Map<string, Repo>()
    private poll:       number
    private listener:   ((prjId: string, change: API.TaskChange) => void) | null = null
    private timer:      ReturnType<typeof setInterval> | null = null
    private polling     = false
    private opened      = now()
    private polls       = new Map<string, PollState>()
    private registry    = new LRUCache<string, { value: { lifecycle: string, idscheme: string } | null }>({ max: 64, ttl: 10 * 1000 })
    private latest      = new Map<string, { etag: string, number: number }>()
    private labels      = new Map<string, Set<string>>()
    private milestones  = new Map<string, Map<string, number>>()

    constructor (private ctx: API.TaskStorageContext) {
        const options = ctx.options as TaskStoragePluginOptions
        const token   = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ""
        if (typeof token !== "string" || token === "")
            throw new Error("task store: plugin \"github\" requires the \"token\" option (or $GITHUB_TOKEN resp. $GH_TOKEN)")
        if (typeof options.repos !== "object" || options.repos === null || Array.isArray(options.repos))
            throw new Error("task store: plugin \"github\" requires the \"repos\" option (mapping project ids onto \"<owner>/<repo>\")")
        for (const [ prjId, spec ] of Object.entries(options.repos)) {
            const m = typeof spec === "string" ? /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(spec) : null
            if (m === null || !TaskFormat.ID_RE.test(prjId))
                throw new Error(`task store: plugin "github" received invalid repository mapping "${prjId}: ${String(spec)}"`)
            this.repos.set(prjId, { owner: m[1], repo: m[2] })
        }
        this.poll = options.poll ?? 60
        if (typeof this.poll !== "number" || !Number.isFinite(this.poll) || this.poll < 0)
            throw new Error("task store: plugin \"github\" requires a non-negative \"poll\" interval")

        /*  route the diagnostics of Octokit into the log, as the standard
            output may carry a protocol (like the one of an MCP server)  */
        this.gh = new GitHub({
            auth:      token,
            userAgent: "ase-task-store-github",
            log: {
                debug: () => {},
                info:  () => {},
                warn:  (message: string) => ctx.log("warning", message),
                error: (message: string) => ctx.log("error", message)
            }
        })

        /*  explain a denied access (but not an exceeded rate limit), as the
            GitHub message names neither the token source nor the missing permission  */
        const source = options.token !== undefined ? "the \"token\" option (resp. \"project.task.token\")" :
            process.env.GITHUB_TOKEN !== undefined ? "$GITHUB_TOKEN" : "$GH_TOKEN"
        this.gh.hook.error("request", (err, request) => {
            const status = statusOf(err)
            if ((status === 401 || status === 403) && !/rate limit/i.test(err.message)) {
                const repo = typeof request.owner === "string" && typeof request.repo === "string" ?
                    ` to repository "${request.owner}/${request.repo}"` : ""
                throw new Error(`GitHub denied access${repo} (HTTP ${String(status)}: ${err.message}) -- ` +
                    `the token of ${source} needs access to the repository with the permission ` +
                    "\"Issues: Read and write\" (fine-grained token) resp. the scope \"repo\" or \"public_repo\" (classic token)",
                { cause: err })
            }
            throw err
        })
    }

    /*  the storage lifecycle: polling for changes while opened and observed
        (without keeping the process alive)  */
    async open (): Promise<void> {
        this.opened = now()
        if (this.poll > 0 && this.listener !== null) {
            this.timer = setInterval(() => {
                this.pollAll().catch(() => {})
            }, this.poll * 1000)
            this.timer.unref()
        }
        this.ctx.log("debug", `opened ${this.repos.size} repositories (polling every ${this.poll}s)`)
    }
    async close (): Promise<void> {
        if (this.timer !== null)
            clearInterval(this.timer)
        this.timer = null
    }

    /*  observe the changes of the issues made outside of this plugin instance  */
    watch (listener: (prjId: string, change: API.TaskChange) => void): void {
        this.listener = listener
    }

    /*  ==== project registry ====  */

    /*  the repository of a project  */
    private repo (prjId: string): Repo {
        const loc = this.repos.get(prjId)
        if (loc === undefined)
            throw new Error(`project "${prjId}" is not mapped onto a GitHub repository (see option "repos")`)
        return loc
    }

    /*  the registry entry of a project, read from the description of its "ase:project" label  */
    private async registered (prjId: string): Promise<{ lifecycle: string, idscheme: string } | null> {
        const cached = this.registry.get(prjId)
        if (cached !== undefined)
            return cached.value
        const loc = this.repos.get(prjId)
        let value: { lifecycle: string, idscheme: string } | null = null
        if (loc !== undefined) {
            const label = await found(this.gh.rest.issues.getLabel({ ...loc, name: LABEL_PROJECT }))
            if (label !== null) {
                const m = /^lifecycle=(\S+) idscheme=(\S+)$/.exec(label.data.description ?? "")
                value = { lifecycle: m?.[1] ?? "solo", idscheme: m?.[2] ?? "seq:#%d" }
            }
        }
        this.registry.set(prjId, { value })
        return value
    }

    /*  the repository, lifecycle model, and task id scheme of a registered project  */
    private async context (prjId: string): Promise<{ loc: Repo, lifecycle: TaskFormat.TaskLifecycle, scheme: SeqScheme }> {
        const loc   = this.repo(prjId)
        const entry = await this.registered(prjId)
        if (entry === null)
            throw new Error(`project "${prjId}" not registered`)
        const lifecycle = Object.hasOwn(TaskFormat.taskLifecycles, entry.lifecycle) ?
            TaskFormat.taskLifecycles[entry.lifecycle] : TaskFormat.taskLifecycles.solo
        const scheme = TaskFormat.parseIdScheme(entry.idscheme)
        if (scheme.kind !== "seq")
            throw new Error(`project "${prjId}" carries task id scheme "${entry.idscheme}", but GitHub requires a "seq" one`)
        return { loc, lifecycle, scheme }
    }

    /*  the highest issue or pull request number of a repository (conditionally requested)  */
    private async latestNumber (loc: Repo): Promise<number> {
        const key    = `${loc.owner}/${loc.repo}`
        const cached = this.latest.get(key)
        try {
            const r = await this.gh.request("GET /repos/{owner}/{repo}/issues", {
                ...loc, state: "all", sort: "created", direction: "desc", per_page: 1,
                headers: cached !== undefined ? { "if-none-match": cached.etag } : {}
            })
            const number = r.data[0]?.number ?? 0
            if (r.headers.etag !== undefined)
                this.latest.set(key, { etag: r.headers.etag, number })
            return number
        }
        catch (err: unknown) {
            if (cached !== undefined && statusOf(err) === 304)
                return cached.number
            throw err
        }
    }

    async projectList (): Promise<API.ProjectEntry[]> {
        const out: API.ProjectEntry[] = []
        for (const prjId of this.repos.keys()) {
            const entry = await this.projectGet(prjId)
            if (entry !== null)
                out.push(entry)
        }
        return out
    }

    /*  get a project, with the highest issue number as the sequence number high-water
        mark, so the next allocated task id is the one of the next created issue  */
    async projectGet (prjId: string): Promise<API.ProjectEntry | null> {
        const entry = await this.registered(prjId)
        if (entry === null)
            return null
        return { id: prjId, ...entry, seqmark: await this.latestNumber(this.repo(prjId)) }
    }
    async projectSet (prjId: string, lifecycle: string, idscheme: string): Promise<API.WriteResult> {
        const loc = this.repo(prjId)
        if (TaskFormat.parseIdScheme(idscheme).kind !== "seq")
            throw new Error(`task id scheme "${idscheme}" not supported, as task ids are GitHub issue numbers ` +
                "(use a \"seq\" task id scheme like \"seq:#%d\")")
        const description = `lifecycle=${lifecycle} idscheme=${idscheme}`
        const label = await found(this.gh.rest.issues.getLabel({ ...loc, name: LABEL_PROJECT }))
        if (label === null)
            await this.gh.rest.issues.createLabel({ ...loc, name: LABEL_PROJECT, color: "5319e7", description })
        else if (label.data.description !== description)
            await this.gh.rest.issues.updateLabel({ ...loc, name: LABEL_PROJECT, description })
        this.registry.delete(prjId)
        return label === null ? "created" : "updated"
    }
    async projectDelete (prjId: string): Promise<boolean> {
        const loc = this.repos.get(prjId)
        if (loc === undefined)
            return false
        const result = await found(this.gh.rest.issues.deleteLabel({ ...loc, name: LABEL_PROJECT }))
        this.registry.delete(prjId)
        return result !== null
    }

    /*  ==== issue mapping ====  */

    /*  fetch the live issue of an issue number (null if none)  */
    private async fetch (loc: Repo, n: number): Promise<Issue | null> {
        if (n === 0)
            return null
        const issue = await found(this.gh.rest.issues.get({ ...loc, issue_number: n }).then((r) => r.data as Issue))
        return issue !== null && issue.number === n && inRepo(loc, issue) && live(issue) ? issue : null
    }

    /*  the blocking issues of an issue within its repository  */
    private async blockers (loc: Repo, issue: Issue): Promise<Issue[]> {
        if ((issue.issue_dependencies_summary?.total_blocked_by ?? 0) === 0)
            return []
        const blockers = await this.gh.paginate(this.gh.rest.issues.listDependenciesBlockedBy,
            { ...loc, issue_number: issue.number, per_page: 100 }) as Issue[]
        return blockers.filter((blocker) => inRepo(loc, blocker))
    }

    /*  the comments of an issue  */
    private async comments (loc: Repo, issue: Issue): Promise<Comment[]> {
        if (issue.comments === 0)
            return []
        return await this.gh.paginate(this.gh.rest.issues.listComments,
            { ...loc, issue_number: issue.number, per_page: 100 }) as Comment[]
    }

    /*  derive the header of an issue: the natively mapped keys, "Status" from the
        issue state (closed for the finished states, "not_planned" for "CANCELLED")
        refined by its "ase:Status:<state>" label, and all other keys from their
        "ase:<key>:<value>" labels  */
    private header (loc: Repo, lifecycle: TaskFormat.TaskLifecycle, scheme: SeqScheme, issue: Issue, after: Issue[]): API.TaskHeader {
        const header: API.TaskHeader = {
            Type:     TaskFormat.TASK_TYPE,
            Id:       idOf(scheme, issue.number),
            Created:  stamp(issue.created_at),
            Modified: stamp(issue.updated_at)
        }
        const parent = parentOf(loc, issue)
        if (parent !== null)
            header.Group = idOf(scheme, parent)
        if (issue.milestone !== null)
            header.Phase = issue.milestone.title
        if (after.length > 0)
            header.After = after.map((blocker) => idOf(scheme, blocker.number))
        const tags: string[] = []
        let status: string | undefined
        for (const name of labelNames(issue)) {
            const m = LABEL_KEY_RE.exec(name)
            if (m === null && !name.startsWith("ase:"))
                tags.push(name)
            else if (m !== null && m[1] === "Status")
                status = m[2]
            else if (m !== null && (!nativeKeys.includes(m[1]) || m[1] === "Assignee"))
                header[m[1]] = m[2]
        }
        if (tags.length > 0)
            header.Tags = tags
        const assignee = issue.assignees?.[0]?.login
        if (assignee !== undefined)
            header.Assignee = assignee
        if (issue.state === "closed")
            header.Status = issue.state_reason === "not_planned" ? "CANCELLED" :
                status !== undefined && status !== "CANCELLED" && lifecycle.finished.includes(status) ? status : lifecycle.finished[0]
        else if (status !== undefined && !lifecycle.finished.includes(status))
            header.Status = status
        return header
    }

    /*  derive the body of an issue: the "#   TASK:" heading from the issue title plus the issue body  */
    private body (issue: Issue): string {
        const text = (issue.body ?? "").replace(/\r\n/g, "\n").replace(/\n+$/, "")
        return `#   TASK: ${issue.title}\n` + (text !== "" ? `\n${text}\n` : "")
    }

    /*  derive the attachment of a comment: an attachment comment carries its keys in
        the hidden metadata header (with "Data" giving the "|4+" or "|4-" chomping)
        followed by the data (fenced, unless Markdown), and any other comment reads
        as a Markdown attachment  */
    private attachment (comment: Comment): API.TaskAttachment {
        const text = (comment.body ?? "").replace(/\r\n/g, "\n")
        const m    = ATTACH_RE.exec(text)
        if (m === null)
            return {
                Type:     "text/markdown",
                Desc:     `comment by @${comment.user?.login ?? "ghost"}`,
                Created:  stamp(comment.created_at),
                Modified: stamp(comment.updated_at),
                Data:     text
            }
        const attachment: API.TaskAttachment = {}
        let chomp: string | undefined
        for (const line of m[1].split("\n")) {
            const kv = /^([A-Za-z]+):[ \t]*(.*)$/.exec(line)
            if (kv === null)
                continue
            if (kv[1] === "Data")
                chomp = kv[2].trim()
            else
                attachment[kv[1]] = unescapeValue(kv[2].trimEnd())
        }
        if (chomp !== undefined) {
            let data = m[2]
            if (!isMarkdown(attachment.Type))
                data = data.replace(/^[^\n]*\n/, "").replace(/\n?[^\n]*$/, "")
            data = data.replace(/\n+$/, "")
            attachment.Data = data !== "" && chomp !== "|4-" ? `${data}\n` : data
        }
        return attachment
    }

    /*  render the comment of an attachment (see above)  */
    private comment (attachment: API.TaskAttachment): string {
        const lines = Object.keys(attachment).filter((key) => key !== "Data")
            .map((key) => `${key}:`.padEnd(10) + escapeValue(attachment[key]))
        let text = ""
        if (attachment.Data !== undefined) {
            const data = attachment.Data.replace(/\n$/, "")
            lines.push("Data:".padEnd(10) + (attachment.Data !== "" && !attachment.Data.endsWith("\n") ? "|4-" : "|4+"))
            if (isMarkdown(attachment.Type))
                text = data
            else {
                const fence = "`".repeat(Math.max(3, ...Array.from(data.matchAll(/`+/g), (run) => run[0].length + 1)))
                text = `${fence}${/diff/i.test(attachment.Type ?? "") ? "diff" : ""}\n${data}${data !== "" ? "\n" : ""}${fence}`
            }
        }
        return `<!-- ase:attachment\n${lines.join("\n")}\n-->\n${text}`
    }

    /*  the listing entry of an issue  */
    private async entry (loc: Repo, lifecycle: TaskFormat.TaskLifecycle, scheme: SeqScheme, issue: Issue): Promise<API.TaskEntry> {
        const header = this.header(loc, lifecycle, scheme, issue, await this.blockers(loc, issue))
        return { id: idOf(scheme, issue.number), title: issue.title, header, mtime: new Date(issue.updated_at) }
    }

    /*  ==== issue updating ====  */

    /*  ensure the existence of labels (with the known labels of a repository cached)  */
    private async ensureLabels (loc: Repo, names: string[]): Promise<void> {
        const key   = `${loc.owner}/${loc.repo}`
        let known   = this.labels.get(key)
        if (known === undefined) {
            const labels = await this.gh.paginate(this.gh.rest.issues.listLabelsForRepo, { ...loc, per_page: 100 })
            known = new Set(labels.map((label) => label.name.toLowerCase()))
            this.labels.set(key, known)
        }
        for (const name of names) {
            if (known.has(name.toLowerCase()))
                continue
            await this.gh.rest.issues.createLabel({ ...loc, name, color: name.startsWith("ase:") ? "c5def5" : "ededed" })
                .catch((err: unknown) => {
                    /*  tolerate a label created concurrently  */
                    if (statusOf(err) !== 422)
                        throw err
                })
            known.add(name.toLowerCase())
        }
    }

    /*  delete the "ase:<key>:<value>" labels no longer used by any issue  */
    private async collectLabels (loc: Repo, names: string[]): Promise<void> {
        for (const name of names) {
            if (!LABEL_KEY_RE.test(name) || name.includes(","))
                continue
            const r = await this.gh.rest.issues.listForRepo({ ...loc, labels: name, state: "all", per_page: 1 })
            if (r.data.length === 0) {
                await found(this.gh.rest.issues.deleteLabel({ ...loc, name }))
                this.labels.get(`${loc.owner}/${loc.repo}`)?.delete(name.toLowerCase())
            }
        }
    }

    /*  the number of a milestone by its title (created on demand)  */
    private async milestone (loc: Repo, title: string): Promise<number> {
        const key = `${loc.owner}/${loc.repo}`
        let map   = this.milestones.get(key)
        if (map === undefined) {
            const milestones = await this.gh.paginate(this.gh.rest.issues.listMilestones, { ...loc, state: "all", per_page: 100 })
            map = new Map(milestones.map((milestone) => [ milestone.title, milestone.number ]))
            this.milestones.set(key, map)
        }
        let number = map.get(title)
        if (number === undefined) {
            number = (await this.gh.rest.issues.createMilestone({ ...loc, title })).data.number
            map.set(title, number)
        }
        return number
    }

    /*  the live issue a header key references by its task id, else an error  */
    private async target (loc: Repo, scheme: SeqScheme, key: string, id: string): Promise<Issue> {
        const issue = await this.fetch(loc, numberOf(scheme, id))
        if (issue === null)
            throw new Error(`header key "${key}" references no existing task "${id}"`)
        return issue
    }

    /*  determine the labels and assignees of a header: the tags, the "ase:<key>:<value>"
        labels of the keys without native counterpart, and the assignee if it can be
        assigned natively (keeping further native assignees), else its label  */
    private async assign (loc: Repo, header: API.TaskHeader, issue: Issue | null): Promise<{ labels: string[], assignees: string[] }> {
        const labels: string[] = []
        for (const [ key, value ] of Object.entries(header))
            if (!nativeKeys.includes(key) && typeof value === "string")
                labels.push(`ase:${key}:${value}`)
        for (const tag of Array.isArray(header.Tags) ? header.Tags : []) {
            if (tag.startsWith("ase:"))
                throw new Error(`tag "${tag}" collides with the reserved "ase:" labels`)
            labels.push(tag)
        }
        let assignees: string[] = []
        const assignee = header.Assignee
        if (typeof assignee === "string" && assignee !== "") {
            const logins = issue?.assignees?.map((user) => user.login) ?? []
            if (logins.includes(assignee))
                assignees = logins
            else if (await found(this.gh.rest.issues.checkUserCanBeAssigned({ ...loc, assignee })) !== null)
                assignees = [ assignee ]
            else
                labels.push(`ase:Assignee:${assignee}`)
        }
        await this.ensureLabels(loc, labels)
        return { labels, assignees }
    }

    /*  synchronize the parent issue (keeping a parent of a foreign repository if none is wanted)  */
    private async syncParent (loc: Repo, issue: Issue, parent: Issue | null): Promise<void> {
        const current = parentOf(loc, issue)
        if (parent !== null && parent.number !== current)
            await this.gh.rest.issues.addSubIssue({ ...loc, issue_number: parent.number, sub_issue_id: issue.id, replace_parent: true })
        else if (parent === null && current !== null)
            await this.gh.rest.issues.removeSubIssue({ ...loc, issue_number: current, sub_issue_id: issue.id })
    }

    /*  synchronize the blocking issues (within the repository)  */
    private async syncBlockers (loc: Repo, issue: Issue, after: Issue[]): Promise<void> {
        const current = await this.blockers(loc, issue)
        const have    = new Set(current.map((blocker) => blocker.number))
        const want    = new Set(after.map((blocker) => blocker.number))
        for (const blocker of after)
            if (!have.has(blocker.number))
                await this.gh.rest.issues.addBlockedByDependency({ ...loc, issue_number: issue.number, issue_id: blocker.id })
        for (const blocker of current)
            if (!want.has(blocker.number))
                await this.gh.rest.issues.removeDependencyBlockedBy({ ...loc, issue_number: issue.number, issue_id: blocker.id })
    }

    /*  synchronize the comments with the attachments by position, rewriting changed ones only  */
    private async syncComments (loc: Repo, issue: Issue, attachments: API.TaskAttachment[]): Promise<void> {
        const comments = await this.comments(loc, issue)
        for (let i = 0; i < Math.max(comments.length, attachments.length); i++) {
            if (i >= attachments.length)
                await this.gh.rest.issues.deleteComment({ ...loc, comment_id: comments[i].id })
            else if (i >= comments.length)
                await this.gh.rest.issues.createComment({ ...loc, issue_number: issue.number, body: this.comment(attachments[i]) })
            else if (!same(this.attachment(comments[i]), attachments[i]))
                await this.gh.rest.issues.updateComment({ ...loc, comment_id: comments[i].id, body: this.comment(attachments[i]) })
        }
    }

    /*  remember the update time of an issue written by this plugin instance,
        so the change detection does not report it as an external change  */
    private written (prjId: string, issue: Issue): void {
        this.pollState(prjId).seen.set(issue.number, issue.updated_at)
    }

    /*  ==== task plans ====  */

    async taskList (prjId: string): Promise<API.TaskEntry[]> {
        const { loc, lifecycle, scheme } = await this.context(prjId)
        const issues = await this.gh.paginate(this.gh.rest.issues.listForRepo, { ...loc, state: "all", per_page: 100 }) as Issue[]
        return Promise.all(issues.filter((issue) => live(issue))
            .map((issue) => this.entry(loc, lifecycle, scheme, issue)))
    }
    async taskLoad (prjId: string, taskId: string): Promise<API.TaskPlan | null> {
        const { loc, lifecycle, scheme } = await this.context(prjId)
        const issue = await this.fetch(loc, numberOf(scheme, taskId))
        if (issue === null)
            return null
        const [ after, comments ] = await Promise.all([ this.blockers(loc, issue), this.comments(loc, issue) ])
        return {
            header:     this.header(loc, lifecycle, scheme, issue, after),
            body:       this.body(issue),
            attachment: comments.map((comment) => this.attachment(comment))
        }
    }

    /*  create or update the issue of a task plan: all references are resolved
        upfront, a new task can only be the next issue number, and the issue itself
        is updated last, so its update time covers the relation and comment changes  */
    async taskSave (prjId: string, taskId: string, plan: API.TaskPlan): Promise<API.WriteResult> {
        const { loc, lifecycle, scheme } = await this.context(prjId)
        const number = numberOf(scheme, taskId)
        if (number === 0)
            throw new Error(`task id "${taskId}" is no issue number rendered through the "seq" task id scheme of the project`)
        let issue    = await this.fetch(loc, number)
        const result: API.WriteResult = issue !== null ? "updated" : "created"
        const group  = plan.header.Group
        const parent = typeof group === "string" && group !== "" ? await this.target(loc, scheme, "Group", group) : null
        const after  = await Promise.all((Array.isArray(plan.header.After) ? plan.header.After : [])
            .map((id) => this.target(loc, scheme, "After", id)))
        const phase  = plan.header.Phase
        const milestone = typeof phase === "string" && phase !== "" ? await this.milestone(loc, phase) : null
        const { labels, assignees } = await this.assign(loc, plan.header, issue)
        const status = TaskFormat.taskStatus(plan.header, lifecycle)
        const closed = lifecycle.finished.includes(status)
        const title  = TaskFormat.taskTitle(plan.body) || taskId
        const body   = plan.body.replace(/^#[ \t]+TASK:.*(?:\n|$)/m, "").replace(/^\n+/, "").replace(/\n+$/, "")
        if (issue === null) {
            /*  reject a task id deviating from the next issue number, and
                discard an issue which lost the race for this number  */
            const next = await this.latestNumber(loc) + 1
            if (number !== next)
                throw new Error(`task "${taskId}" cannot be created, as the next issue will be "${idOf(scheme, next)}"`)
            issue = (await this.gh.rest.issues.create({ ...loc, title, body, labels, assignees, milestone })).data as Issue
            if (issue.number !== number) {
                await this.ensureLabels(loc, [ LABEL_DELETED ])
                await this.gh.rest.issues.update({
                    ...loc, issue_number: issue.number, state: "closed", state_reason: "not_planned",
                    labels: [ ...labels, LABEL_DELETED ]
                })
                throw new Error(`task "${taskId}" cannot be created, as issue "${idOf(scheme, number)}" was created concurrently`)
            }
        }
        await this.syncParent(loc, issue, parent)
        await this.syncBlockers(loc, issue, after)
        await this.syncComments(loc, issue, plan.attachment)
        const updated = (await this.gh.rest.issues.update({
            ...loc, issue_number: number, title, body, labels, assignees, milestone,
            state: closed ? "closed" : "open",
            ...(closed ? { state_reason: status === "CANCELLED" ? "not_planned" as const : "completed" as const } : {})
        })).data as Issue
        this.written(prjId, updated)
        await this.collectLabels(loc, labelNames(issue).filter((name) => !labels.includes(name)))
        return result
    }

    /*  soft delete the issue of a task plan: closed as "not planned" and marked as deleted  */
    async taskDelete (prjId: string, taskId: string): Promise<boolean> {
        const { loc, scheme } = await this.context(prjId)
        const issue = await this.fetch(loc, numberOf(scheme, taskId))
        if (issue === null)
            return false
        await this.ensureLabels(loc, [ LABEL_DELETED ])
        const updated = (await this.gh.rest.issues.update({
            ...loc, issue_number: issue.number, state: "closed", state_reason: "not_planned",
            labels: [ ...labelNames(issue), LABEL_DELETED ]
        })).data as Issue
        this.written(prjId, updated)
        return true
    }

    /*  renaming is impossible, as the task id is the issue number  */
    async taskRename (prjId: string, oldId: string, newId: string): Promise<boolean> {
        const { loc, scheme } = await this.context(prjId)
        if (await this.fetch(loc, numberOf(scheme, oldId)) === null)
            return false
        throw new Error(`task "${oldId}" cannot be renamed to "${newId}", as task ids are GitHub issue numbers`)
    }

    /*  ==== change detection ====  */

    /*  the change detection state of a project (starting at the opening time)  */
    private pollState (prjId: string): PollState {
        let state = this.polls.get(prjId)
        if (state === undefined) {
            state = { since: this.opened, seen: new Map() }
            this.polls.set(prjId, state)
        }
        return state
    }

    /*  poll all registered projects, never overlapping itself  */
    private async pollAll (): Promise<void> {
        if (this.polling)
            return
        this.polling = true
        try {
            for (const prjId of this.repos.keys())
                await this.pollProject(prjId).catch((err: unknown) => {
                    this.ctx.log("warning", `polling project "${prjId}" failed: ${err instanceof Error ? err.message : String(err)}`)
                })
        }
        finally {
            this.polling = false
        }
    }

    /*  poll the issues of a project updated since the last poll, conditionally
        via the entity tag of the last poll (a "304" answer is free of rate limit),
        and report the issues not seen at their update time yet: as added if created
        after the opening, as deleted if soft deleted, else as updated (issues deleted
        on GitHub are not reported, as GitHub reports no deletions)  */
    private async pollProject (prjId: string): Promise<void> {
        const listener = this.listener
        if (listener === null || await this.registered(prjId) === null)
            return
        const { loc, lifecycle, scheme } = await this.context(prjId)
        const state  = this.pollState(prjId)
        const params = { ...loc, state: "all" as const, sort: "updated" as const, direction: "asc" as const, since: state.since, per_page: 100 }
        let issues: Issue[]
        try {
            const r = await this.gh.request("GET /repos/{owner}/{repo}/issues", {
                ...params, headers: state.etag !== undefined ? { "if-none-match": state.etag } : {}
            })
            state.etag = r.headers.etag
            issues = r.data as Issue[]
            if (issues.length === params.per_page)
                issues.push(...await this.gh.paginate("GET /repos/{owner}/{repo}/issues", { ...params, page: 2 }) as Issue[])
        }
        catch (err: unknown) {
            if (statusOf(err) === 304)
                return
            throw err
        }
        const change = { added: [] as API.TaskEntry[], updated: [] as API.TaskEntry[], deleted: [] as string[] }
        for (const issue of issues) {
            if (issue.pull_request !== undefined && issue.pull_request !== null)
                continue
            if (issue.updated_at > state.since)
                state.since = issue.updated_at
            if (state.seen.get(issue.number) === issue.updated_at)
                continue
            const known = state.seen.has(issue.number)
            state.seen.set(issue.number, issue.updated_at)
            if (!live(issue))
                change.deleted.push(idOf(scheme, issue.number))
            else if (!known && issue.created_at >= this.opened)
                change.added.push(await this.entry(loc, lifecycle, scheme, issue))
            else
                change.updated.push(await this.entry(loc, lifecycle, scheme, issue))
        }
        if (change.added.length > 0 || change.updated.length > 0 || change.deleted.length > 0)
            listener(prjId, change)
    }
}

/*  the plugin factory  */
const factory: API.TaskStoragePluginFactory = (ctx) => new GitHubTaskStoragePlugin(ctx)
export default factory

