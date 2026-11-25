/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import { taskGuardAnswer } from "./ase-task-board-guard.js"

/*  the standalone "PreToolUse" hook program of the chats of the terminal board, which guards them
    against changing other tasks than "$ASE_TASK_ID" (as the web board does through its service),
    deliberately without the entire CLI, as it runs before every tool invocation  */
const chunks = [] as Buffer[]
process.stdin.on("data", (chunk: Buffer) => { chunks.push(chunk) })
process.stdin.on("end", () => {
    const taskId = process.env.ASE_TASK_ID ?? ""
    let answer   = ""
    try {
        if (taskId !== "")
            answer = taskGuardAnswer(taskId, JSON.parse(Buffer.concat(chunks).toString("utf8")))
    }
    catch {
        /*  an unreadable event is not guarded  */
    }
    if (answer !== "")
        process.stdout.write(answer)
})
