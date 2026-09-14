---
name: ase-task-grill
argument-hint: "[--help|-h] [--rounds|-r <n>] [--focus|-f <section>[,...]] [--next|-n <option>[,...]] [<id>]"
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
    arg2="--rounds|-r=1 --focus|-f=(all|SPECIFICATION|SPEC|DESIGN|DES|VERIFICATION|VER)... --next|-n=(none|DONE|EDIT|IMPLEMENT|PREFLIGHT)... --int-reuse-task">
    $ARGUMENTS
</expand>

<objective>
Interview the user relentlessly about every essential aspect of the
task plan until reaching a shared understanding.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-grill.md

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

    2.  If <getopt-option-rounds/> is not a positive integer,
        only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-task-grill**, ▶ ERROR: invalid `--rounds` value: **<getopt-option-rounds/>**
        </template>

    3.  Treat <getopt-option-focus/> as a comma-separated list of
        *section tokens*. Trim and upper-case every token, then expand
        the abbreviations `SPEC`, `DES`, and `VER` to `SPECIFICATION`,
        `DESIGN`, and `VERIFICATION`, and expand the sentinel `ALL`
        (the default) to `SPECIFICATION,DESIGN,VERIFICATION`. Set
        <sections/> to the resulting list, *keeping the given order*.
        The getopt parser validates only the *first* token, so you
        *MUST* validate each token yourself: if any token is *empty*,
        *not* one of the recognized sections or abbreviations, or
        results in a section already present in <sections/>, bind
        <token/> to that offending token, then only output the
        following <template/> and immediately *STOP* processing the
        entire current skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-task-grill**, ▶ ERROR: invalid `--focus` token: **<token/>**
        </template>

        Each section in <sections/> selects its *focus areas* of the
        grilling: `SPECIFICATION` selects `DOMAIN` and `INTERFACE`,
        `DESIGN` selects `ARCHITECTURE` and `IMPLEMENTATION`, and
        `VERIFICATION` selects `REGRESSION` and `CONFIRMATION`. Do not
        output anything.

    4.  React on task id:

        <expand name="task-react-id" arg1="ase-task-grill"></expand>

2.  **Determine Task Plan:**

    1.  Determine the current task plan content:

        <expand name="task-load-content"></expand>

    2.  <if condition="<task-content/> is empty">
        Complain and tell the user to use the `ase-code-resolve`,
        `ase-code-refactor`, `ase-code-craft`, or `ase-task-edit` skills
        first to create a task plan. Then immediately stop processing
        this skill.
        </if>

    3.  Determine the *grilling scope* of each section in <sections/>,
        in order to grill an *already grilled* section again *only* where
        questions are still *open*:

        -   If the `Tags:` frontmatter key of <task-content/> carries
            the tag `grilled:<section/>` (with <section/> being the
            *lower-case* name of the section) and the section contains
            *no* bullet-point in checkbox state `[?]`, the section is
            *already grilled* and nothing is open: *remove* it from
            <sections/> and only output the following <template/>:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **section <section/> already grilled -- skipped**
            </template>

        -   If the `Tags:` frontmatter key carries the tag
            `grilled:<section/>` and the section contains *at least one*
            bullet-point in checkbox state `[?]`, *restrict* the scope of
            the section to *exactly* these `[?]` bullet-points, so the
            grilling re-asks only the *still open* questions.

        -   Otherwise, the scope of the section is the *entire* section.

        Independent of the scope, bullet-points in checkbox state `[-]`
        (cancelled) or `[>]` (deferred) are *inert*: they are *never*
        subject of a question and their checkbox is *never* changed.

        <if condition="<sections/> is empty afterwards">
        Skip the entire step 3 below -- the plan is *neither* updated
        *nor* saved -- and continue directly with step 4.
        </if>

