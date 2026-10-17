<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the title line of a task: its epic (if any, and not for an epic itself), its id (behind "≡",
      and of an epic also behind "♛"), its edit request marker and its effort size marker (the size
      behind "⚖" and a thin space), both framed like the bracketed ones of the TUI, and its title (with its Markdown inline code segments)  -->
<template>
    <span v-if="epic !== '' && epic !== id" class="cepic">♛ {{ epic }} ▶</span><span class="cid">{{ epic === id ? "♛ " : "" }}≡ {{ id }}</span><span v-if="edit !== ''" class="cedit" :title="editTitles[edit]">{{ editMarkers[edit] }}</span><span v-if="effort !== ''" class="ceffort" :title="`effort: ${effort}`">⚖&thinsp;{{ effort }}</span><template v-for="(s, si) in titleSegments(title)" :key="si"><code v-if="s.code">{{ s.text }}</code><template v-else>{{ s.text }}</template></template>
</template>

<script setup lang="ts">
import { type EditState } from "./ase-task-board-web-client-model"

withDefaults(defineProps<{ id: string, epic: string, title: string, edit?: EditState | "", effort?: string }>(), {
    edit:   "",
    effort: ""
})

/*  the markers and their explanations of the states of the edit requests of a task  */
const editMarkers: Record<EditState, string> = { pending: "✎", active: "✎…", failed: "✎✗" }
const editTitles:  Record<EditState, string> = {
    pending: "edit by prompt requested",
    active:  "edit by prompt in progress",
    failed:  "edit by prompt failed (press E to retry)"
}

/*  split a task title into its plain text and its Markdown inline code ("`...`") segments  */
const titleSegments = (title: string) =>
    title.split(/`([^`]+)`/).map((text, i) => ({ text, code: i % 2 === 1 })).filter((s) => s.text !== "")
</script>

