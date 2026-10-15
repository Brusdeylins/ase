<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the modal popups: the confirmation of a task deletion, the transfer
      of a task, the prompt of a request of a task, and the busy popup  -->
<template>
    <!--  the confirmation of a task deletion  -->
    <div v-if="confirmDel !== null" id="confirm" @click.self="confirmDel = null">
        <div class="box">
            <div class="ask">Delete task <span class="cid">{{ confirmDel }}</span>?</div>
            <div class="buttons">
                <button @click="deleteTask(confirmDel)">delete</button>
                <button @click="confirmDel = null">cancel</button>
            </div>
            <div class="keys"><kbd>y</kbd><span class="action">deletes</span><span class="sep">·</span><kbd>ESC</kbd><span class="action">cancels</span></div>
        </div>
    </div>

    <!--  the transfer of a task to another state: all lane states, where only the
          current state and the states reachable from it are selectable  -->
    <div v-if="transfer !== null" id="transfer" @click.self="cancelTransfer">
        <div class="box">
            <div class="ask">Transfer task <span class="cid">{{ transfer.id }}</span> to:</div>
            <div class="states">
                <button v-for="e in transferList" :key="e.status" :disabled="!e.ok" :class="{ sel: e.status === transfer.at }"
                    @click="transferTo(transfer.id, e.status)">{{ e.group }} ▷ <span class="state">{{ e.status }}</span><span v-if="e.current" class="cur"> (current)</span></button>
            </div>
            <div class="keys"><kbd>↑</kbd>/<kbd>↓</kbd><span class="action">selects</span><span class="sep">·</span><kbd>⏎</kbd><span class="action">transitions</span><span class="sep">·</span><kbd>ESC</kbd><span class="action">cancels</span></div>
        </div>
    </div>

    <!--  the prompt of an edit request of a task (processed by "ase agent editor"),
          or of a request by prompt of any name (processed by a request agent)  -->
    <div v-if="prompt !== null" id="prompt" @click.self="cancelPrompt">
        <div class="box">
            <div class="ask">{{ prompt.name !== null ? "Request" : "Edit" }} task <span class="cid">{{ prompt.id }}</span> by prompt:</div>
            <div v-if="prompt.name !== null" class="name">request name:
                <input ref="promptName" v-model="prompt.name" list="request-names" spellcheck="false" placeholder="e.g. lint" />
                <datalist id="request-names"><option v-for="n in requestNames" :key="n" :value="n"></option></datalist>
            </div>
            <textarea ref="promptEl" v-model="prompt.text" rows="5" spellcheck="false"></textarea>
            <div class="buttons">
                <button @click="submitPrompt">{{ prompt.name !== null ? "request" : "request edit" }}</button>
                <button @click="cancelPrompt">cancel</button>
            </div>
            <div class="keys"><kbd>⏎</kbd><span class="action">{{ prompt.name !== null ? "requests" : "requests edit" }}</span><span class="sep">·</span><kbd>Shift+⏎</kbd><span class="action">breaks line</span><span class="sep">·</span><kbd>ESC</kbd><span class="action">cancels</span></div>
        </div>
    </div>

    <!--  the modal busy popup of a slow request to the service: a spinner,
          the operation, and its elapsed time, above an indeterminate progress bar  -->
    <div v-if="busy !== null" id="busy">
        <div class="box">
            <div class="ask"><span class="spinner"></span>{{ busy.label.text }}<span v-if="busy.label.id !== undefined" class="cid">{{ busy.label.id }}</span><template v-if="busy.label.suffix !== undefined">{{ busy.label.suffix }}</template><span class="time">({{ busyTime }})</span></div>
            <div class="bar"><div class="block"></div></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { confirmDel, transfer, prompt, busy, busyTime } from "./ase-task-board-web-client-model"
import {
    deleteTask, transferList, cancelTransfer, transferTo,
    requestNames, promptEl, promptName, cancelPrompt, submitPrompt
} from "./ase-task-board-web-client-control"
</script>

