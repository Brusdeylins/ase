---
name: ase-task-grill
argument-hint: "[--help|-h] [--next|-n <option>[,...]] [<id>]"
description: >
    Interview the user relentlessly about the task plan until reaching a
    shared understanding, resolving each branch of the question decision
    tree. Use when the user wants to stress-test a plan, get grilled on
    their plan, or mentions "grill me" or "grill plan".
user-invocable: true
disable-model-invocation: false
effort: high
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-dialog.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-task-grill">
Iteratively Grill a Task Plan
</purpose>

<expand name="getopt"
    arg1="ase-task-grill"
    arg2="--next|-n=(none|DONE|EDIT|IMPLEMENT|PREFLIGHT)... --int-reuse-task">
    $ARGUMENTS
</expand>

<objective>
Interview the user relentlessly about every essential aspect of the
task plan until reaching a shared understanding.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-task.md

Procedure
---------

<define name="handoff-args">
Set <args>--int-reuse-task</args>.
<if condition="<getopt-option-next/> is not equal `none`">
    Set <args><args/> --next <getopt-option-next/></args>
</if>
</define>

1.  **Determine Task:**

    1.  Set <instruction><getopt-arguments/></instruction> initially, with any
        leading and trailing whitespace stripped.
        Inherit the always existing <ase-task-id/> from the current context.
        Inherit the always existing <ase-session-id/> from the current context.
        Do not output anything.

    2.  React on task id:

        <expand name="task-react-id" arg1="ase-task-grill"></expand>

2.  **Determine Task Plan:**

    1.  Determine the current task plan content:

        <expand name="task-load-content"></expand>

        Set <plan><task-content/></plan> (alias the loaded task content
        for the subsequent steps). Do not output anything.

    2.  <if condition="<plan/> is empty">
        Complain and tell the user to use the `ase-code-resolve`,
        `ase-code-refactor`, `ase-code-craft`, or `ase-task-edit` skills
        first to create a task plan. Then immediately stop processing
        this skill.
        </if>

