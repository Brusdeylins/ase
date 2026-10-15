<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<template>
    <header>
        <span>
            ⧉ ASE: <span class="emph">Task Board</span>
            <span class="sep">·</span>project: <span class="emph">{{ board?.project }}</span>
            <span class="sep">·</span>mode: <span class="emph">{{ board?.mode }}</span>
            <span class="sep">·</span>tasks: <span class="emph">{{ taskCount }}</span>
            <span class="sep">·</span>view: <button class="val toggle" title="switch view (v)" @click="cycleView()">{{ view }}</button>
            <span v-show="view !== 'agents'" class="sep">·</span><span v-show="view !== 'agents'" class="filter">filter:
                <span class="field">
                    <input ref="filterEl" v-model="filter" class="val" type="text" autocomplete="off" spellcheck="false"
                        placeholder="keywords…" title="space ANDs, comma ORs fuzzy matched keywords (/)" @keydown.esc="clearFilter" @keydown.enter="filterEl?.blur()">
                    <button v-show="filter !== ''" class="clear" title="clear filter (ESC)" @click="clearFilter">✕</button>
                </span>
            </span>
        </span>
    </header>
    <div id="view">
        <BoardLanes />
        <BoardGraph />
        <BoardAgents />
    </div>
    <!--  the horizontal scroll bar of the lanes view, resp. the info line
          of the graph view with the selected task and its status  -->
    <div id="hscroll">
        <button :style="{ visibility: view === 'lanes' && !scroll.all && !grown ? 'visible' : 'hidden' }" @click="scrollBy(-240)">◀</button>
        <span v-if="grown">lane <b>{{ board?.groups[sel.g]?.lanes[sel.l]?.status }}</b> of group <b>{{ board?.groups[sel.g]?.title }}</b> grown<span class="sep">·</span>g shrinks</span>
        <span v-else-if="view === 'lanes' && scroll.info !== ''">{{ scroll.info }}<span class="sep">·</span>{{ scroll.all ? "all visible" : "scroll or ◀/▶" }}</span>
        <span v-else-if="view === 'graph' && selStatus !== null">task: <b>{{ sel.id }}</b><span class="sep">·</span>status: <b>{{ selStatus }}</b></span>
        <span v-else-if="view === 'agents' && agentSel !== null">agent: <b>{{ agentLabel(agentSel) }}</b><span class="sep">·</span>host: <b>{{ agentSel.host }}</b><span class="sep">·</span>pid: <b>{{ agentSel.pid }}</b><span class="sep">·</span>{{ agentSel.state }}: <b>{{ agentDuration(agentNow - agentSel.since) }}</b><span class="sep">·</span>heartbeat: <b>{{ agentDuration(agentNow - agentSel.beat) }} ago</b></span>
        <button :style="{ visibility: view === 'lanes' && !scroll.all && !grown ? 'visible' : 'hidden' }" @click="scrollBy(240)">▶</button>
    </div>
    <footer>
        <div v-for="(line, k) in (surface.keys ? hints : [])" :key="k">
            <template v-for="(hint, i) in line" :key="hint.key">
                <span v-if="i > 0" class="sep">·</span><template v-for="(key, j) in (hint.key === '/' ? [ '/' ] : hint.key.split('/'))" :key="j"><template v-if="j > 0">/</template><kbd>{{ key }}</kbd></template><span class="action">{{ hint.action }}</span>
            </template>
        </div>
        <div v-if="warning !== ''" class="status">{{ warning }}</div>
        <div v-else class="status idle"><template v-if="board !== null">⧉ ASE: <b>Task Board</b><span class="sep">·</span>server: <b :class="{ off: !online }">{{ online ? "online" : "offline" }}</b> <span :class="{ off: !online }">{{ online ? "●" : "○" }}</span><template v-if="store !== null"><span class="sep">·</span>store: <b>{{ store.kind }}</b> <span :class="{ off: !online || !store.connected }">{{ online && store.connected ? "●" : "○" }}</span></template><template v-if="agents !== null"><span class="sep">·</span>agents: <b>{{ agents.agents.length }}</b> <span :class="{ off: !online || !agents.connected }">{{ online && agents.connected ? "●" : "○" }}</span></template><span class="sep">·</span>version: <b>ASE {{ board.version }}</b></template></div>
    </footer>
    <TaskDialog />
    <BoardPopup />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue"
import BoardLanes                               from "./ase-task-board-web-client-lanes.vue"
import BoardGraph                               from "./ase-task-board-web-client-graph.vue"
import BoardAgents                              from "./ase-task-board-web-client-agents.vue"
import TaskDialog                               from "./ase-task-board-web-client-dialog.vue"
import BoardPopup                               from "./ase-task-board-web-client-popup.vue"
import {
    board, actionError, actionNote, view, sel, drag, scroll, filter, filterEl, agents, agentSel, agentNow, online, store,
    surface, titles, grown, agentDuration, agentLabel, cycleView, clearFilter, scrollBy, updateScroll, updateTabScroll,
    reload, startService, stopService
} from "./ase-task-board-web-client-model"
import { stopEdit }                  from "./ase-task-board-web-client-editor"
import { controlStart, controlStop } from "./ase-task-board-web-client-control"

/*  the number of open and of all tasks, for the header  */
const taskCount = computed(() => {
    const cards = board.value?.groups.flatMap((g) => g.lanes).flatMap((l) => l.cards)
    return cards === undefined ? "" : `${cards.filter((c) => c.tone !== "done").length}/${cards.length}`
})

