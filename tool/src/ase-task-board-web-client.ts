/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  the entry point of the browser client of the web board  */
import { createApp } from "vue"
import App           from "./ase-task-board-web-client.vue"

createApp(App).mount("#app")

