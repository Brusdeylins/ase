---
name: ase-code-edit
argument-hint: "[--help|-h] [--mode|-m auto|craft|refactor|resolve] [--grill|-g] [--grill-rounds|-r <n>] [--verify|-v] [--worktree|-w] [--loop|-l] [<query>|<issue-id>]"
description: >
    Edit Source Code: Use when the user wants to "edit" the code base in
    one shot from a query or a bare analyzer issue id like "P1", fusing
    crafting, refactoring, and resolving with optional grilling,
    verification, looping, and Git worktree isolation.
user-invocable: true
disable-model-invocation: false
effort: xhigh
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-dialog.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-code-edit">
Edit Source Code
</purpose>

<expand name="getopt"
    arg1="ase-code-edit"
    arg2="--mode|-m=(auto|craft|refactor|resolve) --grill|-g --grill-rounds|-r=1 --verify|-v --worktree|-w --loop|-l">
    $ARGUMENTS
</expand>

<objective>
*Edit* the code base directly from a query -- crafting, refactoring, or
resolving in one shot -- through the states *querying*, *discovering*,
*grilling*, *implementing*, and *verifying*.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-tenets.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-grill.md

Procedure
---------

This skill is *plan-less*: it *never* composes or persists a task plan
and *MUST* *NOT* call `ase_task_save(...)`. Instead, it applies the
requested edit *in place*, so the *implementing* state *requires* `Edit`
and `Write` to modify the affected artifacts. Every modification *MUST*
stay restricted to the artifacts the edit actually demands.

<define name="todo-box">

On finishing the state `<arg1/>`, only output the following <template/>,
which shows the established <todo-what/> and <todo-how/>, where a still
empty <todo-what/> or <todo-how/> renders as `(none)`:

<template>
<ase-tpl-head title="EDIT TODO" subtitle="<arg1/>"/>

**WHAT**: <todo-what/>

**HOW**:  <todo-how/>

<ase-tpl-foot title="EDIT TODO" subtitle="<arg1/>"/>
</template>

</define>

1.  **Initialize:**

    1.  Set <query><getopt-arguments/></query> (with any leading and
        trailing whitespace stripped), set <todo-what></todo-what> and
        <todo-how></todo-how> (both empty), and set
        <worktree-dir></worktree-dir> (empty). Do not output anything.

    2.  If <getopt-option-grill-rounds/> is not a positive integer,
        only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ ERROR: invalid `--grill-rounds` value: **<getopt-option-grill-rounds/>**
        </template>

2.  **Iterate:**

    Perform the states (1) *querying*, (2) *discovering*, (3) *grilling*,
    (4) *implementing*, and (5) *verifying* below as one *iteration*.
    Without `--loop` perform exactly *one* iteration. Under `--loop`
    *repeat* the iteration until the *querying* state receives a
    `STOP SKILL` result. Do not output anything in this item.

3.  **State: querying:**

    1.  <if condition="<query/> is empty">

        1.  In the following, you *MUST* *NOT* use your built-in
            <user-dialog-tool/> tool! Instead, you *MUST* just show a
            custom dialog according to the expanded `custom-dialog`
            definition. You *MUST* closely follow this definition. Its
            only answer option is the fixed `STOP SKILL`, so the user
            normally answers with the edit query in *one* free-text
            reply:

            <expand name="custom-dialog" arg1="--other">
                Edit Query: What is your edit query?
                STOP SKILL: stop the entire skill immediately
            </expand>

        2.  If <result/> is `STOP SKILL` or `CANCEL`, only output the
            following <template/> and then immediately *STOP* processing
            the entire current skill:

            <template>
            ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **editing finished**
            </template>

            Otherwise, strip any leading `OTHER: ` prefix from
            <result/> and set <query/> to the remainder.

        </if>

    2.  <if condition="<query/> matches the regexp `^([a-zA-Z][a-zA-Z0-9_]*-)?[PT]\d+$`">

        The <query/> is a bare issue identifier (like `P1`, `T1`, or
        `<prefix>-P1`) previously produced by `ase-code-analyze` or
        `ase-arch-analyze`. Set <issue-id><query/></issue-id> and call
        the `ase_kv_get(key: "ase-issue-<issue-id/>")` tool of the
        `ase` MCP server to retrieve the persisted problem description.
        If the returned `text` is non-empty, set <query><text/></query>
        and only output the following <template/>:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-edit**, ⇌ issue: **<issue-id/>**, ▶ status: **issue retrieved**
        </template>

        Otherwise, set <issue-id></issue-id> (empty) and only output the
        following <template/>, then, under `--loop`, continue with the
        *next* iteration at item 3.1 above, or, without `--loop`,
        immediately *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ ERROR: no analyzer result exists for issue **<query/>**
        </template>

        </if>

    3.  Convert the <query/> *fresh* into <todo-what/> -- the
        domain-specific, non-implementation-detail information -- and
        <todo-how/> -- the remaining information -- discarding all
        <todo-what/>/<todo-how/> content of any previous iteration.
        Without `--grill` you *MUST* *NOT* ask any clarifying questions
        and during later implementation just interpret the query best-effort.
        Do not output anything.

    4.  Expand the following:

        <expand name="todo-box" arg1="current state (after querying)"></expand>

    5.  Set <query></query> (clear the query, so every further `--loop`
        iteration asks for a fresh one). Do not output anything.

