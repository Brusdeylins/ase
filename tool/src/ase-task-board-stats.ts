/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { DateTime }                 from "luxon"

import type { Board, Tone }         from "./ase-task-board-core.js"
import type * as TaskFormat         from "./ase-task-format.js"

/*  the time range of the statistics: all tasks, resp. only the tasks
    worked on within the last 30 or 7 days  */
export type StatsRange = "total" | "30d" | "7d"
export const statsRanges: StatsRange[] = [ "total", "30d", "7d" ]

/*  the labels of the time ranges (for their buttons)  */
export const statsRangeLabels: Record<StatsRange, string> = {
    "total": "total",
    "30d":   "within last 30 days",
    "7d":    "within last 7 days"
}

/*  the label of a time range (for its button), where the time range "total" is
    suffixed with its number of days  */
export const statsRangeLabel = (range: StatsRange, days: number): string =>
    range === "total" ? `${statsRangeLabels[range]} (${days} day${days === 1 ? "" : "s"})` : statsRangeLabels[range]

/*  the number of tasks of a lifecycle state, with its phase (the title of its
    group of the lane layout) and its tone (like the tasks of its lane)  */
export type StatsState = { phase: string, status: string, count: number, tone: Tone }

/*  the progress of the tasks: the numbers of the finished (in a terminal state except
    "CANCELLED"), cancelled, work-in-progress (in an active state), and open (in any other
    state) tasks  */
export type StatsProgress = { finished: number, cancelled: number, wip: number, open: number }

/*  the total AI usage of the tasks: the AI request, human, and real time (in minutes), the cache
    read, cache write, (uncached) input, and output tokens, and the AI and human costs (in USD)  */
export type StatsUsage = {
    timeAI: number, timeHR: number, timeReal: number,
    cread: number, cwrite: number, input: number, output: number,
    costAI: number, costHR: number
}

/*  the readiness of the open tasks: the numbers of the ready tasks (all predecessors
    in a terminal state) and of the blocked tasks (any predecessor in another state)  */
export type StatsReadiness = { ready: number, blocked: number }

/*  a task of the highest usage: its id, its title, its tone (like the tasks of its lane),
    its total (AI and human) costs (in USD), its (uncached) input and output tokens, and its
    share (0-1) of the total costs of all tasks (resp. of their input and output tokens
    without any costs)  */
export type StatsTop = { id: string, title: string, tone: Tone, cost: number, input: number, output: number, share: number }

/*  the efficiency of the AI usage: the AI/HR time ratio (the AI request time per human
    time) and the AI/HR cost ratio (the AI costs per human costs), each null without any
    human time resp. costs, the cache hit ratio (0-1, the cache read tokens per all input
    tokens, i.e., the cache read, cache write, and uncached input tokens), null without any
    input tokens, and the average AI costs, human costs (in USD), and (uncached) input and
    output tokens per finished task (all zero without any finished task)  */
export type StatsEfficiency = {
    timeRatio: number | null, costRatio: number | null, cacheRatio: number | null,
    costAI: number, costHR: number, input: number, output: number
}

/*  the throughput of a week: its ISO week number, its start day (its Monday, as "YYYY-MM-DD"),
    and the number of tasks finished within it (in a terminal state except "CANCELLED")  */
export type StatsWeek = { week: number, start: string, count: number }

/*  the statistics of the board: its time range, the tasks per lifecycle state, the progress
    of the tasks, the readiness of the open tasks, the total AI usage of the tasks, the (up to
    five) tasks of the highest usage, the efficiency of the AI usage, the throughput of
    the last weeks (oldest first, ending with the current week), and the number of days of
    the time range "total" (from the creation of the oldest task until now)  */
export type Stats = {
    range:      StatsRange
    days:       number
    states:     StatsState[]
    progress:   StatsProgress
    readiness:  StatsReadiness
    usage:      StatsUsage
    top:        StatsTop[]
    efficiency: StatsEfficiency
    throughput: StatsWeek[]
}

/*  the number of tasks of the highest usage  */
const TOP_N = 5

/*  the number of weeks of the throughput (a quarter)  */
const WEEKS_N = 12

