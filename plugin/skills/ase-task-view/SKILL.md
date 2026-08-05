---
name: ase-task-view
argument-hint: "[--help|-h] [--full|-f] [<id>]"
description: >
    View current or given task plan.
    Use when the user calls to "view", "show" or "see" the
    "task", "plan", "spec", or "specification".
user-invocable: true
disable-model-invocation: false
effort: high
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-task-view">
View a Task Plan
</purpose>

<expand name="getopt"
    arg1="ase-task-view"
    arg2="--full|-f">
    $ARGUMENTS
</expand>

<objective>
*View* the task plan.
</objective>

Procedure
---------

1.  **Determine Task:**

    1.  Set <id><getopt-arguments/></id> initially, with any leading and trailing
        whitespace stripped.
        Inherit the always existing <ase-task-id/> from the current context.
        Do not output anything.

    2.  <if condition="<id/> is empty">
        Set <id><ase-task-id/></id>
        Do not output anything.
        </if>

    3.  <if condition="<id/> does NOT match the regexp `^[a-zA-Z][a-zA-Z0-9_-]*$`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-task-view**, ▶ ERROR: expected single `[<id>]` argument
        </template>
        </if>

2.  **Perform Operation**:

    1.  Call the `ase_task_load(id: "<id/>", variant: "render")` tool
        of the `ase` MCP server to load the task plan content in its
        *rendering-prepared* form -- this skill is *display-only* and
        hence never persists the plan again -- and set <text/> to the
        `text` output field of this `ase_task_load` tool call. Do not
        output anything related to this MCP tool call.

        -   If <text/> starts with `ERROR:` or `WARNING:`:
            Set <task-content></task-content> (set task content to empty).
            Only output the following <template/>:

            <template>
            ⧉ **ASE**: ◉ task: **<id/>**, ▶ status: **<text/>**
            </template>

        -   If <text/> starts NOT with `ERROR:` and NOT with `WARNING:`:
            Set <task-content><text/></task-content> (set task content to text).
            Calculate the number of words <words/> of <task-content/>.
            Only output the following <template/>:

            <template>
            ⧉ **ASE**: ◉ task: **<id/>**, ✪ plan: **<words/>** words, ▶ status: **plan loaded**
            </template>

    2.  <if condition="<task-content/> is not empty">
        Treat <task-content/> as *verbatim* Markdown.

        For the *rendering only*, drop the leading *frontmatter* block --
        both `---` delimiters and all of their keys -- and instead place
        the following column-aligned glyph lines *before* the
        `#   TASK: <title/>` heading, separated from it by an empty line,
        omitting the line of every key absent from the frontmatter. The
        glyph lines *MUST* stay *above* the heading, exactly where the
        frontmatter block sits in the plan file, and *MUST NOT* be moved
        below it. This keeps the `---` delimiters from rendering as a
        horizontal rule plus a *setext heading*. This rewrite is
        *display-only* and *MUST NOT* change <task-content/> itself:

        <format>
        ◉   **Id:**         <task-id/>
        ⎈   **Created:**    <timestamp-created/>
        ⚙   **Modified:**   <timestamp-modified/>
        ◐   **Status:**     <task-status/>
        ⚑   **Properties:** <task-properties/>
        ☯   **Kind:**       <task-kind/>
        </format>

        *Render plan*: Only output the following <template/>. If
        <getopt-option-full/> is *not* `true`, <task-content/> is longer than
        90 lines, and a `##  IMPLEMENTATION DRAFT` section (from the
        companion skill `ase-task-preflight`) exists, replace the entire
        content of the `##  IMPLEMENTATION DRAFT` section with `[...]`.
        Else, do *not* truncate, summarize, or partially show the plan.
        Use the following <template/>:

        <template>
        <ase-tpl-head title="TASK" subtitle="<task-id/>"/>
        <task-content/>
        <ase-tpl-foot title="TASK" subtitle="<task-id/>"/>
        </template>
        </if>

    3.  Finally, give the closing hints by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may each
        expand into nothing and hence emit no output at all):

        <if condition="<task-content/> is not empty">
        <ase-tpl-hint level="normal">
        Use `/ase-task-edit` or `/ase-task-grill` to refine this plan, `/ase-task-preflight` to dry-run it, and `/ase-task-implement` to realize it.
        </ase-tpl-hint>

        <if condition="<getopt-option-full/> is not equal `true` and the `##  IMPLEMENTATION DRAFT` section was replaced with `[...]`">
        <ase-tpl-hint level="verbose">
        Use `/ase-task-view --full` to show the elided `IMPLEMENTATION DRAFT` section, too.
        </ase-tpl-hint>
        </if>
        </if>
        <else>
        <ase-tpl-hint level="normal">
        No plan exists under this task id -- use `/ase-task-list` to see the available tasks and `/ase-task-edit` to create a plan.
        </ase-tpl-hint>
        </else>

