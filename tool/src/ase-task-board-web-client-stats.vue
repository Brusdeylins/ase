<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the statistics view (like in the TUI): the framed column chart "Tasks per State" of the numbers
      of tasks per lifecycle state (labeled by state and phase, in the colors of their lanes), the
      framed stacked bar "Task Progress" of the cancelled, finished, work-in-progress, and open tasks,
      and the framed bars "Usage" of the total times, tokens, and costs of the tasks, with the
      bars of a column scaled to the maximum of the column  -->
<template>
    <div v-show="view === 'stats'" id="stats">
        <div v-if="stats === null" class="sempty" :class="{ off: statsError !== null }">{{ statsError ?? "loading …" }}</div>
        <template v-else>
            <section class="schart">
                <div class="stitle">Tasks per State</div>
                <div class="sgrid" :style="{ gridTemplateColumns: `repeat(${stats.states.length}, minmax(0, 1fr))` }">
                    <div v-for="s in stats.states" :key="s.status" class="scol" :class="s.tone">
                        <span class="scount">{{ s.count }}</span>
                        <div class="sbar" :style="{ height: `calc((100% - 1.5em) * ${s.count / maxCount})` }"></div>
                    </div>
                    <div v-for="s in stats.states" :key="`l-${s.status}`" class="sstate" :class="s.tone" :title="s.status">{{ s.status }}</div>
                    <div v-for="p in phases" :key="p.phase" class="sphase" :style="{ gridColumn: `span ${p.n}` }" :title="p.phase"><span>{{ p.phase }}</span></div>
                </div>
            </section>
            <section class="sprogress">
                <div class="stitle">Task Progress</div>
                <div class="sstack">
                    <div v-for="p in parts" v-show="p.count > 0" :key="p.key" class="spart" :class="p.key" :style="{ flexGrow: p.count }"
                        :title="`${p.label}: ${p.count} (${pct(p.count)})`"></div>
                </div>
                <div class="slegend">
                    <template v-for="(p, i) in parts" :key="p.key">
                        <span v-if="i > 0" class="ssep">·</span>
                        <span><span class="sswatch" :class="p.key"></span>{{ p.label }}: <b>{{ p.count }}</b> ({{ pct(p.count) }})</span>
                    </template>
                </div>
            </section>
            <section class="susage">
                <div class="stitle">Usage</div>
                <div class="smatrix">
                    <span class="shead">Time:</span>
                    <span class="shead">Token:</span>
                    <span class="shead">Cost:</span>
                    <div class="scell">
                        <div v-for="b in timeBars" :key="b.name" class="srow">
                            <span class="sname">{{ b.name }}</span>
                            <div class="strack"><div class="sfill" :class="b.cls" :style="{ width: share(b.value, maxTime) }"></div></div>
                            <span class="sval">{{ hours(b.value) }}</span>
                        </div>
                    </div>
                    <div class="scell">
                        <div class="srow">
                            <span class="sname">AI</span>
                            <div class="strack">
                                <div v-for="t in tokenParts" :key="t" class="sfill" :class="t" :style="{ width: share(stats.usage[t], tokenSum) }"></div>
                            </div>
                            <span class="sval">{{ tokens(tokenSum) }}</span>
                        </div>
                        <div class="slegend stokens">
                            <span v-for="t in tokenParts" :key="t"><span class="sswatch" :class="t"></span>{{ t }} ({{ tokenPct(stats.usage[t]) }})</span>
                        </div>
                    </div>
                    <div class="scell">
                        <div v-for="b in costBars" :key="b.name" class="srow">
                            <span class="sname">{{ b.name }}</span>
                            <div class="strack"><div class="sfill" :class="b.cls" :style="{ width: share(b.value, maxCost) }"></div></div>
                            <span class="sval">{{ cost(b.value) }}</span>
                        </div>
                    </div>
                </div>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import {
    view, stats, statsError
} from "./ase-task-board-web-client-model"

/*  the token counts of the stacked token bar, the total usage
    (zero while unknown), and the bars of the time and cost columns  */
const tokenParts = [ "cread", "cwrite", "input", "output" ] as const
const usage      = computed(() => stats.value?.usage ??
    { timeAI: 0, timeHR: 0, timeReal: 0, cread: 0, cwrite: 0, input: 0, output: 0, costAI: 0, costHR: 0 })
const timeBars   = computed(() => [
    { name: "AI",   cls: "ai",   value: usage.value.timeAI },
    { name: "HR",   cls: "hr",   value: usage.value.timeHR },
    { name: "real", cls: "real", value: usage.value.timeReal }
])
const costBars   = computed(() => [
    { name: "AI",   cls: "ai",   value: usage.value.costAI },
    { name: "HR",   cls: "hr",   value: usage.value.costHR }
])
const tokenSum   = computed(() => usage.value.cread + usage.value.cwrite + usage.value.input + usage.value.output)
const tokenPct   = (n: number) => `${tokenSum.value > 0 ? Math.round(n / tokenSum.value * 100) : 0}%`

/*  the compact amounts: a time (in minutes) in minutes below one hour, else in hours, a number
    of tokens with a metric suffix, and costs in USD, and the share of a value of a maximum  */
const hours  = (minutes: number) => minutes < 60 ? `${Math.round(minutes)}m` : `${(minutes / 60).toFixed(1)}h`
const tokens = (n: number) =>
    n < 1000 ? String(n) : n < 1000 * 1000 ? `${(n / 1000).toFixed(1)}k` :
        n < 1000 * 1000 * 1000 ? `${(n / (1000 * 1000)).toFixed(1)}M` : `${(n / (1000 * 1000 * 1000)).toFixed(1)}G`
const cost   = (usd: number) => `$${usd.toFixed(2)}`
const share  = (value: number, max: number) => `${max > 0 ? value / max * 100 : 0}%`

/*  the highest number of tasks of a state, and the phases with their numbers of states  */
const maxCount = computed(() => Math.max(1, ...(stats.value?.states ?? []).map((s) => s.count)))
const phases   = computed(() => (stats.value?.states ?? []).reduce((list, s) => {
    const last = list.at(-1)
    if (last !== undefined && last.phase === s.phase)
        last.n++
    else
        list.push({ phase: s.phase, n: 1 })
    return list
}, [] as { phase: string, n: number }[]))

/*  the parts of the progress of the tasks, and the share of a number of tasks  */
const parts = computed(() => {
    const p = stats.value?.progress ?? { finished: 0, cancelled: 0, wip: 0, open: 0 }
    return [
        { key: "cancelled", label: "cancelled",        count: p.cancelled },
        { key: "finished",  label: "finished",         count: p.finished },
        { key: "wip",       label: "work-in-progress", count: p.wip },
        { key: "open",      label: "open",             count: p.open }
    ]
})
const pct = (count: number) => {
    const total = parts.value.reduce((n, p) => n + p.count, 0)
    return `${total > 0 ? Math.round(count / total * 100) : 0}%`
}

/*  the maxima of the time and cost columns  */
const maxTime = computed(() => Math.max(usage.value.timeAI, usage.value.timeHR, usage.value.timeReal))
const maxCost = computed(() => Math.max(usage.value.costAI, usage.value.costHR))
</script>