3.  **Iterate Over Task Plan Aspects:**

    Interactively interview the user *relentlessly* about every
    *essential aspect* of the task plan in <plan/> *until* reaching a
    shared understanding and no decisions/questions are left open.

    This especially means, you *MUST* clarify as many aspects as
    necessary to ensure that for at least the most important decisions,
    during a subsequent implementation, no essential freedom of choices
    exist any longer.

    For this process, determine the <n/> essential aspects <aspect-N/>
    (a one or two word long short identifier like `Foo` or `Bar-Baz`)
    and the corresponding decision/question <question-N/> where a shared
    understanding is required.

    Honor also the following checks for identifying the problematic
    aspects:

    -   **Fuzzy Language**:
        When the user uses vague or overloaded terms instead of a precise
        or canonical term.

    -   **Conflicting Terminology**:
        When the user uses a term that conflicts with the existing
        terminology in the code base.

    -   **Conflicting Code**:
        When the user states how something works, check whether the
        current code state really agrees.

    -   **Non-Concrete Scenarios**:
        When domain relationships are being discussed, stress-test them
        with specific scenarios. Invent scenarios that probe edge cases
        and force the user to be precise about the boundaries between
        concepts.

    Then create a decisions/questions tree for them. Walk down each
    branch of this decision tree, resolving dependencies between
    decisions one-by-one. Ask the questions <question-N/> and determine
    corresponding answer <answer-N/>, one at a time.

    1.  For each question <question-N/> in the iteration cycle <N/>:

        1.  Output the following <template/>:

            <template>
            <ase-tpl-bullet-signal/> ASPECT <N/>/<n/>: **<aspect-N/>**, QUESTION: **<question-N/>**
            </template>

        2.  Determine the answer alternatives:

            1.  Check the <plan/> for the answer <answer-N-1/>.

            2.  Check the code base and your world knowledge and
                use this information to find *up to three* grounded
                alternative answers <answer-N-K/> (K={2,3,4}), so there
                are between two and four answer options in total.

            3.  In the following, you *MUST* *NOT* use your built-in
                <user-dialog-tool/> tool! Instead, you *MUST* just show a
                custom dialog according to the expanded `custom-dialog`
                definition. You *MUST* closely follow this definition.

                Let the user select the <answer-N/> out of the answer
                alternatives <answer-N-K/> by raising a question with the
                following custom dialog, where per alternative <answer-N-K/>
                you determine a brief label <answer-N-K-label/> and a
                description <answer-N-K-description/>, and you mark the
                <answer-N-1/> by prefixing its description with
                `⚝ **CURRENT PLAN** ⚝ `. Emit only the answer lines for the
                alternatives <answer-N-K/> you actually determined in the
                previous step (between two and four lines in total):

                <expand name="custom-dialog" arg1="--other">
                    <aspect-N/>: <question-N/>
                    <answer-N-1-label/>: ⚝ **CURRENT PLAN** ⚝ - <answer-N-1-description/>
                    <answer-N-K-label/>: <answer-N-K-description/>
                    [...]
                </expand>

                Set <answer-N/> to the selected <result/>.

            4.  Output the following <template/>:

                <template>
                <ase-tpl-bullet-normal/> ASPECT <N/>/<n/>: **<aspect-N/>**, ANSWER: **<answer-N/>**
                </template>

    2.  Finally, update the plan in <plan/> based on all answers <answer-N/>.

    3.  <if condition="the frontmatter of <plan/> carries a `Created: <text/>` key">
        Set <timestamp-created><text/></timestamp-created> (set
        timestamp-created to extracted text)
        </if>

    4.  Call the `ase_timestamp(format: "yyyy-LL-dd HH:mm")` tool of the
        `ase` MCP server and use the `text` field of its response for
        <timestamp-modified/> information. If <timestamp-created/> is
        still unset (because the previous <plan/> had no `Created:`
        frontmatter key), set <timestamp-created><timestamp-modified/></timestamp-created>
        (fall back to the modified timestamp). Then insert the current
        <ase-task-id/>, previous <timestamp-created/>, and refreshed
        <timestamp-modified/> information into the frontmatter keys `Id:`,
        `Created:`, and `Modified:` and calculate the number of
        words <words/> of <plan/>. Additionally *add* the value `grilled`
        to the `Properties:` frontmatter key if it is still absent,
        keeping all already present values and *creating* the whole key
        (with the single value `grilled`) if the plan carries none.

    5.  Call the `ase_task_save(id: "<ase-task-id/>",
        text: "<plan/>")` tool of the `ase` MCP server to save the updated
        task plan content. Do not output anything related to this MCP
        call.

    6.  Only output the following <template/> and continue processing:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan updated**
        </template>

4.  **Decide Next Step:**

    1.  *Determine next step*:

        <expand name="task-next-select"
            arg1="ase-task-grill"
            arg2="DONE|EDIT|IMPLEMENT|PREFLIGHT">
            Next Step: How would you like to proceed with the plan?
            DONE: Stop processing.
            EDIT: Hand off plan to editing.
            PREFLIGHT: Hand off plan to pre-flighting.
            IMPLEMENT: Hand off plan to implementation.
        </expand>

    2.  Check the tool <result/> and dispatch accordingly:

        -   If <result/> is `DONE` or `CANCEL`:
            Only output the following <template/> and then *STOP*,
            without output of any further information.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan updated -- done**
            </template>

        -   If <result/> is `EDIT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            tool `Skill(skill: "ase:ase-task-edit", args: "<args/>")`
            to invoke the `ase:ase-task-edit` skill in order to *edit*
            the updated plan. Immediately stop processing the current
            skill once the `Skill` tool was used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan updated -- hand-off to edit**
            </template>

        -   If <result/> is `PREFLIGHT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            `Skill(skill: "ase:ase-task-preflight", args: "<args/>")` tool
            to *apply* the plan.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan updated -- hand-off to pre-flight**
            </template>

        -   If <result/> is `IMPLEMENT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            `Skill(skill: "ase:ase-task-implement", args: "<args/>")` tool
            to *apply* the plan.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan updated -- hand-off to implementation**
            </template>
