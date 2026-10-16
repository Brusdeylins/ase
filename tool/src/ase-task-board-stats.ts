/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { Board, Tone }         from "./ase-task-board-core.js"
import type * as TaskFormat         from "./ase-task-format.js"

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

/*  the statistics of the board: the tasks per lifecycle state,
    the progress of the tasks, and the total AI usage of the tasks  */
export type Stats = { states: StatsState[], progress: StatsProgress, usage: StatsUsage }

/*  the fields of the AI usage, by the amounts of the usage attachment  */
const usageFields: [ keyof StatsUsage, (typeof TaskFormat.usageKeys)[number] ][] = [
    [ "timeAI", "time.ai" ], [ "timeHR", "time.hr" ], [ "timeReal", "time.real" ],
    [ "cread", "token.cread" ], [ "cwrite", "token.cwrite" ], [ "input", "token.input" ], [ "output", "token.output" ],
    [ "costAI", "cost.ai" ], [ "costHR", "cost.hr" ]
]

/*  compute the statistics of the (possibly filtered) tasks of a board  */
export const statsOf = (board: Board, usage: Map<string, TaskFormat.TaskUsage>): Stats => {
    /*  the tasks per state and their progress  */
    const states   = [] as StatsState[]
    const progress = { finished: 0, cancelled: 0, wip: 0, open: 0 }
    for (const g of board.groups)
        for (const l of g.lanes) {
            const count = (board.lanes.get(l.status) ?? []).filter((c) => !board.context.has(c.id)).length
            states.push({ phase: g.title, status: l.status, count, tone: l.kind === "terminal" ? "done" : l.active ? "active" : "idle" })
            if (l.kind === "terminal")
                progress[l.status === "CANCELLED" ? "cancelled" : "finished"] += count
            else
                progress[l.active ? "wip" : "open"] += count
        }

    /*  the total AI usage of the tasks  */
    const total = { timeAI: 0, timeHR: 0, timeReal: 0, cread: 0, cwrite: 0, input: 0, output: 0, costAI: 0, costHR: 0 }
    for (const id of board.cards.keys()) {
        const u = usage.get(id)
        if (u === undefined || board.context.has(id))
            continue
        for (const [ field, key ] of usageFields)
            total[field] += u[key] ?? 0
    }
    return { states, progress, usage: total }
}