4.  **State: discovering:**

    Check the existing source files for all code which is related to
    <todo-what/> and <todo-how/>, and check the architecture of the
    existing code base to understand the overall structures and
    dynamics. Do not output anything in this state.

5.  **State: grilling:**

    Enter this state only if <getopt-option-grill/> is equal `true`;
    otherwise silently *skip* the entire state. Do not output anything
    about the skipping.

    1.  Understand what "grilling" is about:

        <expand name="grill-understanding" arg1="the edit query in <todo-what/> and <todo-how/>"></expand>

    2.  Perform <getopt-option-grill-rounds/> grilling *rounds*,
        numbered <m/> (1-<getopt-option-grill-rounds/>).

        For each round:

        1.  INITIALIZE TODO:

            Explicitly start *from scratch* from *only* the current
            <todo-what/> and <todo-how/> and *forget* all information
            gathered in previous rounds. Set <round-id/> to
            `GRILLING ROUND <m/>/<getopt-option-grill-rounds/>` if
            <getopt-option-grill-rounds/> is greater than 1, or to
            `GRILLING` otherwise (a single round needs no round
            numbering). Do not output anything.

        2.  DETERMINE QUESTIONS:

            Determine the questions, comprised of a round-local id
            <question-N-id/> of `Q<N/>` -- where <N/> restarts at `1`
            in *every* round, independent of the numbering of previous
            rounds --, and a very brief but precise question text
            <question-N-text/>. Each question is chosen to
            resolve the open points related to the above understanding
            of grilling, by focusing on the mentioned *Focus Areas*.

            For <question-N-text/> use the format `Shall...?` for
            questions of focus area `DOMAIN` and `INTERFACE`, the format
            `Should...?` for questions of focus area `ARCHITECTURE`,
            and the format `May...?` for questions of focus area
            `IMPLEMENTATION`.

            In every <question-N-text/>, encode all *literal aspects*
            -- file and directory paths, identifiers, symbols, types,
            commands, options, configuration keys, and literal values --
            with backticks.

            Keep every <question-N-text/> at most *200 characters* long
            -- compact the text until it fits --, as a longer question
            overflows its table cell and silently degrades the entire
            table into a plain text rendering.

        3.  DETERMINE CONTEXT:

            For each question, determine its focus area
            <context-N-focus/> from the mentioned *Focus Areas*, a 1-3
            word hint <context-N-topic/>, describing what the question
            is about, and a <context-N-severity/>, describing how
            important this question is.

            Set <context-N-id/> to `DOM` for <context-N-focus/> of
            `DOMAIN`, `IFC` for <context-N-focus/> of `INTERFACE`, `ARC`
            for <context-N-focus/> of `ARCHITECTURE`, and `IMP` for
            <context-N-focus/> of `IMPLEMENTATION`.

        4.  SORT QUESTIONS:

            Finally, *sort* the questions by descending focus area
            order -- first all `DOMAIN`, then all `INTERFACE`, then all
            `ARCHITECTURE`, and then all `IMPLEMENTATION` ones -- and
            renumber <N/> according to this order, starting at `1`.
            Truncate the list after a maximum of 10 questions and set
            <n/> to the number of remaining questions. Do not output
            anything.

            Finally, assemble the <question-N/> out of
            `**<question-N-id/>** ▶ **<context-N-id/>** ▷
            **<context-N-topic/>**: <question-N-text/>`.

        5.  DETERMINE ANSWERS:

            For all remaining <question-N/>, check the code base and
            your world knowledge to find *two to three* grounded answer
            alternatives <answer-N-K/> with a question-local id
            <answer-N-K-id/> of `A<K/>` -- where <K/> restarts at `1`
            for *every* question, independent of the numbering of other
            questions --, a 1-3 word label <answer-N-K-label/>, and
            an ultra brief description <answer-N-K-description/> of
            at most *10 words*. For the answer which reflects the
            current <todo-what/>/<todo-how/> understanding, append
            ` ⚑` to its <answer-N-K-label/>.

            Assemble an <answer-N/> out of `**<answer-N-1-id/>**
            ▶ **<answer-N-1-label/>**: <answer-N-1-description/>,
            **<answer-N-2-id/>** ▶ **<answer-N-2-label/>**:
            <answer-N-2-description/>[, ...]`.

            Keep every assembled <answer-N/> at most *240 characters*
            long -- drop the least relevant alternative and compact the
            descriptions until it fits -- as a longer answer overflows
            its table cell and silently degrades the entire table into a
            plain text rendering.

        6.  INTERACTIVE DIALOG:

            In the following, you *MUST* *NOT* use your built-in
            <user-dialog-tool/> tool! Instead, you *MUST* just show a
            custom dialog according to the expanded `custom-dialog`
            definition. You *MUST* closely follow this definition. The
            dialog below carries the two fixed answer options
            `SKIP GRILLING` and `STOP SKILL`, dispatched as follows:

            -   If a <result/> is `SKIP GRILLING` or `CANCEL`, ask no
                further questions, continue with item 7 below (merging
                the answers gathered so far), and after item 8 skip all
                remaining rounds and continue with the *implementing*
                state.

            -   If a <result/> is `STOP SKILL`, only output the
                following <template/> and then immediately *STOP*
                processing the entire current skill:

                <template>
                ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **editing stopped**
                </template>

            1.  Output only the following <template/> -- it lists *all*
                questions of the round up-front, one table row per
                aspect, so the subsequent dialog only has to ask for the
                combined answer. Align all column edges of the table.

                In every table cell you *MUST* escape each literal pipe
                character outside a code span as `\|` and you *MUST*
                open *and* close every backtick code span within the
                *same* cell -- an unescaped pipe or an unbalanced
                backtick run splits the cell and silently degrades the
                entire table into a plain text rendering:

                <template>
                ⧉ **ASE**: <round-id/>: *Relentless Interviewing Until Clarity*

                | QUESTION      | ANSWERS     |
                | ------------- | ----------- |
                | <question-1/> | <answer-1/> |
                | <question-2/> | <answer-2/> |
                | [...]         | [...]       |

                Legend: **DOM**: Domain (MUST), **IFC**: Interface (MUST), **ARC**: Architecture (SHOULD), **IMP**: Implementation (MAY)
                        **Qn**: round-local question id, **An**: question-local answer id, ⚑: current decision state
                </template>

            2.  Show a custom dialog. Its only answer options are the
                two fixed ones, so the user normally answers all aspects in
                *one* free-text reply:

                <expand name="custom-dialog" arg1="--other">
                    <round-id/>: What is your (combined) answer to all (or a subset) of the above questions? (keywords or `Qn:An` references are sufficient)
                    SKIP GRILLING: skip all remaining grilling and continue with the implementation
                    STOP SKILL: stop the entire skill immediately
                </expand>

                Dispatch `SKIP GRILLING`, `STOP SKILL`, and `CANCEL` as
                defined above. Otherwise, strip any leading `OTHER: `
                prefix from <result/> and treat the remainder as the
                combined free-text answers to all questions of the
                round.

        7.  MERGE ANSWERS INTO TODO:

            Merge all gathered answers in <result/> of the round -- the
            combined reply -- *exclusively* back into <todo-what/> and
            <todo-how/>. Do not output anything.

        8.  SHOW CURRENT TODO:

            Set <round-suffix/> to
            ` round <m/>/<getopt-option-grill-rounds/>` if
            <getopt-option-grill-rounds/> is greater than 1, or to
            empty otherwise, and expand the following -- this
            intentionally closes *every* round, so the intermediate
            <todo-what/>/<todo-how/> states stay visible:

            <expand name="todo-box" arg1="current state (after grilling<round-suffix/>)"></expand>

