<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the agents view: the master list "agents" of the agents as cards (name and state, kind and
      mode of operation, and the ids of the tasks it is busy with, else "none (waiting)"), and on the
      right the pane of the operation of the selected agent (its name inversely with the agent icon,
      its title in bold, and its description),
      below it two equally wide panes of the selected agent: its process (host, process id, user
      name and id, and working directory, cut at its start) and its accounting (uptime, age of its
      heartbeat, and total and last usage of the agent tool), and below them the
      detail view "agent log" with the recent processing log of the selected agent (with the task ids
      inverse), with its lines broken and following its bottom unless scrolled up  -->
<template>
    <div v-show="view === 'agents'" id="agents">
        <section class="amaster">
            <div class="atitle">Agents</div>
            <div class="alist">
                <div v-if="agentList.length === 0" class="aempty" :class="{ off: agents !== null && !agents.connected }">{{ agentsEmpty }}</div>
                <div v-for="a in agentList" :key="a.id" class="acard" :class="{ sel: a.id === agentSel?.id, busy: a.state === 'busy' }"
                    @click="selectAgent(a.id)">
                    <div class="aname"><span class="abadge"><span class="aicon">⚉</span> {{ a.name }}</span></div>
                    <span class="abeat">{{ beatOf(a.id) ? "♥" : "♡" }}</span>
                    <div class="afields">
                        <span>kind:</span><b class="aval">{{ a.kind }}</b>
                        <span>mode:</span><b class="aval">{{ typeof a.mode === "string" && a.mode !== "" ? a.mode : "none" }}</b>
                        <span>task:</span><span class="aval atasks"><b v-if="a.tasks.length === 0">none (waiting)</b><span v-for="id in a.tasks" :key="id" class="atask">≡ {{ id }}</span></span>
                    </div>
                </div>
            </div>
        </section>
        <div class="aright">
            <section class="aop">
                <div class="atitle">Operation</div>
                <div v-if="agentSel === null" class="aempty" :class="{ off: agents !== null && !agents.connected }">{{ agentsEmpty }}</div>
                <div v-else class="aoptext">
                    <div class="aophead"><span class="abadge"><span class="aicon">⚉</span> {{ agentSel.name }}</span><b v-if="agentSel.title">{{ agentSel.title }}</b><span v-else-if="!agentSel.description" class="aempty">(no operation title and description)</span></div>
                    <div v-if="agentSel.description" class="aopdesc">{{ agentSel.description }}</div>
                </div>
            </section>
            <div class="ainfos">
                <section v-for="p in panes" :key="p.title" class="ainfo">
                    <div class="atitle">{{ p.title }}</div>
                    <div v-if="agentSel === null" class="aempty" :class="{ off: agents !== null && !agents.connected }">{{ agentsEmpty }}</div>
                    <div v-else class="afields">
                        <template v-for="f in p.fields" :key="f.name"><span>{{ f.name }}</span><b class="aval" :class="{ astart: f.start }" :title="f.value"><span dir="ltr">{{ f.value }}</span></b></template>
                    </div>
                </section>
            </div>
            <section class="adetail">
                <div class="atitle">Recent Log Entries</div>
                <div ref="logEl" class="alog" @scroll="onLogScroll">
                    <AgentLog />
                </div>
                <div v-if="logPos !== ''" class="apos">{{ logPos }}</div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, nextTick, watch, onMounted, onBeforeUnmount, defineComponent, h } from "vue"
import {
    type Agent, type AgentLine, type AgentUsage,
    view, agents, agentLogs, agentList, agentSel, logEl, logStick, agentNow,
    agentDuration, selectAgent, beatOf
} from "./ase-task-board-web-client-model"

/*  the text shown without any agents  */
const agentsEmpty = computed(() => agents.value === null || !agents.value.connected ?
    "agent relay unreachable — reconnecting …" : "no agents running")

/*  the uptime of an agent (the duration since its start, measured up to its latest heartbeat)  */
const agentUptime = (agent: Agent) =>
    agentDuration(agent.beat - (agent.started ?? agent.since))

/*  the user of an agent: its user id with its user name, resp. "n/a" for an older agent  */
const agentUser = (agent: Agent) =>
    agent.user === undefined ? "n/a" :
        `${agent.uid !== undefined && agent.uid >= 0 ? agent.uid : "n/a"} (${agent.user !== "" ? agent.user : "unknown"})`

/*  the panes of the selected agent: its process (incl. its location) and its accounting (incl.
    its usage), where a field may be cut at its start (instead of at its end)  */
