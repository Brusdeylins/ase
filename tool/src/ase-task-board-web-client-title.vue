<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the title line of a task: its epic (if any, and not for an epic itself), its id (behind "≡",
      and of an epic also behind "♛"), its cyclic dependency marker, its edit request marker,
      and its title (with its Markdown inline code segments)  -->
<template>
    <span v-if="epic !== '' && epic !== id" class="cepic">♛ {{ epic }} ▶</span><span class="cid">{{ epic === id ? "♛ " : "" }}≡ {{ id }}</span>{{ cyclic ? "⟲ " : "" }}<span v-if="edit !== ''" class="cedit" :class="edit" :title="editTitles[edit]">{{ editMarkers[edit] }}</span><template v-for="(s, si) in titleSegments(title)" :key="si"><code v-if="s.code">{{ s.text }}</code><template v-else>{{ s.text }}</template></template>
</template>

<script setup lang="ts">
import { type EditState } from "./ase-task-board-web-client-model"

withDefaults(defineProps<{ id: string, epic: string, title: string, cyclic?: boolean, edit?: EditState | "" }>(), {
    cyclic: false,
    edit:   ""
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

