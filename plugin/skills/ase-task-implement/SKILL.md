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

    3.  <if condition="the backmatter of <task-content/> contains an attachment
            block with the `Type` key value `text/x-diff; charset=utf-8; kind="preflight"`
            which is *stale* according to the plan <format/> (its `Modified` key
            is absent or older than the `Modified` key of the frontmatter)">
        The implementation draft was created for an *earlier* version of
        the plan, so taking it over *1:1* would implement the wrong plan,
        while silently ignoring it would discard the user's review. Only
        output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the plan and the
        artifacts *untouched*:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: implementation draft attachment is **stale** (older than the plan) -- run `/ase-task-preflight` again or remove the attachment
        </template>
        </if>

    4.  Internalize the tenets stated by the plan:

        <expand name="code-tenets-from-plan"></expand>

3.  **Prepare Branch and WorkTree:**

    The *branch* the change set lands on is controlled *exclusively*
    by the `Branch:` frontmatter key of the plan, while the *working
    copy* it lands in -- the current one or an isolated worktree -- is
    controlled *exclusively* by the `--worktree` option. Both are
    orthogonal, except that Git cannot check out the already
    checked-out branch a second time in a worktree.

    1.  Determine the *target branch* <target-branch/>: Set
        <task-branch/> to the value of the `Branch:` frontmatter key of
        <task-content/>, or to the literal `current` if the key is
        absent. Determine the *checked-out branch* by running the
        command `git branch --show-current` (taken exactly as given)
        and capturing its output into <current-branch/>. If
        <task-branch/> is `current` or equal to <current-branch/>, set
        <target-branch></target-branch> (empty: the change set lands
        on the checked-out branch); otherwise set
        <target-branch><task-branch/></target-branch>. Do not output
        anything.

    2.  <if condition="<getopt-option-worktree/> is not equal `true` and <target-branch/> is empty">
        The change set lands on the checked-out branch of the *current*
        working copy. Set <worktree-dir></worktree-dir> and
        <worktree-branch></worktree-branch> (both empty) and *skip* all
        remaining sub-steps of this step. Do not output anything.
        </if>

    3.  <if condition="<getopt-option-worktree/> is not equal `true` and <target-branch/> is not empty">
        The change set lands on a *different* branch inside the
        *current* working copy, so the working copy is *switched* to
        <target-branch/> in place. Set <worktree-dir></worktree-dir>
        and <worktree-branch></worktree-branch> (both empty).

        1.  Determine the *uncommitted changes* by running the command
            `git status --porcelain` (taken exactly as given) and
            capturing its output. If the output is *not* empty, the
            working copy is *dirty* and switching would drag the
            uncommitted changes onto the other branch. Only output the
            following <template/> and then immediately *STOP*
            processing the entire current skill, leaving the working
            copy *untouched*:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: working copy has uncommitted changes -- cannot switch to branch **<target-branch/>** in place
            </template>

            Directly *after* this error <template/>, and *before*
            stopping, give the corrective hint by expanding the
            following (which, depending on the configured
            <ase-guidance-level/>, may expand into nothing and hence
            emit no output at all):

            <ase-tpl-hint level="minimal">
            Commit or stash the uncommitted changes first, or use `--worktree` to implement inside an isolated worktree instead.
            </ase-tpl-hint>

        2.  Determine the *existing branches* by running the command
            `git branch --list` (taken exactly as given) and capturing
            its output. If the branch <target-branch/> already exists,
            switch to it by running the command
            `git switch "<target-branch/>"`, otherwise create it from
            `HEAD` and switch to it by running the command
            `git switch -c "<target-branch/>"` (each taken exactly as
            given). If the command fails, only output the following
            <template/> and then immediately *STOP* processing the
            entire current skill, leaving the working copy *untouched*:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: branch **<target-branch/>** failed to switch
            </template>

        3.  Only output the following <template/> and then *skip* all
            remaining sub-steps of this step:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⎇ branch: **<target-branch/>**, ▶ status: **branch switched**
            </template>
        </if>

    4.  Determine the *worktree branch* <worktree-branch/>: Set
        <worktree-branch><target-branch/></worktree-branch> if
        <target-branch/> is not empty. Otherwise set
        <worktree-branch><ase-task-id/></worktree-branch>, as the
        checked-out branch cannot be checked out a second time in the
        worktree: the *implied* branch carries the unique *task id*, so
        it stays unambiguously tied to the very task plan implemented
        on it, and is recorded in the plan's `Branch:` key on save. Do
        not output anything.

    5.  Set <worktree-name><ase-task-id/></worktree-name>. The worktree
        *directory* always carries the unique *task id* -- a plain
        identifier by construction and hence directly usable as a
        directory name --, independent of the branch checked out in it.
        Do not output anything.

    6.  Determine the *worktree directory* by calling the
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

    7.  Determine the *existing worktrees* and *existing branches* by
        running the corresponding commands (taken exactly as given) and
        capturing their outputs:

        `git worktree list --porcelain`

        `git branch --list`

        <if condition="the branch <worktree-branch/> already exists">
        The branch already *exists*, so it is *checked out* into the
        worktree instead of being created. Set
        <worktree-add-args>"<worktree-dir/>" "<worktree-branch/>"</worktree-add-args>.
        Do not output anything.
        </if>
        <else>
        The branch is *created* from `HEAD` together with the worktree.
        Set <worktree-add-args>-b "<worktree-branch/>" "<worktree-dir/>"</worktree-add-args>.
        Do not output anything.
        </else>

        <if condition="the worktree directory <worktree-dir/> already exists">
        Only output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the existing
        worktree and the working copy *untouched*:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: worktree **<worktree-name/>** already exists
        </template>

        Directly *after* this error <template/>, and *before* stopping,
        give the corrective hint by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may expand
        into nothing and hence emit no output at all):

        <ase-tpl-hint level="minimal">
        Remove the existing worktree via `git worktree remove`, or rename the task via `/ase-task-rename` to implement it under a still unused worktree name.
        </ase-tpl-hint>
        </if>

    8.  Create the worktree by running the corresponding command (taken
        exactly as given), which creates the directory <worktree-dir/>
        with the branch <worktree-branch/> checked out. The `.ase`
        directory is usually git-ignored, so the worktree itself never
        shows up as a change:

        `git worktree add <worktree-add-args/>`

        <if condition="this command fails">
        Only output the following <template/> and then immediately *STOP*
        processing the entire current skill, leaving the working copy
        *untouched*:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: worktree **<worktree-name/>** failed to create
        </template>
        </if>

    9.  Only output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ◉ worktree: **.ase/worktree/<worktree-name/>**, ⎇ branch: **<worktree-branch/>**, ▶ status: **worktree created**
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

        <if condition="the backmatter of <task-content/> contains an attachment block with the `Type` key value `text/x-diff; charset=utf-8; kind="preflight"` (the implementation draft from skill `ase-task-preflight`)">
        Take over the implementation draft carried by the `Data` key of
        this attachment block *1:1* as the change set: the draft is
        assumed to have been *reviewed* by the user, so you *MUST* *NOT*
        create a fresh implementation from scratch. Apply the draft
        *verbatim* and *adjust* only those parts which actually *fail*
        -- because a hunk no longer applies to meanwhile drifted
        artifacts, or because the verification phase rejects the result.
        For such adjusted parts, and for aspects the draft does not cover
        at all, follow the task plan in <task-content/>.
        </if>

        <if condition="the backmatter of <task-content/> contains NO attachment block with the `Type` key value `text/x-diff; charset=utf-8; kind="preflight"`">
        Follow and honor the task plan in <task-content/>.
        </if>

        You *MUST* *skip* every bullet-point of <task-content/> in
        checkbox state `[-]` (cancelled) or `[>]` (deferred): neither
        realize its <text/> in the change set nor perform its check, and
        do *not* count it against the completeness of the change set.
        Its <text/> stays *context only*, e.g. to understand the other
        bullet-points.

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

        <if condition="<task-content/> does NOT contain a `##  VERIFICATION (WHEN)` section heading">
        The task plan deliberately *omits* the `##  VERIFICATION (WHEN)`
        section. You *MUST* therefore *strictly skip* the entire
        verification phase after modifying the source files: do *NOT*
        run any build, do *NOT* run any tests, do *NOT* run any linter,
        do *NOT* run any type-checker, do *NOT* execute the modified
        program, and do *NOT* otherwise verify the change set in any
        way.
        </if>

    2.  Update the checkboxes of the body bullet-points of <task-content/>
        as follows, changing *nothing else* of a bullet-point:

        -   Set the checkbox of every `DOM`, `IFC`, `ARC`, and `IMP`
            bullet-point to `[x]` whose <text/> was *fully* realized by
            the change set, and to `[/]` whose <text/> was realized only
            *partially*. Leave the checkbox of every other bullet-point
            *untouched*.

        -   Set the checkbox of every `REG` and `CON` bullet-point to `[x]`
            whose check was actually performed *and* succeeded, and to
            `[/]` whose check was performed but succeeded only *partially*.
            Leave the checkbox of every other bullet-point *untouched* --
            hence *all* of them for a plan whose `##  VERIFICATION (WHEN)`
            section is deliberately omitted.

        -   Leave the checkbox of every skipped `[-]` and `[>]`
            bullet-point *untouched*, as only the user resolves its
            cancelled or deferred state.

    3.  Update the frontmatter of <task-content/> as follows, *creating*
        each of the `Status:`, `Modified:`, and `Branch:` keys the plan
        does not carry yet at its position in the key order of the plan
        <format/>:

        -   Set the `Status:` key to the *implemented* state of the task
            lifecycle model <ase-project-task-lifecycle/> (`CLOSED` for
            the `solo` model, `IMPLEMENTED` for the `team` and
            `enterprise` models), but *only* if the change set was
            applied *completely* and *successfully* (with the skipped
            `[-]` and `[>]` bullet-points not counting) -- this traverses
            the transitions of the state machine from the current state
            up to the implemented state in one go (for the `solo` model
            directly from the initial `OPEN` state, for the `team` model
            from the initial `PLANNING` state via `IMPLEMENTING`, for
            the `enterprise` model from the initial `DRAFTED` state via
            `PLANNING`, `PLANNED`, and `IMPLEMENTING`). Otherwise leave
            the `Status:` key *untouched*, as an incomplete run
            transitioned nowhere.

        -   Refresh the `Modified:` key with the current time in
            ISO-style format, determined by calling the
            `ase_timestamp(format: "yyyy-LL-dd HH:mm")` tool of the `ase`
            MCP server, but *only* if step 2 changed at least one
            checkbox, as the key tracks "body" changes only -- a
            frontmatter-only update leaves it *untouched*. If the
            draft attachment (the block with the `Type` key value
            `text/x-diff; charset=utf-8; kind="preflight"`) was
            consumed, set its `Modified:` key to the very same value
            (*creating* the key at its position in the key order of the
            plan <format/> if the block does not carry it yet), so the
            consumed draft never falls behind the plan it was applied
            to.

        -   Set the `Branch:` key to <worktree-branch/> if it is not
            empty and differs from <task-branch/>, i.e. if `--worktree`
            *implied* the task-id branch, so the plan records the branch
            the change set actually landed on. Otherwise leave the
            `Branch:` key *untouched*.

        Apart from the checkboxes, the frontmatter keys, and the
        `Modified:` key of the consumed draft attachment above, the plan
        *MUST* stay *exactly* as loaded -- in particular, the
        "backmatter" with its attachment blocks is otherwise passed
        through *verbatim*.

        Finally call the `ase_task_save(id: "<ase-task-id/>", text:
        "<task-content/>")` tool of the `ase` MCP server to persist the
        updated task plan. This `ase_task_save` MCP tool call is the
        *only* permitted way to persist the plan -- *NEVER* write the
        plan file via `Write`/`Edit` or by executing a shell command.
        Do not output anything in this sub-step.

    4.  Only output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **plan implemented**
        </template>

    5.  <if condition="<worktree-dir/> is not empty">
        Give the closing hint by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may expand
        into nothing and hence emit no output at all):

        <ase-tpl-hint level="minimal">
        The change set is uncommitted in `.ase/worktree/<worktree-name/>` on branch `<worktree-branch/>` -- review and commit it there, then remove the worktree via `git worktree remove`.
        </ase-tpl-hint>
        </if>
        <elseif condition="<target-branch/> is not empty">
        Give the closing hint by expanding the following (which,
        depending on the configured <ase-guidance-level/>, may expand
        into nothing and hence emit no output at all):

        <ase-tpl-hint level="minimal">
        The change set is uncommitted on branch `<target-branch/>`, which is now checked out in the working copy -- review and commit it there.
        </ase-tpl-hint>
        </elseif>

    </if>

    <if condition="<mode/> is `steps`">

    1.  **Derive Step List:**

        <if condition="
            <task-content/> does NOT contain a `##  IMPLEMENTATION STEPS`
            section heading
        ">

        1.  *Restructure* the task plan in <task-content/> into <m/> small,
            self-contained, individually verifiable *increments*, each
            the *smallest landable unit*: one reviewable diff (about
            one class or one feature cut) bundling the code belonging
            together plus its corresponding test, ending "compiles +
            tests green + report" -- *never* "all files at once".
            Respect the dependency order, but the plan order is no
            dogma: sensible restructuring is encouraged. Where the
            plan calls for them, use the two special increment
            *types*: `[measure]` probes whose *measured* result
            decides whether a dependent increment is built or
            cancelled, and `[live]` verifications where the *user*
            runs the application and reports logs/screenshots back
            (their diagnosis loops belong to the increment). Like in
            `all` mode, the plan text in <task-content/> always overrules
            the optional `IMPLEMENTATION DRAFT` hints.

            Do not output anything in this step.

        2.  *Persist* the step list (critical: progress *MUST* survive
            discussion pauses and session restarts): append the
            following new section to the plan in <task-content/> and call
            the `ase_task_save(id: "<ase-task-id/>", text: "<task-content/>")`
            tool of the `ase` MCP server to save the updated plan:

            <format>
            ##  IMPLEMENTATION STEPS

            -   **BASELINE**: pre-existing failures: <list, or `none`>

            - [ ] 1. <step-title-1/> -- <one-sentence scope>
            - [ ] 2. [measure] <step-title-2/> -- <one-sentence scope>
            </format>

            The **BASELINE** bullet names the build/test failures
            existing *before* the first increment (extend it when
            verification reveals further pre-existing ones); the
            optional `[measure]`/`[live]` tag marks the increment type.

            Do not output anything in this step.

        3.  Only output the following <template/> (with one trailing
            line per step):

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ✪ plan: **<words/>** words, ▶ status: **restructured into <m/> review-ready steps**
            ➤ <n/>. <step-title-n/>
            </template>

        </if>

    2.  **Implementation Loop:**

        The loop is a *contract*, not a schedule -- four rules bind
        *every* iteration:

        -   *One increment at a time*: *never* implement past the
            next review gate, however trivial the next increment
            seems.

        -   *Implementing is the default*: the gate reviews *results*
            and never re-asks permission to implement; ask separately
            only on genuine *scope changes*.

        -   *Git remains with the user*: *never* commit, and stage
            only when the user explicitly chooses `STAGE` at a review
            gate -- otherwise leave *all* changes unstaged for the
            user to review, stage, and commit.

        -   *Resequencing is allowed, silence is not*: when contact
            with the code shows an increment is mis-cut or mis-ordered,
            reorder/split/merge the step list and record the
            rationale as an indented note below the affected item
            (e.g. "moved after step 7, because ...") via
            `ase_task_save`. Deferred work *MUST* name its target
            increment.

        Set <m/> to the total number of checkbox items of the
        `##  IMPLEMENTATION STEPS` section in <task-content/>.
        For each still *open* increment <n/> (checkbox `- [ ]`, in
        ascending order), perform the following sub-items:

        1.  *Implement* only increment <n/> by modifying the
            corresponding *artifacts*.

            <if condition="<task-content/> contains a `##  VERIFICATION` section heading">
            Verify the increment according to the `##  VERIFICATION`
            section, as far as applicable, matching the increment
            *type*: unit tests for behavior, architecture/structure
            tests for structural increments, the recorded measurement
            for `[measure]`, the user-reported evidence for `[live]`.
            Also check *harness realism*: does the harness reflect
            the live conditions (advancing clock, concurrency,
            reconnects)?
            </if>
            <else>
            The task plan deliberately *omits* the `##  VERIFICATION`
            section: *strictly skip* the entire verification phase,
            exactly as specified for `all` mode above (no build, no
            tests, no linter, no type-checker, no program execution,
            no other verification).
            </else>

            Then *compose* the <step-summary/> of increment <n/>:
            2-5 bullet lines telling what was changed (functionally,
            not as a file list), the affected artifacts, the
            verification result (e.g. "tests 12/12 green" or
            "verification skipped per plan"), and any *findings* worth
            remembering (including deferred work with its named target
            increment).

            <if condition="increment <n/> is a `[measure]` increment">
            The measured result *gates* the dependent increments: mark
            a cancelled increment's checkbox as `- [x]`, strike its
            title through (`~~...~~`), and record the measured
            rationale as an indented note below it.
            </if>

            Then set the checkbox of increment <n/> to `- [x]` in
            <task-content/>, insert the <step-summary/> as indented bullet
            lines directly below it, and call the `ase_task_save(id:
            "<ase-task-id/>", text: "<task-content/>")` tool of the `ase`
            MCP server again to persist progress and summary.

            Do not output anything in this step.

        2.  Only output the following *step report* <template/>, where
            the table lists the changed *production* files (one row
            per file), <status/> is `A` (added), `M` (modified), or
            `D` (deleted), <what/> is a one-clause change description,
            and <verdict/> is the verification result:

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ➤ step: **<n/>/<m/>** -- **<step-title-n/>**, ▶ status: **step implemented**

            | Status    | File      | What    |
            | --------- | --------- | ------- |
            | <status/> | `<file/>` | <what/> |

            ● **Tests**: <tests added/changed and their result, or `none`>
            ● **Verification**: <verdict/> (pre-existing failures: <list, or `none`>)
            ● **Staging**: all changes left unstaged -- staging/committing remains with you
            </template>

        3.  <if condition="at least one increment is still open">
            *Review gate*: let the *user interactively choose* how to
            proceed.

            You *MUST* have output the step report <template/> of the
            previous sub-item as regular text *BEFORE* the dialog is
            shown -- it is the basis for the user's review decision.
            If it was not output yet, output it now.

            Set <step-gist/> to a one-line condensation (at most about
            25 words, no line breaks) of the just emitted step report,
            ending with the verification result.

            In the following, you *MUST* *NOT* use your built-in
            <user-dialog-tool/> tool! Instead, you *MUST* just show a
            custom dialog according to the expanded `custom-dialog`
            definition. You *MUST* closely follow this definition:

            <expand name="custom-dialog" arg1="--no-other">
                Step <n/>/<m/>: <step-gist/> -- How to proceed?
                CONTINUE: Implement the next step.
                STAGE: Stage this step's not-yet-staged files, then implement the next step.
                DISCUSS: Pause here; re-invoke ase-task-implement to resume.
                DONE: Stop and PRESERVE the plan including step progress.
            </expand>

            Check the tool <result/> and dispatch accordingly:

            -   If <result/> is `CONTINUE`:
                Continue the loop with the next open increment.

            -   If <result/> is `STAGE`:
                *Stage* exactly the files of increment <n/> (the step
                report's production files plus its test files) that
                are not already staged, via `git add <file/> [...]`
                (*never* `git add -A`), then continue the loop with
                the next open increment.

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

    3.  Once no increment is open anymore: *remove* the
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