6.  **State: implementing:**

    1.  Determine the tenet(s) set to internalize:

        -   If <getopt-option-mode/> is `craft`, `refactor`, or
            `resolve`: Set <task-kind/> to `CRAFTING`, `REFACTORING`,
            or `RESOLVING` correspondingly.

        -   Else if <issue-id/> is not empty (`auto` with a retrieved
            analyzer issue): Set <task-kind/> to `RESOLVING`, as the
            edit fixes a reported problem.

        -   Else (`auto`): *Infer* the <task-kind/> from <todo-what/> and
            <todo-how/>: set to `RESOLVING` if the edit predominantly
            fixes a defect, set to `REFACTORING` if it predominantly
            re-structures existing artifacts without changing their
            observable behavior, and set to `CRAFTING` otherwise (also
            the default if the inference stays inconclusive).

        You *MUST* then first forget all previous internalized tenets
        and then freshly internalize and strictly honor the **GENERIC
        TENETS** and the **<task-kind/> TENETS** of the **ASE Tenets**
        in the following creation and updating of code. Do not output
        anything.

    2.  <if condition="<getopt-option-worktree/> is equal `true` and <worktree-dir/> is empty">

        One *single* worktree serves the whole skill run: it is created
        *once* before the first change set is applied, and all further
        `--loop` iterations land in it, too.

        1.  Set <worktree-name/> to a unique name, derived from
            <todo-what/>, which consists of two lower-case words
            concatenated with a `-` character. Do not output anything.

        2.  Determine the *worktree directory* by calling the
            `ase_worktree_path(id: "<worktree-name/>", create: true)`
            tool of the `ase` MCP server and capturing its output into
            <worktree-dir/>. You *MUST* *NEVER* assemble this path
            yourself. If this tool call fails, only output the following
            <template/> and then immediately *STOP* processing the
            entire current skill, leaving the working copy *untouched*:

            <template>
            ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ ERROR: no Git repository or unsafe worktree directory -- cannot create worktree
            </template>

        3.  Determine the *existing worktrees* and *existing branches*
            by running the commands `git worktree list --porcelain` and
            `git branch --list` (taken exactly as given) and capturing
            their outputs. If the worktree directory <worktree-dir/> or
            the branch <worktree-name/> already exists, only output the
            following <template/> and then immediately *STOP* processing
            the entire current skill, leaving the existing worktree, its
            branch, and the working copy *untouched*:

            <template>
            ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ ERROR: worktree or branch **<worktree-name/>** already exists
            </template>

        4.  Create the worktree by running the command
            `git worktree add "<worktree-dir/>"` (taken exactly as
            given), which creates the directory *and* -- named after its
            last path component -- the branch <worktree-name/> from
            `HEAD`. If this command fails, only output the following
            <template/> and then immediately *STOP* processing the
            entire current skill, leaving the working copy *untouched*:

            <template>
            ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ ERROR: worktree **<worktree-name/>** failed to create
            </template>

        5.  Only output the following <template/>:

            <template>
            ⧉ **ASE**: ✪ skill: **ase-code-edit**, ◉ worktree: **.ase/worktree/<worktree-name/>**, ▶ status: **worktree created**
            </template>

        </if>

    3.  Apply the edit by modifying the affected *artifacts* with a
        corresponding, complete *change set*, honoring *only*
        <todo-what/> and <todo-how/> plus the information gathered in
        the *discovering* state. Also, if a `CHANGELOG.md` file exists,
        make an appropriate entry there, too.

        <if condition="<worktree-dir/> is not empty">
        The change set *MUST* land *exclusively inside* the worktree
        <worktree-dir/>: resolve *every* file path relative to
        <worktree-dir/> instead of the original working copy. You *MUST*
        *NEVER* modify, stage, stash, revert, or commit anything
        *outside* of this worktree. Leave the worktree *uncommitted*:
        do *not* run `git add` and do *not* run `git commit`, so the
        user keeps full control over the final commit.
        </if>

    4.  <if condition="<issue-id/> is not empty">
        Call the `ase_kv_delete(key: "ase-issue-<issue-id/>")` tool of
        the `ase` MCP server to remove the now-resolved analyzer result
        from the key/value store, then set <issue-id></issue-id> (empty),
        so every further `--loop` iteration starts without an issue.
        Do not output anything.
        </if>

    5.  Output only the following <template/>. You *MUST* *NOT* output a
        change summary, a list of modified artifacts, a rationale, or a
        unified diff of the changes -- *independent* of
        <ase-project-boxing/>, whose exposure rules are explicitly
        *overridden* here:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **changes applied**
        </template>

7.  **State: verifying:**

    Enter this state only if <getopt-option-verify/> is equal `true`.
    Otherwise you *MUST* *strictly skip* the entire state and *any*
    verification: do *NOT* run any build, tests, linter, or
    type-checker, and do *NOT* execute the modified program.

    1.  Verify whether the implementation fulfills <todo-what/> and
        <todo-how/> by running available verification commands
        (build, tests, linter, type-checker)
        <if condition="<worktree-dir/> is not empty">
        , each with <worktree-dir/> as its working directory
        </if>.

        If the verification fails, you *MUST* *adjust* the failing parts
        of the change set and *RE-VERIFY* until the verification passes!

    2.  Only output the following <template/>:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **verification passed**
        </template>

8.  **Loop or Finish:**

    <if condition="<getopt-option-loop/> is equal `true`">
    Continue with the *next* iteration at the *querying* state
    (item 3 above). Do not output anything in this item.
    </if>
    <else>
    Finish the skill processing. Do not output anything in this item
    besides the skill identification chrome.
    </else>
