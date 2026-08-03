---
name: ase-task-list
argument-hint: "[--help|-h] [--verbose|-v] [--include|-i=<state>[,...]] [--exclude|-e=<state>[,...]]"
description: >
    List all available task ids.
    Use when user wants to see all tasks.
user-invocable: true
disable-model-invocation: false
effort: high
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-task-list">
List Task Plans
</purpose>

<expand name="getopt"
    arg1="ase-task-list"
    arg2="--verbose|-v --include|-i=none --exclude|-e=COMPLETED,CANCELLED">
    $ARGUMENTS
</expand>

<objective>
*List* all available *task plans* of the current project.
</objective>

Procedure
---------

1.  Determine the *effective state set* <states/>, i.e., the lifecycle
    states a task plan has to be in to be listed at all. For this, parse
    <getopt-option-include/> and <getopt-option-exclude/> as
    comma-separated token lists, silently dropping the `none` sentinel
    and any empty token. If a token <token/> is *not* one of the eight
    `Status:` values `DRAFTED`, `REJECTED`, `APPROVED`, `DEFERRED`,
    `STARTED`, `BLOCKED`, `COMPLETED`, or `CANCELLED`, only output the
    following <template/> and then *STOP* processing the entire current
    skill:

    <template>
    ⧉ **ASE**: ✪ skill: **ase-task-list**, ▶ ERROR: invalid state: **<token/>**
    </template>

    Otherwise set <states/> to *all* eight states if both lists are
    empty, to the *include* list if only it is non-empty, to all eight
    *minus* the *exclude* list if only it is non-empty, and to the
    *include* list *minus* the *exclude* list if both are non-empty. If
    the resulting <states/> is *empty*, only output the following
    <template/> and then *STOP* processing the entire current skill:

    <template>
    ⧉ **ASE**: ✪ skill: **ase-task-list**, ▶ ERROR: options `--include` and `--exclude` cancel out to an empty state set
    </template>

2.  Call the `ase_task_list(verbose: <getopt-option-verbose/>)` tool from
    the `ase` MCP server. The result is a structured object with a
    `tasks` array where each entry has an `id` and a `status` field, and
    -- if <getopt-option-verbose/> is `true` -- additionally an `mtime`
    field (formatted as `YYYY-MM-DD HH:MM`). *Drop* from the `tasks`
    array every entry whose `status` is *not* contained in <states/>. Do
    not output anything.

3.  If the `tasks` array is empty, output the following <template/>:

    <template>
    ⧉ **ASE**: ◉ tasks: *(none)*
    </template>

    Else, dispatch on <getopt-option-verbose/>:

    -   If <getopt-option-verbose/> is `true`, output the list of tasks
        with the following <template/>, where each <id/>, <status/>, and
        <mtime/> correspond to an entry in the task list:

        <template>
        ⧉ **ASE**: ◉ tasks:

        | *Task Id* | *Status*    | *Last Modified*    |
        |-----------|-------------|--------------------|
        | **<id/>** | `<status/>` | `<mtime/>`         |
        | [...]     | [...]       | [...]              |

        </template>

    -   If <getopt-option-verbose/> is `false`, output the list of tasks
        with the following <template/>, where each <id/> corresponds to
        an entry in the task list:

        <template>
        ⧉ **ASE**: ◉ tasks:

        | *Task Id* |
        |-----------|
        | **<id/>** |
        | [...]     |

        </template>

4.  Finally, give the closing hints by expanding the following (which,
    depending on the configured <ase-guidance-level/>, may each expand
    into nothing and hence emit no output at all):

    <if condition="the `tasks` array is NOT empty">
    <ase-tpl-hint level="normal">
    Use `/ase-task-id <id>` to switch to one of the listed tasks and `/ase-task-view` to inspect its plan.
    </ase-tpl-hint>
    </if>
    <elseif condition="entries were dropped by the state filtering of step 2">
    <ase-tpl-hint level="normal">
    All task plans were filtered out by the effective state set -- use `/ase-task-list --exclude none` to list them regardless of their status.
    </ase-tpl-hint>
    </elseif>
    <else>
    <ase-tpl-hint level="normal">
    No task plan exists yet -- use `/ase-task-edit` to create one through a conversational loop.
    </ase-tpl-hint>
    </else>

    <if condition="<getopt-option-verbose/> is not equal `true`">
    <ase-tpl-hint level="verbose">
    Use `/ase-task-list --verbose` to additionally show the status and the last-modified timestamp of each task plan.
    </ase-tpl-hint>
    </if>

    <ase-tpl-hint level="verbose">
    Use `/ase-task-list --include`/`--exclude` to narrow the listing to certain lifecycle states, e.g. `--include STARTED,BLOCKED`.
    </ase-tpl-hint>

