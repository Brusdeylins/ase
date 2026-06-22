---
name: ase-task-implement
argument-hint: "[--help|-h] [--next|-n <option>[,...]] [--mode|-m all|steps] [--worktree|-w] [<id>]"
description: >
    Implement current or given task plan.
    Use when the user calls to "implement", "realize" or "apply" the
    "task", "plan", "spec", or "specification".
user-invocable: true
disable-model-invocation: false
effort: xhigh
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-dialog.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-task-implement">
Implement a Task Plan
</purpose>

<expand name="getopt"
    arg1="ase-task-implement"
    arg2="--next|-n=(none|DONE|DELETE)... --worktree|-w --int-reuse-task --mode|-m=(ask|all|steps)">
    $ARGUMENTS
</expand>

<objective>
*Implement* the task plan by modifying the *artifacts*
with a corresponding, complete *change set*.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-tenets.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-code.md

Procedure
---------

1.  **Determine Task:**

    1.  Set <instruction><getopt-arguments/></instruction> initially, with any
        leading and trailing whitespace stripped.
        Inherit the always existing <ase-task-id/> from the current context.
        Inherit the always existing <ase-session-id/> from the current context.
        Do not output anything.

    2.  React on task id:

        <expand name="task-react-id" arg1="ase-task-implement"></expand>

2.  **Determine Operation:**

    1.  Determine the current task plan content:

        <expand name="task-load-content"></expand>

    2.  If the <task-content/> is still empty, complain and tell the user to
        use the `ase-code-resolve`, `ase-code-refactor`, `ase-code-craft`,
        or `ase-task-edit` skills first to create a task plan. Then
        immediately stop processing this skill.

    3.  Internalize the tenets stated by the plan:

        <expand name="code-tenets-from-plan"></expand>

3.  **Prepare WorkTree:**

    <if condition="<getopt-option-worktree/> is not equal `true`">
    No worktree was requested, so the implementation is applied directly
    to the *current* working copy. Set <worktree-dir></worktree-dir>
    (empty) and *skip* all remaining sub-steps of this step. Do not
    output anything.
    </if>

    1.  Set <worktree-name><ase-task-id/></worktree-name>. The worktree
        is *never* named by its own option value: it always carries the
        unique *task id*, so the worktree directory and its branch stay
        unambiguously tied to the very task plan implemented in them.
        The task id is a plain identifier by construction, hence it is
        directly usable as both a directory and a branch name. Do not
        output anything.

    2.  Determine the *worktree directory* by calling the
        `ase_worktree_path(id: "<worktree-name/>", create: true)` tool of
        the `ase` MCP server and capturing its output into
        <worktree-dir/>.

        You *MUST* *NEVER* assemble this path yourself, as only this tool
        rejects a path leading through a symbolic link, through a
        non-directory, or out of the repository -- a path `git worktree
        add` would otherwise silently follow and thereby write outside
        the repository.

        <if condition="this tool call fails">
        Either the current directory is not a Git repository or the
        worktree directory is unsafe, so no worktree can be created. Only
        output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the working copy
        *untouched*:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-task-implement**, ▶ ERROR: no Git repository or unsafe worktree directory -- cannot create worktree
        </template>
        </if>

    3.  Determine the *existing worktrees* and *existing branches* by
        running the corresponding commands (taken exactly as given) and
        capturing their outputs:

        `git worktree list --porcelain`

        `git branch --list`

        <if condition="the worktree directory <worktree-dir/> or the branch <worktree-name/> already exists">
        Only output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the existing
        worktree, its branch, and the working copy *untouched*:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: worktree or branch **<worktree-name/>** already exists
        </template>

        Directly *after* this error <template/>, and *before* stopping,
        give the corrective hint by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may expand
        into nothing and hence emit no output at all):

        <ase-tpl-hint level="minimal">
        Remove the existing worktree via `git worktree remove` and `git branch -d`, or rename the task via `/ase-task-rename` to implement it under a still unused worktree name.
        </ase-tpl-hint>
        </if>

    4.  Create the worktree by running the corresponding command (taken
        exactly as given), which creates the directory *and* -- named
        after its last path component -- the branch <worktree-name/> from
        `HEAD`. The `.ase` directory is usually git-ignored, so the
        worktree itself never shows up as a change:

        `git worktree add "<worktree-dir/>"`

        <if condition="this command fails">
        Only output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the working copy
        *untouched*:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: worktree **<worktree-name/>** failed to create
        </template>
        </if>

    5.  Only output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ◉ worktree: **.ase/worktree/<worktree-name/>**, ▶ status: **worktree created**
        </template>