3.  **Iterate Over Task Plan Aspects:**

    1.  Understand what "grilling" is about:

        <expand name="grill-understanding" arg1="the task plan in <task-content/>"></expand>

    2.  Perform <getopt-option-rounds/> grilling *rounds*, numbered
        <m/> (1-<getopt-option-rounds/>). Each round starts *from
        scratch* from *only* the *current* <task-content/> -- as
        updated by all previous rounds -- and *forgets* all questions
        and answers gathered in previous rounds.

        For each round:

        1.  INITIALIZE ROUND:

            Set <round-id/> to `GRILLING ROUND <m/>/<getopt-option-rounds/>`
            if <getopt-option-rounds/> is greater than 1, or to
            `GRILLING` otherwise (a single round needs no round
            numbering). Then output only the following <template/>:

            <template>
            ⧉ **ASE**: <round-id/>: *Relentless Interviewing Until Clarity*
            </template>

        2.  DETERMINE QUESTIONS:

            Determine the essential aspects <aspect-N/> (a one- or
            two-word-long short identifier like `Foo` or `Bar-Baz`, also
            serving as the topic hint) and the corresponding, very brief
            but precise decision/question <question-N/> where a shared
            understanding is required. Each question is chosen to
            resolve the open points related to the above understanding
            of grilling, by focusing *only* on the *Focus Areas*
            selected by <sections/> -- the *themes* of the focused
            sections, *within* the *grilling scope* of each section as
            determined in step 2.3, while the *entire* <task-content/>
            stays the context -- and checking the mentioned *Indicators*.
            For a section restricted to its `[?]` bullet-points, derive
            the questions from *exactly* these bullet-points only. Never
            raise a question about a `[-]` or `[>]` bullet-point.

            For each question, set <items-N/> to the bullet-points of
            <task-content/> the question is about -- possibly *none*, if
            the question concerns an aspect the plan does not cover yet.

            For <question-N/> use the format `Shall...?` for
            questions of focus area `DOMAIN`, `INTERFACE`, `REGRESSION`,
            and `CONFIRMATION`, the format `Should...?` for questions of
            focus area `ARCHITECTURE`, and the format `May...?` for
            questions of focus area `IMPLEMENTATION`.

            In every <question-N/>, encode all *literal aspects*
            -- file and directory paths, identifiers, symbols, types,
            commands, options, configuration keys, and literal values --
            with backticks. Do not output anything.

        3.  DETERMINE CONTEXT:

            For each question, determine its focus area
            <context-N-focus/> from the mentioned *Focus Areas*.
            <context-N-severity/>, describing how important this
            question is.

        4.  SORT QUESTIONS:

            Create a decisions/questions tree for the questions,
            capturing the dependencies between the decisions. Then
            *sort* the questions *primarily* by the order of their
            sections in <sections/>, *secondarily*, within each section,
            by descending focus area order -- `DOMAIN` before
            `INTERFACE`, `ARCHITECTURE` before `IMPLEMENTATION`, and
            `REGRESSION` before `CONFIRMATION` --
            and *tertiarily*, within each focus area, by the decision
            tree order, so that each decision is asked *after* the
            decisions it depends on. Renumber <N/> according to this order,
            starting at `1` in *every* round, independent of the
            numbering of previous rounds. Truncate the list after a
            maximum of 10 questions and set <n/> to the number of
            remaining questions. Do not output anything.

        5.  For each question <question-N/> in the iteration cycle <N/>,
            *one at a time*:

            1.  Output the following <template/>:

                <template>
                <ase-tpl-bullet-signal/> ASPECT <N/>/<n/> ▶ **<context-N-focus/>** (<context-N-severity/>) ▷ **<aspect-N/>**
                </template>

            2.  Determine the answer alternatives:

                1.  Check the <task-content/> for the answer <answer-N-1/>,
                    which reflects the current plan.

                2.  Check the code base and your world knowledge and
                    use this information to find *up to three* grounded
                    alternative answers <answer-N-K/> (K={2,3,4}), so there
                    are between two and four answer options in total.

                3.  For each <answer-N-K/> (K={1,2,3,4}) determine
                    a 1-3 word label <answer-N-K-label/>, and an
                    ultra brief description <answer-N-K-description/>
                    of at most *10 words*. Prepend `⚑ ` to the
                    <answer-N-K-description/> which reflects the current
                    plan. Do not output anything.

            3.  In the following, you *MUST* *NOT* use your built-in
                <user-dialog-tool/> tool! Instead, you *MUST* just show a
                custom dialog according to the expanded `custom-dialog`
                definition. You *MUST* closely follow this definition.

                Let the user select the <answer-N/> out of the answer
                alternatives <answer-N-K/> by raising a question with the
                following custom dialog. Emit only the answer lines for
                the alternatives <answer-N-K/> you actually determined in
                the previous step (between two and four lines in total),
                followed by the fixed `SKIP GRILLING` answer option:

                <expand name="custom-dialog" arg1="--other">
                    <aspect-N/>: <question-N/>
                    <answer-N-1-label/>: <answer-N-1-description/>
                    <answer-N-2-label/>: <answer-N-2-description/>
                    [...]
                    SKIP GRILLING: skip all remaining grilling and continue with the plan update
                </expand>

                Check the <result/> and dispatch accordingly:

                -   If <result/> is `CANCEL`, only output the following
                    <template/> and then immediately *STOP* processing
                    the entire current skill, leaving the plan *untouched*:

                    <template>
                    ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **grilling stopped**
                    </template>

                -   If <result/> is `SKIP GRILLING`, ask no further
                    questions (the current question and all remaining
                    questions of this round stay *unanswered*),
                    continue with item 6 below (updating the plan with
                    the answers gathered so far), and after item 6 skip
                    all remaining rounds and continue with item 3.3
                    below.

                -   Otherwise, strip any leading `OTHER: ` prefix from
                    <result/> and set <answer-N/> to the remainder.

            4.  Output the following <template/>:

                <template>
                <ase-tpl-bullet-normal/> ASPECT <N/>/<n/> ▶ **<context-N-focus/>** (<context-N-severity/>) ▷ **<aspect-N/>**, ANSWER: **<answer-N/>**
                </template>

        6.  Update <task-content/> based on all answers <answer-N/>
            gathered in this round. Additionally, record the *open*
            questions in the checkboxes of the body bullet-points,
            changing *only* checkboxes in state `[ ]` or `[?]` and
            leaving every `[/]`, `[x]`, `[-]`, and `[>]` checkbox
            *untouched*:

            -   For each *answered* question, set the checkbox of every
                bullet-point in <items-N/> to `[ ]`, as the question is
                resolved now.

            -   For each *unanswered* question, set the checkbox of every
                bullet-point in <items-N/> to `[?]`, as the question is
                still open. If <items-N/> is *empty*, *add* a new `[?]`
                bullet-point to the section of the question's focus area
                <context-N-focus/>, with the corresponding <type/>, a
                <summary/> derived from <aspect-N/>, and a <text/>
                stating the open <question-N/>, so a later grilling can
                re-ask it.

            Do not output anything.

    3.  <if condition="the frontmatter of <task-content/> carries a `Created: <text/>` key">
        Set <timestamp-created><text/></timestamp-created> (set
        timestamp-created to extracted text).
        </if>

    4.  For each section in <sections/>, *set* the tag
        `grilled:<section/>` -- with <section/> being the *lower-case*
        name of the section (`specification`, `design`, or
        `verification`) -- in the `Tags:` frontmatter key of
        <task-content/>: keep an already present identical tag as is,
        otherwise append it, keeping all other already present tags
        (including `grilled:` tags of other sections) and *creating*
        the whole key at its position in the key order of the plan
        <format/> if the plan carries none. A fully grilled plan hence
        carries the tags `grilled:specification, grilled:design,
        grilled:verification`.

    5.  <expand name="task-save-content" arg1="plan updated"></expand>

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
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan updated -- done**
            </template>

        -   If <result/> is `EDIT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            tool `Skill(skill: "ase:ase-task-edit", args: "<args/>")`
            to invoke the `ase:ase-task-edit` skill in order to *edit*
            the updated plan. Immediately stop processing the current
            skill once the `Skill` tool was used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan updated -- hand-off to edit**
            </template>

        -   If <result/> is `PREFLIGHT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            `Skill(skill: "ase:ase-task-preflight", args: "<args/>")` tool
            to *apply* the plan.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan updated -- hand-off to pre-flight**
            </template>

        -   If <result/> is `IMPLEMENT`:
            <expand name="handoff-args"/>
            Only output the following <template/> and then call the
            `Skill(skill: "ase:ase-task-implement", args: "<args/>")` tool
            to *apply* the plan.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan updated -- hand-off to implementation**
            </template>
