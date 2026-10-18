<!--
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
-->

<!--  the modal popups: the confirmation of a task deletion, the transfer of a
      task, the assignment of a task, the prompt of a request of a task, and the busy popup  -->
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

    <!--  the assignment of a task: a free assignee field with the drop-down of the
          suggested assignees (users and agents), marking an unknown assignee  -->
    <div v-if="assign !== null" id="assign" @click.self="cancelAssign">
        <div class="box">
            <div class="ask">Assign task <span class="cid">{{ assign.id }}</span> to:</div>
            <div class="combo">
                <input id="assign-name" ref="assignEl" v-model="assign.name" spellcheck="false" autocomplete="off" placeholder="none"
                    @input="typeAssign" />
                <span v-if="assignUnknown" class="unknown">unknown</span>
                <span class="mark">▾</span>
                <ul v-if="assignChoices.length > 0" class="drop">
                    <li v-for="c in assignChoices" :key="c.name" :class="{ sel: c.name === assign.name }"
                        @mousedown.prevent="assignTo(assign.id, c.name)"><span class="icon">{{ c.kind === "user" ? "☺" : c.kind === "agent" ? "⚉" : "" }}</span>{{ c.name }}</li>
                </ul>
            </div>
            <div class="buttons">
                <button @click="submitAssign">assign</button>
                <button @click="cancelAssign">cancel</button>
            </div>
            <div class="keys"><kbd>↑</kbd>/<kbd>↓</kbd><span class="action">pick assignee</span><span class="sep">·</span><kbd>⏎</kbd><span class="action">assign</span><span class="sep">·</span><kbd>ESC</kbd><span class="action">cancel</span></div>
        </div>
    </div>

    <!--  the prompt of an edit request of a task (processed by "ase agent editor"),
          or of a request by prompt of any name (processed by a request agent),
          where the prompt is disabled for a request ignoring its prompt  -->
    <div v-if="prompt !== null" id="prompt" @click.self="cancelPrompt">
        <div class="box">
            <div class="ask">{{ prompt.name !== null ? "Request agent for" : "Edit" }} task <span class="cid">{{ prompt.id }}</span> by prompt:</div>
            <div v-if="prompt.name !== null" class="fields">
                <label for="prompt-name">request name:</label>
                <div class="combo">
                    <input id="prompt-name" ref="promptName" v-model="prompt.name" spellcheck="false" autocomplete="off" placeholder="e.g. lint"
                        @input="typeRequest" @focus="focusRequest(true)" @blur="focusRequest(false)" />
                    <span v-if="requestNames.length > 0" class="mark">▾</span>
                    <ul v-if="promptFocus && requestChoices.length > 0" class="drop">
                        <li v-for="n in requestChoices" :key="n" :class="{ sel: n === prompt.name }" @mousedown.prevent="pickRequest(n)">{{ n }}</li>
                    </ul>
                </div>
                <label for="prompt-text">request prompt:</label>
                <textarea v-if="promptIgnored" id="prompt-text" rows="5" disabled placeholder="(ignored by the agents of this request)"></textarea>
                <textarea v-else id="prompt-text" ref="promptEl" v-model="prompt.text" rows="5" spellcheck="false"></textarea>
            </div>
            <textarea v-else ref="promptEl" v-model="prompt.text" rows="5" spellcheck="false"></textarea>
            <div class="buttons">
                <button ref="promptOk" @click="submitPrompt">{{ prompt.name !== null ? "request" : "request edit" }}</button>
                <button ref="promptNo" @click="cancelPrompt">cancel</button>
            </div>
            <div class="keys"><kbd>⇥</kbd><span class="action">switch field</span><span class="sep">·</span><template v-if="prompt.name !== null"><kbd>↑</kbd>/<kbd>↓</kbd><span class="action">pick name</span><span class="sep">·</span></template><kbd>⇧⏎</kbd><span class="action">new line</span><span class="sep">·</span><kbd>⏎</kbd><span class="action">{{ prompt.name !== null ? "request" : "request edit" }}</span><span class="sep">·</span><kbd>ESC</kbd><span class="action">cancel</span></div>
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
import { confirmDel, transfer, assign, prompt, busy, busyTime } from "./ase-task-board-web-client-model"
import {
    deleteTask, transferList, cancelTransfer, transferTo,
    assignEl, assignChoices, assignUnknown, typeAssign, cancelAssign, assignTo, submitAssign,
    requestNames, requestChoices, pickRequest, typeRequest, focusRequest, promptFocus, promptIgnored,
    promptEl, promptName, promptOk, promptNo, cancelPrompt, submitPrompt
} from "./ase-task-board-web-client-control"
</script>

