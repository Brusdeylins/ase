<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the terminal of a task: the chat of the agent tool about the task (one for all browsers), whose emulator
      takes the keys itself (listening on the window, which the board ignores for the keys within it), with the
      drop-downs of its model and effort in the footer below it, which are disabled while it works on a turn
      or runs background tasks, as a restart would interrupt resp. stop them, and, once its process ended, an
      overlay to start it again  -->
<template>
    <div class="term">
        <div class="tbody" :style="{ background: paper }">
            <div :key="gen" ref="rootEl" class="troot"></div>
            <div v-if="starting && exited === null" class="tstart"><span class="spin"></span>Starting Claude…</div>
            <div v-if="exited !== null" class="tended">Claude ended (exit code {{ exited }}) <button title="start Claude again for this task (resumes the session)" @click="restart">Start again</button></div>
        </div>
        <div class="tfoot">
            <span>Shift+drag to select, Cmd+C (Ctrl+C) to copy</span>
            <span class="gap"></span>
            <label>model <select v-model="model" :disabled="locked" :title="why ?? 'model of the chat (restarts it); * marks the default of Claude'" @change="restart">
                <option v-for="m in models" :key="m" :value="m">{{ m + (m === defaults.model ? " *" : "") }}</option>
            </select></label>
            <label>effort <select v-model="effort" :disabled="locked" :title="why ?? 'effort of the chat (restarts it); * marks the default of Claude'" @change="restart">
                <option v-for="e in efforts" :key="e" :value="e">{{ e + (e === defaults.effort ? " *" : "") }}</option>
            </select></label>
            <span class="ctx" :title="context !== null ? `context window: ${tokens(context.size)} tokens, ${tokens(context.tokens)} used` : 'context window used by the chat'">◔ <span class="bar">{{ bar }}</span> {{ context !== null ? `${Math.floor(context.pct)}% (${tokens(context.tokens)})` : "–" }}</span>
            <button :disabled="!chatFits" :title="!chatFits ? 'the window is too narrow to place the chat beside the task' : beside ? 'place the chat below the task (C)' : 'place the chat beside the task (C)'"
                @click="chat.place = beside ? 'below' : 'beside'">{{ beside ? "◧" : "⬓" }}</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue"
import type { Restty } from "restty"
import { api, chat, beside, chatFits } from "./ase-task-board-web-client-model"
import { loadEmulator, terminalFonts, terminalTheme, terminalDark, terminalPaper, terminalPalette } from "./ase-task-board-web-client-term"

/*  the task of the terminal  */
const props = defineProps<{ id: string }>()

/*  the models and efforts to choose from, where the default of the agent tool is marked, and chosen by
    passing none (as the agent tool then uses its default, also with changed settings)  */
const models  = [ "fable", "opus", "sonnet", "haiku" ]
const efforts = [ "max", "xhigh", "high", "medium", "low" ]

/*  the state of the terminal: its model and effort, the number of its running background tasks, and the exit code of its ended process  */
type Context = { pct: number, tokens: number, size: number }
type State   = { running: boolean, exited: number | null, model: string, effort: string, background: number, busy: boolean, defaults: { model: string, effort: string }, theme: "dark" | "light" | null, context: Context | null, url: string }
const model  = ref("")
const effort = ref("")
const exited  = ref<number | null>(null)
const running = ref(false)
const context = ref<Context | null>(null)
const background = ref(0)
const busy = ref(false)
const defaults = ref({ model: "", effort: "" })
const gen    = ref(0)
const starting = ref(true)
const rootEl = ref<HTMLElement | null>(null)
let url      = ""
let baseline: "dark" | "light" = "light"
let retheme: ReturnType<typeof setTimeout> | null = null
let restty: Restty | null = null
let timer: ReturnType<typeof setInterval> | null = null

/*  take over the state of the terminal, resp. report whether it could not be fetched  */
const adopt = (state: State, fresh: boolean): void => {
    exited.value  = state.exited
    running.value = state.running

    /*  follow the model and effort the user changed within the agent tool (unless just choosing one)  */
    if (!fresh && !(document.activeElement instanceof HTMLSelectElement)) {
        model.value  = state.model
        effort.value = state.effort
    }
    if (state.theme !== null)
        baseline = state.theme
    else if (fresh)
        baseline = effective()
    context.value = state.context
    url           = state.url

    /*  apply a change of the color theme deferred while the agent tool was working or ran background tasks, once it is done  */
    const lockedBefore = locked.value
    background.value = state.background
    busy.value        = state.busy
    defaults.value    = state.defaults
    if (!fresh && lockedBefore && !locked.value)
        rethemed()
    if (fresh) {
        model.value  = state.model
        effort.value = state.effort
    }
}

