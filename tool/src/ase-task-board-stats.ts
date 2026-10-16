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

/*  the statistics of the board: its time range, the tasks per lifecycle state,
    the progress of the tasks, and the total AI usage of the tasks  */
export type Stats = { range: StatsRange, states: StatsState[], progress: StatsProgress, usage: StatsUsage }

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

    /*  the tasks per state and their progress  */
    const states   = [] as StatsState[]
    const progress = { finished: 0, cancelled: 0, wip: 0, open: 0 }
    for (const g of board.groups)
        for (const l of g.lanes) {
            const count = (board.lanes.get(l.status) ?? []).filter((c) => within.has(c.id)).length
            states.push({ phase: g.title, status: l.status, count, tone: l.kind === "terminal" ? "done" : l.active ? "active" : "idle" })
            if (l.kind === "terminal")
                progress[l.status === "CANCELLED" ? "cancelled" : "finished"] += count
            else
                progress[l.active ? "wip" : "open"] += count
        }

    /*  the total AI usage of the tasks (proportionally to the overlapping parts of their usage periods)  */
    const total = { timeAI: 0, timeHR: 0, timeReal: 0, cread: 0, cwrite: 0, input: 0, output: 0, costAI: 0, costHR: 0 }
    for (const id of board.cards.keys()) {
        const u = usage.get(id)
        if (u === undefined || board.context.has(id))
            continue
        const share = shareOf(u.period.created, u.period.modified, range, now)
        if (share === null)
            continue
        for (const [ field, key ] of usageFields)
            total[field] += (u.usage[key] ?? 0) * share
    }
    for (const [ field, key ] of usageFields)
        total[field] = Number(total[field].toFixed(key.startsWith("cost.") ? 4 : 0))
    return { range, states, progress, usage: total }
}