const panes = computed(() => {
    const a = agentSel.value
    const pane = (title: string, fields: (agent: Agent) => { name: string, value: string, start?: boolean }[]) =>
        ({ title, fields: a === null ? [] : fields(a) })
    return [
        pane("Process", (agent) => [
            { name: "host:",             value: agent.host },
            { name: "pid:",              value: String(agent.pid) },
            { name: "uid:",              value: agentUser(agent) },
            { name: "cwd:",              value: agent.cwd ?? "n/a", start: true } ]),
        pane("Accounting", (agent) => [
            { name: "uptime:",           value: agentUptime(agent) },
            { name: "heartbeat:",        value: `${agentDuration(agentNow.value - agent.beat)} ago` },
            { name: "usage (total):",    value: agentUsage(agent.usage?.total) },
            { name: "usage (last job):", value: agentUsage(agent.usage?.last) } ])
    ]
})

/*  a compact usage of the agent tool: its wall time, its output tokens (with
    a metric suffix), and its costs (in USD), where an unavailable field is "n/a"
    and no usage at all (before the first finished job) is "none"  */
const agentUsage = (usage: AgentUsage | undefined) => {
    if (usage === undefined)
        return "none"
    const tok = usage.costToken
    const tokens = tok === null ? "n/a" :
        tok < 1000 ? `${tok}` : tok < 1000 * 1000 ? `${(tok / 1000).toFixed(1)}k` : `${(tok / (1000 * 1000)).toFixed(1)}M`
    const cost = usage.costUSD === null ? "$n/a" : `$${usage.costUSD.toFixed(2)}`
    return `${agentDuration(usage.walltimeSec * 1000)}, ${tokens} tok, ${cost}`
}

const pad        = (n: number, k = 2) => String(n).padStart(k, "0")
const logTime     = (time: number) => {
    const d = new Date(time)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/*  the level of an agent log line as a "[...]: " prefix  */
const logLevel    = (level: AgentLine["level"]) =>
    `[${level.toUpperCase()}]: `

/*  the agent log of the detail view: the recent processing log lines of the selected agent
    (with the task ids inverse), as a component of its own, so that only it re-renders on the
    frequent changes of these lines, keyed by their time and their position among the lines of
    the same time (so the lines stay keyed alike when the oldest lines are dropped)  */
const AgentLog = defineComponent({
    name: "AgentLog",
    setup () {
        return () => {
            const agent = agentSel.value
            if (agent === null)
                return h("div", { class: [ "aempty", { off: agents.value !== null && !agents.value.connected } ] }, agentsEmpty.value)
            const lines = agentLogs.value.get(agent.id) ?? []
            if (lines.length === 0)
                return h("div", { class: "aempty" }, "(no processing log lines yet)")
            const seen = new Map<number, number>()
            return lines.map((l) => {
                const n = seen.get(l.time) ?? 0
                seen.set(l.time, n + 1)
                return h("div", { key: `${l.time}:${n}`, class: [ "aline", l.level ] }, [
                    h("span", { class: "atime" }, `${logTime(l.time)}:`), " ",
                    ...(l.task !== "" ? [ h("span", { class: "atask" }, `≡ ${l.task}`), " " ] : []),
                    `${logLevel(l.level)}${l.msg}`
                ])
            })
        }
    }
})

/*  the position within the agent log, shown on the bottom border of its detail view (like
    in the terminal board): the number of lines if all fit, else the range of the (at least
    partially) visible lines, and whether the log is followed or scrolled  */
const logPos = ref("")
const updateLogPos = () => {
    const el    = logEl.value
    const lines = el !== null ? Array.from(el.querySelectorAll<HTMLElement>(".aline")) : []
    if (el === null || lines.length === 0)
        logPos.value = ""
    else if (el.scrollHeight <= el.clientHeight + 1)
        logPos.value = `${lines.length} lines`
    else {
        const { top, bottom } = el.getBoundingClientRect()
        let first = -1
        let last  = -1
        lines.forEach((line, i) => {
            const r = line.getBoundingClientRect()
            if (r.bottom > top + 1 && r.top < bottom - 1) {
                if (first < 0)
                    first = i
                last = i
            }
        })
        logPos.value = first < 0 ? `${lines.length} lines` :
            `lines ${first + 1}–${last + 1} of ${lines.length} · ${logStick.value ? "following" : "scrolled"}`
    }
}

/*  follow the bottom of the agent log only while it is scrolled to the bottom  */
const onLogScroll = () => {
    const el = logEl.value
    if (el !== null)
        logStick.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
    updateLogPos()
}

/*  keep the agent log scrolled to its bottom on every change while following it  */
watch(() => [ agentSel.value?.id, agentLogs.value.get(agentSel.value?.id ?? ""), view.value ], async () => {
    await nextTick()
    const el = logEl.value
    if (el !== null && logStick.value)
        el.scrollTop = el.scrollHeight
    updateLogPos()
})

/*  keep the position within the agent log on resizing  */
onMounted(() => {
    window.addEventListener("resize", updateLogPos)
})
onBeforeUnmount(() => {
    window.removeEventListener("resize", updateLogPos)
})
</script>