/*  the fields of the AI usage, by the amounts of the usage attachment  */
const usageFields: [ keyof StatsUsage, (typeof TaskFormat.usageKeys)[number] ][] = [
    [ "timeAI", "time.ai" ], [ "timeHR", "time.hr" ], [ "timeReal", "time.real" ],
    [ "cread", "token.cread" ], [ "cwrite", "token.cwrite" ], [ "input", "token.input" ], [ "output", "token.output" ],
    [ "costAI", "cost.ai" ], [ "costHR", "cost.hr" ]
]

/*  parse a timestamp of a task (in milliseconds, or NaN if absent or unparsable)  */
const timeOf = (text: string): number => {
    const dt = DateTime.fromFormat(text.trim(), "yyyy-LL-dd HH:mm")
    return dt.isValid ? dt.toMillis() : DateTime.fromISO(text.trim()).toMillis()
}

/*  the share of an activity period (from its creation to its last modification) within the time
    range of the statistics (from now back to its start): null if it does not overlap with the time
    range, else its overlapping part (where a period without extent overlaps entirely)  */
const shareOf = (createdAt: string, modifiedAt: string, range: StatsRange, now: number): number | null => {
    if (range === "total")
        return 1
    const from = now - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000
    let created  = timeOf(createdAt)
    let modified = timeOf(modifiedAt)
    if (Number.isNaN(created))
        created = modified
    if (Number.isNaN(modified))
        modified = created
    if (Number.isNaN(created) || modified < from || Math.min(created, modified) > now)
        return null
    if (modified <= created)
        return 1
    return Math.max(0, Math.min(modified, now) - Math.max(created, from)) / (modified - created)
}

/*  compute the statistics of the (possibly filtered) tasks of a board within a time range, where
    a task counts if the period of its plan (its "Created" and "Modified" keys) overlaps with the
    time range, and its usage counts with the overlapping part of the period of its usage attachment
    (its "Created" and "Modified" keys) -- as the usage attachment does not track when the usage
    accrued, the usage is taken as being evenly spread over this period, i.e., the usage within a
    time range other than "total" is just an approximation  */