/*  (re)connect the terminal emulator to the terminal of the task  */
const connect = async (): Promise<void> => {
    restty?.destroy()
    restty = null
    await nextTick()
    if (rootEl.value === null)
        return
    emulator = await loadEmulator()
    starting.value = true
    restty = new emulator.Restty({
        root:     rootEl.value,
        terminal: { fonts: terminalFonts, ligatures: false, theme: theme() },
        services: { beforeRenderOutput: () => { starting.value = false } }
    })
    restty.connectPty(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${url}`)
    restty.focus()
}

/*  whether a restart of the process is to be avoided, as the agent tool works on a turn (which a restart would interrupt) or
    runs background tasks (which a restart would stop), and the tooltip of the controls restarting the process then  */
const locked = computed(() => busy.value || background.value > 0)
const why    = computed(() => {
    if (busy.value)
        return "Claude is working — a restart would interrupt it"
    const n = background.value
    return n > 0 ? `${n} background task${n === 1 ? "" : "s"} running — a restart would stop ${n === 1 ? "it" : "them"}` : null
})

/*  the bar of the context usage, drawn as the status line of ASE does: 20 characters, filled in proportion  */
const bar = computed(() => {
    const filled = Math.round(Math.min(100, Math.max(0, context.value?.pct ?? 0)) / 100 * 20)
    return "█".repeat(filled) + "░".repeat(20 - filled)
})

/*  a token count in thousands resp. millions  */
const tokens = (n: number): string =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

/*  let the terminal emulator fit its new size after a change of the layout of the dialog (which tells the
    terminal its new size)  */
const fit = (): void => {
    nextTick(() => requestAnimationFrame(() => { restty?.requestLayoutSync() }))
}
watch([ beside, () => chat.split, () => chat.across ], fit)

/*  let the terminal follow the color theme of the board (cycled with "L", or changed in the system), live, while the
    agent tool takes its own color theme from its settings with its next start only  */
const paper  = ref(terminalPaper())
let emulator: Awaited<ReturnType<typeof loadEmulator>> | null = null
const theme = () => terminalTheme(emulator!.getBuiltinTheme(terminalPalette(terminalDark()))!)
const effective = (): "dark" | "light" => terminalDark() ? "dark" : "light"
const colors = (): void => {
    paper.value = terminalPaper()
    if (restty !== null && emulator !== null)
        restty.applyTheme(theme(), "board")

    /*  restart the running agent tool with the matching theme once the light or dark theme it started with
        really changed (debounced, so cycling through the themes restarts it at most once)  */
    if (retheme !== null)
        clearTimeout(retheme)
    retheme = setTimeout(() => {
        retheme = null
        rethemed()
    }, 500)
}

/*  restart the running agent tool if its theme differs from the one of the board, unless it is working or runs background
    tasks (then the restart is deferred until the state tells it is done, and the theme still differs)  */
const rethemed = (): void => {
    if (running.value && exited.value === null && !locked.value && effective() !== baseline)
        restart()
}
const watcher = new MutationObserver(colors)
const scheme  = window.matchMedia("(prefers-color-scheme: dark)")

/*  restart the process of the terminal with the chosen model and effort (resuming its session)  */
const restart = async (): Promise<void> => {
    const state = await api<State>(`/task-board/api/task/${encodeURIComponent(props.id)}/terminal`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            model:  model.value === defaults.value.model ? "" : model.value,
            effort: effort.value === defaults.value.effort ? "" : effort.value,
            theme:  terminalDark() ? "dark" : "light"
        })
    }, true)
    if (state.error !== undefined)
        return
    adopt(state, true)
    gen.value++
    await connect()
}

onMounted(async () => {
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: [ "data-theme" ] })
    scheme.addEventListener("change", colors)

    /*  start the process right away, while the terminal emulator loads in the meantime  */
    const [ state ] = await Promise.all([
        api<State>(`/task-board/api/task/${encodeURIComponent(props.id)}/terminal?theme=${terminalDark() ? "dark" : "light"}`, { method: "PUT" }, true),
        loadEmulator().catch(() => null)
    ])
    if (state.error !== undefined)
        return
    adopt(state, true)
    await connect()
    fit()

    /*  follow the end of the process (which the emulator does not report)  */
    timer = setInterval(async () => {
        const next = await api<State>(`/task-board/api/task/${encodeURIComponent(props.id)}/terminal`, undefined, true)
        if (next.error === undefined)
            adopt(next, false)
    }, 3000)
})
onBeforeUnmount(() => {
    if (retheme !== null)
        clearTimeout(retheme)
    watcher.disconnect()
    scheme.removeEventListener("change", colors)
    if (timer !== null)
        clearInterval(timer)
    restty?.destroy()
    restty = null
})
</script>
