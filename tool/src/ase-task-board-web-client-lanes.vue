<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the lanes view: the groups of lanes with the task boxes  -->
<template>
    <div v-show="view === 'lanes'" id="board" ref="boardEl" :class="{ titles, grown }" @scroll="updateScroll">
        <template v-if="boardError !== null">{{ boardError }}</template>
        <template v-for="(g, gi) in board?.groups ?? []" :key="g.title">
            <!--  render each lane of a collapsed phase as a narrow box with its
                  vertically written status and number of cards (expanding the phase on click)  -->
            <div v-if="surface.collapsed.includes(g.title)" class="group coll">
                <div class="ghd" :class="{ sel: sel.g === gi }" @click="toggle('collapsed', g.title)"><span class="arr right">▼</span></div>
                <div v-for="(l, li) in g.lanes" :key="l.status" class="lane" tabindex="-1"
                    :class="[ { active: l.active, dashed: l.dashed, done: l.kind === 'terminal', sel: sel.g === gi && sel.l === li }, dropClass(l.status) ]"
                    :style="{ flex: `${l.weight} 1 0` }" @click="selectLane(gi, li); toggle('collapsed', g.title)"
                    @dragover="dragOver($event, l.status)" @dragleave="dragLeave($event, l.status)" @drop="drop($event, l.status)">
                    <span class="arr right">▼</span>
                    <span class="vt">{{ l.status.toUpperCase() }}</span>
                    <span class="cnt">{{ l.cards.length }}</span>
                </div>
            </div>
            <!--  while a lane is grown, only it is shown (within its group), with its cards in a grid  -->
            <div v-else class="group" :class="{ grown: grown && sel.g === gi }">
                <div class="ghd" :class="{ sel: sel.g === gi }" @click="toggle('collapsed', g.title)"><span class="arr">▼</span><span class="ttl">{{ g.title }}</span></div>
                <div v-for="(l, li) in g.lanes" :key="l.status" class="lane" tabindex="-1"
                    :class="[ { active: l.active, dashed: l.dashed, done: l.kind === 'terminal', min: surface.minimized.includes(l.status), sel: sel.g === gi && sel.l === li, grown: grown && sel.g === gi && sel.l === li }, dropClass(l.status) ]"
                    :style="{ flex: `${l.weight} 1 0` }" @click="selectLane(gi, li)"
                    @dragover="dragOver($event, l.status)" @dragleave="dragLeave($event, l.status)" @drop="drop($event, l.status)">
                    <div class="lhd" :title="grown ? 'shrink lane (g)' : ''" @click="grown ? (grow = false) : toggle('minimized', l.status)">
                        <span>{{ grown ? "◆" : surface.minimized.includes(l.status) ? "▶" : "▼" }}<span class="ttl">{{ l.status }}</span></span>
                        <span>{{ l.cards.length }}</span>
                    </div>
                    <div v-if="!surface.minimized.includes(l.status)" class="cards" tabindex="-1">
                        <!--  the task carried by the keyboard, shown on top of the selected target lane  -->
                        <div v-if="carried !== null && drag?.over === l.status" class="card held sel carried" :class="`tone-${carried.tone}`">
                            <div class="cbody"><TaskTitle :id="carried.id" :epic="carried.group" :title="carried.title" :edit="carried.edit" :effort="carried.effort" /></div>
                        </div>
                        <div v-for="c in l.cards" :key="c.id" class="card" draggable="true"
                            :class="[ `tone-${c.tone}`, { sel: sel.id === c.id, badged: badges.has(c.id) }, carryClass(c.id) ]"
                            @click="sel = { g: gi, l: li, id: c.id }; openTask(c.id)"
                            @dragstart="dragStart($event, c.id, l.status, c.moves)" @dragend="dragEnd">
                            <div v-if="badges.has(c.id)" class="cagents"><span v-for="(b, bi) in badges.get(c.id)!" :key="bi" class="cagent"><span class="aicon">{{ b.icon }}</span> {{ b.name }}</span></div>
                            <div class="cbody"><TaskTitle :id="c.id" :epic="c.group" :title="c.title" :edit="c.edit" :effort="c.effort" /></div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import TaskTitle                     from "./ase-task-board-web-client-title.vue"
import {
    groupItems,
    board, boardError, view, graph, task, sel, grow, drag, boardEl,
    surface, titles, grown, badges, openTask, toggle, updateScroll
} from "./ase-task-board-web-client-model"
import { canDrop, moveTask } from "./ase-task-board-web-client-control"

/*  select a lane (like PgUp/PgDn), unless the selection is already within it  */
const selectLane = (g: number, l: number) => {
    if (board.value === null || (sel.value.g === g && sel.value.l === l))
        return
    const next = groupItems(board.value, g, surface.value).find((it) => it.l === l)
    if (next !== undefined)
        sel.value = next
}

/*  the task carried by the keyboard while the selected lane is a reachable target (as then it is
    shown on top of this lane, while a dim ghost of it stays at its original position until the drop)  */
const carried = computed(() => {
    const d = drag.value
    if (d?.key !== true || d.over === null || !canDrop(d.over))
        return null
    return board.value?.groups.flatMap((g) => g.lanes).flatMap((l) => l.cards).find((c) => c.id === d.id) ?? null
})
const carryClass = (id: string) => drag.value?.id !== id ? {} : {
    dragging: drag.value.key !== true,
    held:     drag.value.key === true && carried.value === null,
    ghost:    drag.value.key === true && carried.value !== null
}
const dropClass = (status: string) => drag.value === null ? {} : {
    target:  canDrop(status),
    over:    canDrop(status) && drag.value.over === status,
    blocked: !canDrop(status) && status !== drag.value.from
}

/*  drag & drop a task box onto another lane (see "drag" of the model)  */
const dragStart = (ev: DragEvent, id: string, from: string, moves?: string[]) => {
    drag.value = { id, from, moves, over: null }
    if (ev.dataTransfer !== null) {
        ev.dataTransfer.setData("text/plain", id)
        ev.dataTransfer.effectAllowed = "move"
    }
}
const dragOver = (ev: DragEvent, status: string) => {
    if (!canDrop(status))
        return
    ev.preventDefault()
    if (ev.dataTransfer !== null)
        ev.dataTransfer.dropEffect = "move"
    drag.value!.over = status
}
const dragLeave = (ev: DragEvent, status: string) => {
    if (drag.value?.over === status && !(ev.currentTarget as Element).contains(ev.relatedTarget as Node | null))
        drag.value.over = null
}
const dragEnd = () => {
    drag.value = null
}
const drop = async (ev: DragEvent, status: string) => {
    ev.preventDefault()
    const d = drag.value
    if (d === null || !canDrop(status))
        return
    drag.value = null
    await moveTask(d.id, status)
}

/*  scroll the selection into view, and focus the selected lane,
    so keys like HOME/END scroll it (unless typing elsewhere)  */
const showSel = () => {
    if (view.value !== "lanes")
        return
    const el = boardEl.value?.querySelector(".card.sel") ?? boardEl.value?.querySelector(".lane.sel")
    el?.scrollIntoView({ block: "nearest", inline: "nearest" })
    const lane = boardEl.value?.querySelector<HTMLElement>(".lane.sel .cards") ?? boardEl.value?.querySelector<HTMLElement>(".lane.sel")
    if (task.value === null && !(document.activeElement instanceof HTMLInputElement))
        lane?.focus({ preventScroll: true })
}
watch([ sel, graph, view, task, grown ], () => nextTick(showSel))
</script>