export const statsOf = (board: Board, usage: Map<string, { usage: TaskFormat.TaskUsage, period: TaskFormat.TaskUsagePeriod }>,
    range: StatsRange = "total", now = Date.now()): Stats => {
    /*  the tasks within the time range  */
    const within = new Set<string>()
    for (const card of board.cards.values())
        if (!board.context.has(card.id) && shareOf(card.created, card.modified, range, now) !== null)
            within.add(card.id)

    /*  the tasks per state and their progress, and the tones and categories of the lanes  */
    const states   = [] as StatsState[]
    const progress = { finished: 0, cancelled: 0, wip: 0, open: 0 }
    const toneOf   = new Map<string, Tone>()
    const kindOf   = new Map<string, keyof StatsProgress>()
    for (const g of board.groups)
        for (const l of g.lanes) {
            const tone: Tone = l.kind === "terminal" ? "done" : l.active ? "active" : "idle"
            const kind = l.kind === "terminal" ? (l.status === "CANCELLED" ? "cancelled" : "finished") : l.active ? "wip" : "open"
            const count = (board.lanes.get(l.status) ?? []).filter((c) => within.has(c.id)).length
            states.push({ phase: g.title, status: l.status, count, tone })
            progress[kind] += count
            toneOf.set(l.status, tone)
            kindOf.set(l.status, kind)
        }

    /*  the readiness of the open tasks, by the states of their (known) predecessors
        (independent of the time range and the filter, as they block the tasks nevertheless)  */
    const done      = (id: string) => {
        const card = board.cards.get(id)
        return card === undefined || toneOf.get(card.status) === "done"
    }
    const readiness = { ready: 0, blocked: 0 }
    for (const id of within)
        if (kindOf.get(board.cards.get(id)!.status) === "open")
            readiness[(board.pred.get(id) ?? []).every(done) ? "ready" : "blocked"]++

    /*  the total AI usage of the tasks (proportionally to the overlapping parts of their usage
        periods), the usage of each task, and the total usage of the finished tasks  */
    const zero     = () => ({ timeAI: 0, timeHR: 0, timeReal: 0, cread: 0, cwrite: 0, input: 0, output: 0, costAI: 0, costHR: 0 })
    const total    = zero()
    const finished = zero()
    const tops     = [] as StatsTop[]
    for (const card of board.cards.values()) {
        const u = usage.get(card.id)
        if (u === undefined || board.context.has(card.id))
            continue
        const share = shareOf(u.period.created, u.period.modified, range, now)
        if (share === null)
            continue
        const task = zero()
        for (const [ field, key ] of usageFields)
            task[field] = (u.usage[key] ?? 0) * share
        for (const [ field ] of usageFields) {
            total[field] += task[field]
            if (within.has(card.id) && kindOf.get(card.status) === "finished")
                finished[field] += task[field]
        }
        const input  = Math.round(task.input)
        const output = Math.round(task.output)
        const cost   = Number((task.costAI + task.costHR).toFixed(4))
        if (input + output > 0 || cost > 0)
            tops.push({ id: card.id, title: card.title, tone: toneOf.get(card.status) ?? "idle", cost, input, output, share: 0 })
    }
    for (const [ field, key ] of usageFields)
        total[field] = Number(total[field].toFixed(key.startsWith("cost.") ? 4 : 0))

    /*  the tasks of the highest usage: by their costs, then by their input and output
        tokens, with their shares of the total costs (resp. input and output tokens)  */
    const top    = tops.sort((a, b) => b.cost - a.cost || (b.input + b.output) - (a.input + a.output)).slice(0, TOP_N)
    const costs  = total.costAI + total.costHR
    const tokens = total.input + total.output
    for (const t of top)
        t.share = costs > 0 ? t.cost / costs : tokens > 0 ? (t.input + t.output) / tokens : 0

    /*  the efficiency of the AI usage  */
    const n      = progress.finished
    const inputs = total.cread + total.cwrite + total.input
    const efficiency = {
        timeRatio:  total.timeHR > 0 ? Number((total.timeAI / total.timeHR).toFixed(2)) : null,
        costRatio:  total.costHR > 0 ? Number((total.costAI / total.costHR).toFixed(2)) : null,
        cacheRatio: inputs > 0 ? Number((total.cread / inputs).toFixed(4)) : null,
        costAI:     n > 0 ? Number((finished.costAI / n).toFixed(4)) : 0,
        costHR:     n > 0 ? Number((finished.costHR / n).toFixed(4)) : 0,
        input:      n > 0 ? Math.round(finished.input  / n) : 0,
        output:     n > 0 ? Math.round(finished.output / n) : 0
    }

    /*  the throughput of the last weeks: the finished tasks per (ISO) week, by their last
        modification as the (approximated) time of their completion (independent of the time
        range, as the weeks are a time range on their own)  */
    const thisWeek   = DateTime.fromMillis(now).startOf("week")
    const throughput = Array.from({ length: WEEKS_N }, (_x, i) => {
        const start = thisWeek.minus({ weeks: WEEKS_N - 1 - i })
        return { week: start.weekNumber, start: start.toFormat("yyyy-LL-dd"), count: 0 }
    })
    for (const card of board.cards.values()) {
        if (board.context.has(card.id) || kindOf.get(card.status) !== "finished")
            continue
        const time = timeOf(card.modified)
        if (Number.isNaN(time) || time > now)
            continue
        const ago = Math.round(thisWeek.diff(DateTime.fromMillis(time).startOf("week"), "weeks").weeks)
        if (ago >= 0 && ago < WEEKS_N)
            throughput[WEEKS_N - 1 - ago].count++
    }

    /*  the number of days of the time range "total": from the creation (resp. the last
        modification without any creation) of the oldest task until now (zero without any task)  */
    let oldest = now
    for (const card of board.cards.values()) {
        if (board.context.has(card.id))
            continue
        let time = timeOf(card.created)
        if (Number.isNaN(time))
            time = timeOf(card.modified)
        if (!Number.isNaN(time))
            oldest = Math.min(oldest, time)
    }
    const days = Math.ceil((now - oldest) / (24 * 60 * 60 * 1000))
    return { range, days, states, progress, readiness, usage: total, top, efficiency, throughput }
}

