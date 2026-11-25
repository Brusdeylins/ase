<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the chat about a task: the terminal emulator attached to the chat kept running by the ASE
      service, which takes all keys while it has the focus, with a note on its start, end, or failure, and
      (extras) an overlay to start it again once ended, and a footer with its model and effort
      (locked while the agent tool works or runs background tasks) and its context usage  -->
<template>
    <div id="chat" @focusin="chatFocused = true" @focusout="chatFocused = false">
        <div class="cmain">
            <div :key="gen" ref="rootEl" class="cterm"></div>
            <div v-if="note !== null && exited === null" class="cnote">{{ note }}</div>
            <div v-if="exited !== null" class="cnote">agent tool ended (exit code {{ exited }})
                <button title="start the agent tool again (resuming the session)" @click="restart">start again</button></div>
        </div>
        <div class="cfoot">
            <span class="mute">Shift+drag selects, Cmd/Ctrl+C copies</span>
            <span class="spacer"></span>
            <label>model <select v-model="model" :disabled="locked" :title="why ?? 'model of the chat (restarts it); * marks the default'"
                @change="restart"><option v-for="m in models" :key="m" :value="m">{{ m + (m === defaults.model ? " *" : "") }}</option></select></label>
            <label>effort <select v-model="effort" :disabled="locked" :title="why ?? 'effort of the chat (restarts it); * marks the default'"
                @change="restart"><option v-for="e in efforts" :key="e" :value="e">{{ e + (e === defaults.effort ? " *" : "") }}</option></select></label>
            <span class="ctx" :title="context !== null ? `context window: ${tokens(context.size)} tokens, ${tokens(context.tokens)} used` : 'context window'">
                ◔ <span class="bar">{{ bar }}</span> {{ context !== null ? `${Math.floor(context.pct)}% (${tokens(context.tokens)})` : "–" }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue"
import { chatAttach, chatRequest, chatFocused, type ChatState, type ChatContext } from "./ase-task-board-web-client-chat"

const props = defineProps<{ id: string }>()

/*  the models and efforts to choose from, where the default of the agent tool is marked  */
const models  = [ "fable", "opus", "sonnet", "haiku" ]
const efforts = [ "max", "xhigh", "high", "medium", "low" ]

/*  the state of the chat  */
const rootEl     = ref<HTMLElement | null>(null)
const note       = ref<string | null>("starting agent tool…")
const gen        = ref(0)
const exited     = ref<number | null>(null)
const running    = ref(false)
const model      = ref("")
const effort     = ref("")
const defaults   = ref({ model: "", effort: "" })
const busy       = ref(false)
const background = ref(0)
const context    = ref<ChatContext | null>(null)
let   detach     = null as (() => void) | null
let   timer      = null as ReturnType<typeof setInterval> | null
let   url        = ""
let   hidden     = false

/*  whether a restart is to be avoided (as it would interrupt a turn or stop background tasks), and why  */
const locked = computed(() => busy.value || background.value > 0)
const why    = computed(() => {
    if (busy.value)
        return "the agent tool is working (a restart would interrupt it)"
    const n = background.value
    return n > 0 ? `${n} background task${n === 1 ? "" : "s"} running (a restart would stop ${n === 1 ? "it" : "them"})` : null
})

/*  the bar of the context usage (20 characters, filled in proportion), and a token count  */
const bar = computed(() => {
    const filled = Math.round(Math.min(100, Math.max(0, context.value?.pct ?? 0)) / 100 * 20)
    return "█".repeat(filled) + "░".repeat(20 - filled)
})
const tokens = (n: number): string =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

/*  take over the state of the chat (keeping a model or effort being chosen)  */
const adopt = (state: ChatState, fresh: boolean): void => {
    exited.value     = state.exited
    running.value    = state.running
    defaults.value   = state.defaults
    busy.value       = state.busy
    background.value = state.background
    context.value    = state.context
    url              = state.url
    if (fresh || !(document.activeElement instanceof HTMLSelectElement)) {
        model.value  = state.model
        effort.value = state.effort
    }
}

/*  (re)connect the terminal emulator  */
const connect = async (): Promise<void> => {
    detach?.()
    detach = null
    await nextTick()
    if (rootEl.value !== null)
        detach = await chatAttach(url, rootEl.value, (text) => { note.value = text }, () => hidden)
}

/*  restart the agent tool with the chosen model and effort (the defaults passed as none),
    resuming its session  */
const restart = async (): Promise<void> => {
    const state = await chatRequest(props.id, "PUT", {
        model:  model.value === defaults.value.model ? "" : model.value,
        effort: effort.value === defaults.value.effort ? "" : effort.value
    })
    if (state.error !== undefined) {
        note.value = `restarting the chat failed: ${state.error}`
        return
    }
    adopt(state, true)
    gen.value++
    await connect()
}

onMounted(async () => {
    const state = await chatRequest(props.id, "POST")
    if (hidden)
        return
    if (state.error !== undefined) {
        note.value = `starting the chat failed: ${state.error}`
        return
    }
    adopt(state, true)
    await connect()

    /*  follow the state of the chat (its end, model, effort, busy state, and context usage)  */
    timer = setInterval(async () => {
        const next = await chatRequest(props.id, "GET")
        if (next.error === undefined)
            adopt(next, false)
    }, 3000)
})
onBeforeUnmount(() => {
    hidden = true
    chatFocused.value = false
    if (timer !== null)
        clearInterval(timer)
    detach?.()
})
</script>

