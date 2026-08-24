---
name: ase-backlog
argument-hint: "[--help|-h]"
description: >
    Show the Kanban board overview of the persisted task plans,
    grouped by their board lanes, plus all running board servers.
    Use when the user wants to see the "backlog", "task board",
    "kanban board", or "board overview".
user-invocable: true
disable-model-invocation: false
effort: low
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-backlog">
Show the Task Board Overview
</purpose>

<expand name="getopt"
    arg1="ase-backlog"
    arg2="">
    $ARGUMENTS
</expand>

<objective>
*Show* the Kanban board overview of the persisted task plans.
</objective>

Procedure
---------

1.  **Synchronize Board:**

    1.  Run the command `ase backlog sync` with the `Bash` tool to
        synchronize the task plans and the board mirror. Do not output
        anything related to this command.

        <if condition="the command failed">
        Only output the following <template/>, where <reason/> is the
        first line of the command error output, and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-backlog**, ▶ ERROR: board sync failed: **<reason/>**
        </template>
        </if>

2.  **Determine Lanes:**

    1.  Run the command `ase config get project.backlog.lanes` with the
        `Bash` tool. If it succeeds, parse its output of the form
        `<lane/>=<state/>[+<state/>...][;<lane/>=...]` into the lane
        list <lanes/>. If it fails (key not set), use the default lanes:

        `Crafting=DRAFTED+REJECTED`,
        `Ready=APPROVED`,
        `Deferred=DEFERRED`,
        `Implementation=STARTED+BLOCKED`,
        `Code-Review=COMPLETED`,
        `Closed=CLOSED+CANCELLED`.

        Do not output anything in this step.

3.  **Show Board Overview:**

    1.  Call the `ase_task_list(verbose: true)` tool of the `ase` MCP
        server and set <tasks/> to its result entries, each carrying an
        `id` and a `status`. Do not output anything related to this MCP
        tool call.

    2.  Group the <tasks/> by mapping each task's `status` onto its lane
        from <lanes/>. Then only output the following <template/>, with
        one row per lane (in the order of <lanes/>), where <ids/> is the
        comma-separated list of the task ids of the lane (or `-` for an
        empty lane):

        <template>
        <ase-tpl-boxed title="BACKLOG" subtitle="board overview">

        | Lane     | Tasks   |
        | -------- | ------- |
        | <lane/>  | <ids/>  |

        </ase-tpl-boxed>
        </template>

4.  **Show Board Servers:**

    1.  Run the command `ase backlog status` with the `Bash` tool and
        set <status/> to its verbatim output (independent of its exit
        code, as "no board servers running" is a regular outcome). Only
        output the following <template/>:

        <template>
        ```
        <status/>
        ```
        </template>

    2.  Finally, give the closing hints by expanding the following
        (which, depending on the configured <ase-guidance-level/>, may
        each expand into nothing and hence emit no output at all):

        <ase-tpl-hint level="normal">
        Use `/ase-backlog-web` to open the interactive board web UI, or run `ase backlog board` in a terminal for the TUI.
        </ase-tpl-hint>