4.  **Determine Mode:**

    1.  <if condition="
            <task-content/> contains a `##  IMPLEMENTATION STEPS` section
            heading with at least one still open checkbox item (`- [ ]`)
        ">
        A previous `steps` mode run was interrupted (paused for
        discussion or ended with the session), so *resume* it: set
        <mode>steps</mode> *without* any user dialog, set <total/> to
        the total number of checkbox items and <open/> to the number
        of still open checkbox items (`- [ ]`) of this section, only
        output the following <template/>, and then directly continue
        with step 5 (the implementation loop):

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **resuming step mode (<open/>/<total/> steps open)**
        </template>
        </if>

    2.  <elseif condition="<getopt-option-mode/> is NOT equal to `ask`">
        Honor the pre-selected mode: set <mode><getopt-option-mode/></mode>.
        Do not output anything.
        </elseif>

    3.  <elseif condition="<ase-headless/> is `true`">
        No user dialog is possible in headless contexts, so default to
        the single-pass mode: set <mode>all</mode>.
        Do not output anything.
        </elseif>

    4.  <else>
        Let the *user interactively choose* the implementation mode.

        In the following, you *MUST* *NOT* use your built-in
        <user-dialog-tool/> tool! Instead, you *MUST* just show a
        custom dialog according to the expanded `custom-dialog`
        definition. You *MUST* closely follow this definition:

        <expand name="custom-dialog" arg1="--no-other">
            Mode: How should the plan be implemented?
            ALL: One complete change set in a single pass.
            STEPS: Small review-ready increments, pausing for review after each.
        </expand>

        Check the tool <result/> and dispatch accordingly:

        -   If <result/> is `ALL`:
            Set <mode>all</mode>.

        -   If <result/> is `STEPS`:
            Set <mode>steps</mode>.

        -   If <result/> is `CANCEL`:
            Only output the following <template/> and then immediately
            *STOP* processing the entire current skill:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **implementation cancelled**
            </template>
        </else>