/*  the status of the selected task, for the info line of the graph view  */
const selStatus = computed(() => {
    const lane = board.value?.groups.flatMap((g) => g.lanes).find((l) => l.cards.some((c) => c.id === sel.value.id))
    return lane?.status ?? null
})

/*  the status line and the key hints of the footer  */
const warning   = computed(() => {
    if (actionError.value !== null)
        return `⚠ ${actionError.value}`
    else if (actionNote.value !== null)
        return actionNote.value
    else if (drag.value?.key === true)
        return `moving task "${drag.value.id}" from ${drag.value.from}: select a highlighted lane, SPACE drops, ESC cancels`
    return (board.value?.warnings.length ?? 0) > 0 ? `⚠ ${board.value!.warnings.join(" · ")}` : ""
})
const hints     = computed(() => {
    const group  = board.value?.groups[sel.value.g]
    const minned = surface.value.minimized.includes(group?.lanes[sel.value.l]?.status ?? "")
    const folded = surface.value.collapsed.includes(group?.title ?? "")
    return grown.value ? [ [
        { key: "↑/↓/←/→",       action: "select task" },
        { key: "⇈/⇊/⇤/⇥",       action: "page/first/last task" },
        { key: "⏎",             action: "view task" },
        { key: "e",             action: "edit task" },
        { key: "SPACE",         action: "start transition task" },
        { key: "T",             action: "transition task" }
    ], [
        { key: "D",             action: "delete task" },
        { key: "E",             action: "edit by prompt" },
        { key: "R",             action: "request by prompt" },
        { key: "N",             action: "new task" },
        { key: "g/ESC",         action: "shrink lane" },
        { key: "t",             action: `${titles.value ? "collapse" : "expand"} titles` },
        { key: "/",             action: "filter tasks" },
        { key: "v",             action: "view graph" }
    ], [
        { key: "Left-Click",    action: "view task / shrink lane" },
        { key: "?",             action: "hide key hints" }
    ] ] : view.value === "lanes" ? [ [
        { key: "↑/↓/←/→",       action: "select task" },
        { key: "⇈/⇊/⇤/⇥",       action: "select lane" },
        { key: "⏎",             action: "view task" },
        { key: "e",             action: "edit task" },
        { key: "SPACE",         action: "start/stop transition task" },
        { key: "T",             action: "transition task" }
    ], [
        { key: "D",             action: "delete task" },
        { key: "E",             action: "edit by prompt" },
        { key: "R",             action: "request by prompt" },
        { key: "N",             action: "new task" },
        { key: "m",             action: `${minned ? "maximize" : "minimize"} lane` },
        { key: "g",             action: "grow lane" },
        { key: "c",             action: `${folded ? "expand" : "collapse"} group` },
        { key: "t",             action: `${titles.value ? "collapse" : "expand"} titles` },
        { key: "/",             action: "filter tasks" },
        { key: "v",             action: "view graph" }
    ], [
        { key: "Left-Click",    action: "view task / minimize/maximize lane / collapse/expand group" },
        { key: "Drag & Drop",   action: "directly transition task" },
        { key: "?",             action: "hide key hints" }
    ] ] : view.value === "agents" ? [ [
        { key: "↑/↓/Left-Click", action: "select agent" },
        { key: "⇈/⇊/⇤/⇥",       action: "page/top/bottom agent log" },
        { key: "Mouse-Wheel",   action: "scroll agent log" }
    ], [
        { key: "v",             action: "view lanes" },
        { key: "?",             action: "hide key hints" }
    ] ] : [ [
        { key: "↑/↓/←/→",       action: "select task" },
        { key: "⏎/Left-Click",  action: "view task" },
        { key: "e",             action: "edit task" },
        { key: "T",             action: "transition task" }
    ], [
        { key: "D",             action: "delete task" },
        { key: "E",             action: "edit by prompt" },
        { key: "R",             action: "request by prompt" },
        { key: "N",             action: "new task" },
        { key: "t",             action: `${titles.value ? "collapse" : "expand"} titles` },
        { key: "s",             action: `${surface.value.standalone ? "hide" : "show"} standalone tasks` },
        { key: "/",             action: "filter tasks" },
        { key: "v",             action: `view ${agents.value !== null ? "agents" : "lanes"}` },
        { key: "+/-/0",         action: "zoom in/out/reset" }
    ], [
        { key: "?",             action: "hide key hints" }
    ] ]
})

/*  keep the scroll states of the lanes view and the tab bar on resizing
    (the agents view keeps the position within its agent log itself)  */
const onResize = () => {
    updateScroll()
    updateTabScroll()
}

/*  keep the pulses of all task boxes in sync, by pinning every newly started
    pulse animation onto the common origin of the document timeline  */
const onAnimationStart = (ev: AnimationEvent) => {
    if (ev.animationName !== "pulse")
        return
    for (const anim of document.getAnimations())
        if (anim instanceof CSSAnimation && anim.animationName === "pulse" && anim.startTime !== 0)
            anim.startTime = 0
}
onMounted(() => {
    startService()
    controlStart()
    window.addEventListener("resize", onResize)
    document.addEventListener("animationstart", onAnimationStart)
    reload()
})
onBeforeUnmount(() => {
    stopService()
    controlStop()
    stopEdit()
    window.removeEventListener("resize", onResize)
    document.removeEventListener("animationstart", onAnimationStart)
})
</script>

<style lang="stylus" src="./ase-task-board-web-client.styl"></style>

