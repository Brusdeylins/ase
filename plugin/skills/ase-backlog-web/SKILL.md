---
name: ase-backlog-web
argument-hint: "[--help|-h]"
description: >
    Start the background board server of the current project and open
    the Kanban board web UI in the browser.
    Use when the user wants to "open the board", "show the backlog in
    the browser", or "start the task board web UI".
user-invocable: true
disable-model-invocation: false
effort: low
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-backlog-web">
Open the Task Board Web UI
</purpose>

<expand name="getopt"
    arg1="ase-backlog-web"
    arg2="">
    $ARGUMENTS
</expand>

<objective>
*Open* the Kanban board web UI of the current project in the browser.
</objective>

Procedure
---------

1.  **Start Board Server and Open Browser:**

    1.  Run the command `ase backlog web` with the `Bash` tool. It
        ensures the background board server of the current project is
        running (starting it detached if needed) and opens the board web
        UI in the browser. Do not output anything related to this
        command.

        <if condition="the command failed">
        Only output the following <template/>, where <reason/> is the
        first line of the command error output, and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-backlog-web**, ▶ ERROR: board web UI failed: **<reason/>**
        </template>
        </if>

    2.  Set <url/> to the URL reported by the command output (the line
        of the form `backlog: board web UI: <url/>`). Only output the
        following <template/>:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-backlog-web**, ▶ status: **board web UI opened at <url/>**
        </template>

    3.  Finally, give the closing hints by expanding the following
        (which, depending on the configured <ase-guidance-level/>, may
        each expand into nothing and hence emit no output at all):

        <ase-tpl-hint level="normal">
        Use `/ase-backlog` for a board overview in the chat, `ase backlog status` for all running board servers, and `ase backlog stop` to stop this one.
        </ase-tpl-hint>