5.  **Create Implementation:**

    <if condition="<mode/> is `all`">

    1.  Perform a *final implementation* of the task plan
        by modifying the *artifacts* with a corresponding, complete
        *change set*.

        <if condition="<task-content/> contains an `##  IMPLEMENTATION DRAFT` section (from skill `ase-task-preflight`)">
        Take over the implementation draft of this section *1:1* as
        the change set: the draft is assumed to have been *reviewed*
        by the user, so you *MUST* *NOT* create a fresh implementation
        from scratch. Apply the draft *verbatim* and *adjust* only
        those parts which actually *fail* -- because a hunk no longer
        applies to meanwhile drifted artifacts, or because the
        verification phase rejects the result. For such adjusted parts,
        and for aspects the draft does not cover at all, follow the
        task plan in <task-content/>.
        </if>

        <if condition="<task-content/> contains NO `##  IMPLEMENTATION DRAFT` section">
        Follow and honor the task plan in <task-content/>.
        </if>

        <if condition="<worktree-dir/> is not empty">
        The change set *MUST* land *exclusively inside* the worktree
        <worktree-dir/>: resolve *every* file path of the task plan
        relative to <worktree-dir/> instead of the original working copy,
        and run *every* verification command (build, tests, linter,
        type-checker, program execution) with <worktree-dir/> as its
        working directory. You *MUST* *NEVER* modify, stage, stash,
        revert, or commit anything *outside* of this worktree. Leave the
        worktree *uncommitted*: do *not* run `git add` and do *not* run
        `git commit`, so the user keeps full control over the final
        commit.
        </if>

        <if condition="<task-content/> does NOT contain a `##  VERIFICATION` section heading">
        The task plan deliberately *omits* the `##  VERIFICATION`
        section. You *MUST* therefore *strictly skip* the entire
        verification phase after modifying the source files: do *NOT*
        run any build, do *NOT* run any tests, do *NOT* run any linter,
        do *NOT* run any type-checker, do *NOT* execute the modified
        program, and do *NOT* otherwise verify the change set in any
        way.
        </if>

    2.  Update the frontmatter of <task-content/> as follows, *creating*
        each of the `Properties:`, `Status:`, and `Modified:` keys the
        plan does not carry yet at its position in the key order of the
        plan <format/>:

        -   *Add* the value `implemented` to the `Properties:` key if it
            is still absent, keeping all already present values.

        -   *Add* the value `verified` to the `Properties:` key as well,
            but *only* if the verification phase was actually performed
            and succeeded -- hence *never* for a plan whose
            `##  VERIFICATION` section is deliberately omitted.

        -   Set the `Status:` key to `COMPLETED`, but *only* if the
            change set was applied *completely* and *successfully* --
            this traverses the `approve`, `start`, and `complete`
            transitions of the state machine of the plan <format/> in one
            go, starting from the `DRAFTED` state which a freshly authored
            plan carries. Otherwise leave the `Status:` key *untouched*,
            as an incomplete run transitioned nowhere.

        -   Refresh the `Modified:` key with the current time in
            ISO-style format, determined by calling the
            `ase_timestamp(format: "yyyy-LL-dd HH:mm")` tool of the `ase`
            MCP server.

        Apart from the frontmatter keys above, the plan body *MUST* stay
        *exactly* as loaded.

        Finally call the `ase_task_save(id: "<ase-task-id/>", text:
        "<task-content/>")` tool of the `ase` MCP server to persist the
        updated task plan. This `ase_task_save` MCP tool call is the
        *only* permitted way to persist the plan -- *NEVER* write the
        plan file via `Write`/`Edit` or by executing a shell command.
        Do not output anything in this sub-step.

    3.  Only output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan implemented**
        </template>

    4.  <if condition="<worktree-dir/> is not empty">
        Give the closing hint by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may expand
        into nothing and hence emit no output at all):

        <ase-tpl-hint level="minimal">
        The change set is uncommitted in `.ase/worktree/<worktree-name/>` on branch `<worktree-name/>` -- review and commit it there, then remove the worktree via `git worktree remove`.
        </ase-tpl-hint>
        </if>

    </if>

    <if condition="<mode/> is `steps`">

    1.  **Derive Step List:**

        <if condition="
            <task-content/> does NOT contain a `##  IMPLEMENTATION STEPS`
            section heading
        ">

        1.  *Restructure* the task plan in <task-content/> into <m/> small,
            self-contained, individually verifiable *increments*: each
            increment bundles the code belonging together plus its
            corresponding test, is compilable/green on its own, and
            respects the dependency order between increments. A sensible
            restructuring of the plan is allowed and encouraged -- the
            plan order is no dogma. Sizing rule: one increment equals
            one reviewable diff (about one class or one feature cut),
            *never* "all files at once".

            Like in `all` mode, primarily follow and honor the task
            plan in <task-content/>, and secondarily derive hints from the
            optionally existing `IMPLEMENTATION DRAFT` section -- the
            specification text in <task-content/> always overrules the draft.

            Do not output anything in this step.

        2.  *Persist* the step list (critical: progress *MUST* survive
            discussion pauses and session restarts): append the
            following new section to the plan in <task-content/> and call
            the `ase_task_save(id: "<ase-task-id/>", text: "<task-content/>")`
            tool of the `ase` MCP server to save the updated plan:

            <format>
            ##  IMPLEMENTATION STEPS

            - [ ] 1. <step-title-1/> -- <one-sentence scope>
            - [ ] 2. <step-title-2/> -- <one-sentence scope>
            </format>

            Do not output anything in this step.

        3.  Only output the following <template/> (with one trailing
            line per step):

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **restructured into <m/> review-ready steps**
            ➤ <n/>. <step-title-n/>
            </template>

        </if>

    2.  **Implementation Loop:**

        Set <m/> to the total number of checkbox items of the
        `##  IMPLEMENTATION STEPS` section in <task-content/>.
        For each still *open* increment <n/> (checkbox `- [ ]`, in
        ascending order), perform the following sub-items:

        1.  *Implement* only increment <n/> by modifying the
            corresponding *artifacts*.

            <if condition="<task-content/> contains a `##  VERIFICATION` section heading">
            Verify the increment according to the `##  VERIFICATION`
            section, as far as applicable to this increment.
            </if>
            <else>
            The task plan deliberately *omits* the `##  VERIFICATION`
            section. You *MUST* therefore *strictly skip* the entire
            verification phase after modifying the source files: do *NOT*
            run any build, do *NOT* run any tests, do *NOT* run any linter,
            do *NOT* run any type-checker, do *NOT* execute the modified
            program, and do *NOT* otherwise verify the change set in any
            way.
            </else>

            Then *compose* the <step-summary/> of increment <n/>:
            2-5 bullet lines telling what was changed (functionally,
            not as a file list), which artifacts are affected, and the
            verification result (e.g. "tests 12/12 green" or
            "verification skipped per plan").

            Then set the checkbox of increment <n/> to `- [x]` in
            <task-content/>, insert the <step-summary/> as indented bullet
            lines directly below the checkbox item of increment <n/>,
            and call the `ase_task_save(id: "<ase-task-id/>",
            text: "<task-content/>")` tool of the `ase` MCP server again to
            persist both the progress and the summary.

            Do not output anything in this step.

        2.  Only output the following <template/>, where <step-summary/>
            is *verbatim* the just persisted step summary of increment
            <n/>:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ➤ step: **<n/>/<m/>** -- **<step-title-n/>**, ▶ status: **step implemented**
            <step-summary/>
            </template>

        3.  <if condition="increment <n/> is NOT the last increment <m/>">
            *Review gate*: let the *user interactively choose* how to
            proceed.

            You *MUST* have output the step summary <template/> of the
            previous sub-item as regular text *BEFORE* the dialog is
            shown -- *never* enter the review gate without it, as the
            step summary is the basis for the user's review decision.
            If it was not output yet, output it now.

            Set <step-gist/> to a one-line condensation (at most about
            25 words, no line breaks) of the <step-summary/> of
            increment <n/>, ending with the verification result.

            In the following, you *MUST* *NOT* use your built-in
            <user-dialog-tool/> tool! Instead, you *MUST* just show a
            custom dialog according to the expanded `custom-dialog`
            definition. You *MUST* closely follow this definition:

            <expand name="custom-dialog" arg1="--no-other">
                Step <n/>/<m/>: <step-gist/> -- How to proceed?
                CONTINUE: Implement the next step.
                DISCUSS: Pause here; re-invoke ase-task-implement to resume.
                DONE: Stop and PRESERVE the plan including step progress.
            </expand>

            Check the tool <result/> and dispatch accordingly:

            -   If <result/> is `CONTINUE`:
                Continue the loop with the next open increment.

            -   If <result/> is `DISCUSS` or `CANCEL`:
                Only output the following <template/> and then
                immediately *STOP* processing the entire current
                skill (the user discusses freely in the chat;
                re-invoking `ase-task-implement` later resumes at the
                first open increment):

                <template>
                ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ➤ step: **<n/>/<m/>**, ▶ status: **paused for discussion -- re-invoke ase-task-implement to resume**
                </template>

            -   If <result/> is `DONE`:
                Only output the following <template/> and then
                immediately *STOP* processing the entire current skill
                (the plan including the step progress is preserved):

                <template>
                ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ➤ step: **<n/>/<m/>**, ▶ status: **stopped -- plan and step progress preserved**
                </template>
            </if>

    3.  After the last increment <m/> was implemented: *remove* the
        entire `##  IMPLEMENTATION STEPS` section from the plan in
        <task-content/> again (the plan returns to its canonical format) and
        call the `ase_task_save(id: "<ase-task-id/>", text: "<task-content/>")`
        tool of the `ase` MCP server to save the updated plan.

        Only output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **plan implemented**
        </template>

    </if>

6.  **Decide Next Step:**

    1.  *Determine next step*:

        <expand name="task-next-select"
            arg1="ase-task-implement"
            arg2="DONE|DELETE">
            Next Step: How would you like to proceed with the plan?
            DONE: Stop processing and PRESERVE task plan.
            DELETE: Stop processing and DELETE the task plan.
        </expand>

    2.  Check the tool <result/> and dispatch accordingly:

        -   If <result/> is `DONE` or `CANCEL`:
            Only output the following <template/> and then *STOP*.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan implemented -- done**
            </template>

        -   If <result/> is `DELETE`:
            Set <args></args> (empty). Do *not* forward any remaining
            `--next` list tokens, because the `ase:ase-task-delete`
            skill accepts only an optional `[<id>]` argument and no
            `--next` option; remaining tokens are intentionally discarded.
            Only output the following <template/> and then call the
            tool `Skill(skill: "ase:ase-task-delete", args: "<args/>")`
            to invoke the `ase:ase-task-delete` skill in order to
            *delete* the updated plan. Immediately stop processing the
            current skill once the `Skill` tool was used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan implemented -- hand-off to delete task**
            </template>
