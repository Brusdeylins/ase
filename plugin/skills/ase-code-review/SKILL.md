---
name: ase-code-review
argument-hint: "[--help|-h] [<ref>]"
description: >
    Review uncommitted changes and curate them into clean commits
    grouped by theme: hunks are grouped, staged group by group,
    explained compactly, and committed only on the user's explicit
    accept. Use when the user wants to walk through unstaged/uncommitted
    changes step by step, get chunks staged and explained one at a time,
    accept ("abnehmen") changes chunk by chunk, or curate a change set
    into separate commits. Not for judging an existing staged diff --
    that is ase-meta-review.
user-invocable: true
disable-model-invocation: false
model: opus
effort: medium
allowed-tools:
    - "Skill"
    - "Agent"
    - "Bash(git diff:* | awk:* | head:*)"
    - "Bash(git diff:* | awk:* | tail:*)"
    - "Bash(git diff:* | awk:* | wc:*)"
    - "Bash(git diff:* | grep:* | head:*)"
    - "Bash(git diff:* | grep:* | wc:*)"
    - "Bash(git log:* | grep:* | head:*)"
    - "Bash(git log:* | awk:* | head:*)"
    - "Bash(cat:* | awk:* | head:*)"
    - "Bash(cat:* | grep:* | head:*)"
    - "Bash(awk '*)"
    - "Bash(awk \"*)"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-dialog.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<purpose name="ase-code-review">
Review and Curate Uncommitted Changes
</purpose>

<expand name="getopt"
    arg1="ase-code-review"
    arg2="">
    $ARGUMENTS
</expand>

<define name="user-dialog">
In the following, you *MUST* *NOT* use your built-in
<user-dialog-tool/> tool (e.g. `AskUserQuestion`) -- rendering a
native selection widget instead of the ASE dialog box is a *defect*.
Instead, you *MUST* show the boxed ASE custom dialog according to the
expanded `custom-dialog` definition, end your turn, and let the user
answer by typing. You *MUST* closely follow this definition.
Before rendering the dialog, determine from the current context the
single *recommended* answer option and prefix its description with
` ⚝ **RECOMMENDATION** ⚝ - `. Exactly *one* option carries the marker.
Unless stronger contextual evidence suggests otherwise, recommend:
curation strategy → `HORIZONTAL`; test handling → `REVIEW-TESTS`;
group table → `GROUPS-OK`; group decision → `ACCEPT` (but never while
a VERTICAL build is non-green); and on a *destructive* confirmation
always the non-destructive way out (`CANCEL`).
<expand name="custom-dialog" arg1="--other"><content/></expand>
Where the dispatch on <result/> below carries no explicit branch for a
result starting with `OTHER:`, treat such a result as `CANCEL`.
</define>

<objective>
Acting as an *expert-level software developer* who *reviews and
curates*, *group* the uncommitted changes at
<ref><getopt-arguments/></ref> (default: working tree + index +
untracked) into themes, let the user *confirm the grouping* from one
compact table, then *stage* one theme at a time into the plain Git
index -- no work branch, no stashing, no diff dumps, the user reviews
the staged lines in their own editor -- and *commit* only what the
user accepts. This skill *complements* its neighbours rather than
duplicating them: `ase-meta-diff` narrates *what changed*,
`ase-meta-review` renders a reviewer's *judgement*,
`ase-code-lint`/`ase-code-analyze` flag *quality/logic* problems, and
`ase-meta-commit` crafts the *message* -- this skill *curates and
commits*; it does *not* judge code quality.
</objective>

<flow>

1.  <step id="STEP 1: Ingest Surface">

    Build the *internal* hunk manifest of every uncommitted change:
    working tree, index, and untracked files. Run:

    -   `git status --porcelain`
    -   `git diff` (working tree vs. index)
    -   `git diff --staged` (index vs. HEAD)
    -   list untracked files (each treated as one add-hunk)

    Record per hunk: file, `+`/`-` line counts, kind (`add`, `modify`,
    `delete`, `rename`, `binary`). Renames are assigned atomically (no
    hunk-level split); binary hunks whole-file. For fine-grained
    separation within a single file, regenerate the diff with
    `git diff --unified=0`.

    This manifest is *working state only* -- do *not* output it. If the
    surface is empty, only output the following <template/> and then
    immediately *STOP* processing the entire current skill:

    <template>
    ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **no uncommitted changes -- nothing to review**
    </template>

    </step>

2.  <step id="STEP 2: Choose Strategy and Test Handling">

    Let the *user interactively choose* the curation strategy. It
    decides only whether a per-group *build* gates the accept -- the
    build is otherwise skipped entirely:

    <expand name="user-dialog">
        Curation Strategy: How should the changes be curated?
        HORIZONTAL: Theme-near groups; no build runs during the review.
        VERTICAL: Build-verified slices — every accepted group must build green.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **review cancelled**
        </template>
        </if>

    -   <if condition="<result/> is `VERTICAL`">
        Set <review-mode>VERTICAL</review-mode>.
        </if>

    -   <else>
        Set <review-mode>HORIZONTAL</review-mode>.
        </else>

    Then let the *user interactively choose* how *test* changes are
    handled:

    <expand name="user-dialog">
        Test Handling: Should test changes be reviewed like everything else?
        REVIEW-TESTS: Tests join their groups and are reviewed alongside the code.
        TESTS-LAST: Keep tests out of the groups and stage them at the end as one block.
    </expand>

    Dispatch on the tool <result/>: set <test-mode>TESTS-LAST</test-mode>
    on `TESTS-LAST`, otherwise (including `CANCEL`) set
    <test-mode>REVIEW-TESTS</test-mode>.

    Hints:

    -   In *VERTICAL* mode each group is cut as a *build-safe vertical
        slice* (interface + implementation + caller) and STEP 5 runs
        the project build before the accept, *gating* it. Note that
        the build runs on the *full working tree* (nothing is stashed
        away), so unaccepted changes participate in it.
    -   In *HORIZONTAL* mode groups are cut by *topical/architectural
        proximity* and *no* build is run at all.
    -   With <test-mode/> `TESTS-LAST`, every hunk in a test file (test
        directories like `src/test/`, `tests/`, `__tests__/`, and
        test-named files like `*Test.java`, `*.spec.ts`, `*_test.go`)
        goes into one dedicated final group `UPDATE(test): accompanying
        tests`, always ordered *last*.

    </step>

3.  <step id="STEP 3: Group Hunks into Themes">

    *Internally* propose 3-5 *themes* (commit groups) spanning the
    full change surface, using the taxonomy shared with
    `ase-meta-commit` and `ase-meta-diff` (FEATURE, BUGFIX, REFACTOR,
    UPDATE, CLEANUP, IMPROVEMENT), and map *every* hunk to exactly one
    theme. Do not output anything in this step.

    Hints:

    -   Derive themes from filenames, directory prefixes, and diff
        summaries; honor <review-mode/> (build-safe slices vs. topical
        proximity) and <test-mode/> (dedicated final test group).
    -   A hunk that fits no theme goes into a final `CLEANUP(misc)`
        catch-all group; a hunk bridging two themes is split at the
        patch-text level into two independent hunk headers
        (`@@ -<from>,<n> +<to>,<m> @@`) covering disjoint ranges, as a
        single git-level hunk cannot be staged partially.
    -   Order the themes as a *comprehension* order: every theme may
        build only on concepts the user has already accepted --
        foundations (types, interfaces, utilities) before the code
        depending on them, so the reviewer's mental model grows
        monotonically and never meets a forward reference. In
        *VERTICAL* mode this order is additionally *topological*, so
        each slice builds given the previously accepted ones. A
        `TESTS-LAST` test group always comes last.

    </step>

4.  <step id="STEP 4: Confirm the Grouping">

    Present the grouping as *one compact table* -- nothing else -- so
    the user can judge whether the cut fits:

    <template>
    <ase-tpl-bullet-normal/> **GROUPS** (<group-count/> groups, <review-mode/>, <test-mode/>)

    | G#    | Theme                           | Files         | +Lines    | -Lines       |
    |-------|---------------------------------|---------------|-----------|--------------|
    | G<n/> | <type/>(<scope/>): <one-liner/> | <file-count/> | +<added/> | -<removed/>  |
    </template>

    Then let the *user interactively choose*:

    <expand name="user-dialog">
        Groups: Does this grouping fit?
        GROUPS-OK: Accept the groups and start the per-group review.
        REGROUP: Recut the groups; describe how (merge, split, move files).
        SHOW-FILES: List the files of each group first.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the review-cancelled <template/> of STEP 2 and then
        immediately *STOP* processing the entire current skill.
        </if>

    -   <if condition="<result/> is `REGROUP` or starts with `OTHER:`">
        Take the user's instruction (the free text, or ask for it),
        re-run STEP 3 honoring it, and re-enter this STEP 4.
        </if>

    -   <if condition="<result/> is `SHOW-FILES`">
        Emit one line per group `G<n/>: <file-list/>` (filenames only,
        comma-separated) and re-prompt this dialog.
        </if>

    -   <if condition="<result/> is `GROUPS-OK`">
        Record `<group-count/>` and continue with STEP 5.
        </if>

    </step>

5.  <step id="STEP 5: Per-Group Stage, Explain, Accept">

    Process the groups in table order. Four rules bind every
    iteration:

    -   *Index only*: staging happens exclusively in the plain Git
        index on the *current* branch -- no work branch, no
        `git stash`, no working-tree mutation. The user's editor keeps
        showing staged changes and remaining unstaged changes side by
        side at all times.
    -   *No diff dumps*: never render diffs unprompted -- the user
        reviews the staged lines in their editor. Explanations are
        prose, not patches.
    -   *Git remains with the user beyond the accept*: `ACCEPT` is the
        only operation that commits, and nothing here ever discards
        working-tree content.
    -   *One group at a time*: never stage past the current group.

    For each group G<n/>:

    5.1. *Stage* exactly this group's hunks: `git add <file>` for
         whole-file hunks and `git apply --cached <patch-subset>` for
         partial files. Verify with `git diff --staged --name-only`
         that the staged set equals the group's planned file set; on a
         mismatch run `git reset`, report the mismatch, and re-enter
         STEP 4.

    5.2. <if condition="<review-mode/> is `VERTICAL`">
         *Build-verify*: discover the build command from `AGENTS.md`,
         `CLAUDE.md`, `package.json` scripts, `Makefile`, or
         language-idiomatic defaults (ask via a dialog only when
         ambiguous), run it, and record `<build-line/>` as
         `` `<command/>` — exit <exit-code/> `` plus a 1-3 line error
         excerpt on failure. A non-green build *withholds* `ACCEPT`.
         </if>
         <else>
         Set <build-line/> to `skipped (horizontal mode)`. Do *not*
         run any build, test, or linter.
         </else>

    5.3. Emit the *group card* -- a compact explanation, no diff:

         <template>
         <ase-tpl-bullet-secondary/> **GROUP G<n/>/<group-count/>** · <type/>(<scope/>): <one-liner/>

         *Why*: <rationale/>

         *Staged files*:
         <staged-file-lines/>

         *Build*: <build-line/>
         </template>

         Hints:

         -   `<rationale/>` is 2-4 sentences reconstructing the goal
             this group addresses -- what problem, what outcome, what
             design choice.
         -   `<staged-file-lines/>` is one bullet per file:
             `- <filepath> (+<a>/-<r>) — <one-sentence role in this group>`.
         -   Review the staged lines themselves in the editor
             (VSCode Source Control shows exactly this group as
             "Staged Changes").

    5.4. Let the *user interactively choose* (omit `ACCEPT` while a
         VERTICAL build is non-green, and offer `RETRY-BUILD` only
         then):

         <expand name="user-dialog">
             Group G<n/>/<group-count/>: What should happen with this group?
             ACCEPT: Commit the staged group on the current branch.
             DISCUSS: Ask a question about this group.
             SKIP: Unstage this group and move it to the end of the queue.
             REGROUP: Unstage and recut the remaining groups.
             RETRY-BUILD: Re-run the build without changes.
         </expand>

         Dispatch on the tool <result/>:

         -   <if condition="<result/> is `ACCEPT`">
             Invoke `Skill(skill: "ase:ase-meta-commit")` to craft the
             commit message, then `git commit` (the index carries
             exactly this group). The group leaves the queue; continue
             with the next group at 5.1.
             </if>

         -   <if condition="<result/> is `DISCUSS` or starts with `OTHER:`">
             Answer the question (or react to the instruction) scoped
             to this group -- review dialogue only, no code editing --
             then re-prompt this dialog. A correction wish is *out of
             scope*: point to `ase-code-edit`/`ase-code-resolve`, to be
             run after the review.
             </if>

         -   <if condition="<result/> is `SKIP`">
             `git reset` (the group's changes return to the unstaged
             set, the working tree is untouched). Move the group to
             the *end* of the queue; when every remaining group is
             skipped, leave the loop for STEP 6.
             </if>

         -   <if condition="<result/> is `REGROUP`">
             `git reset`, then re-run STEP 3 for all *not yet
             committed* hunks and re-enter STEP 4.
             </if>

         -   <if condition="<result/> is `RETRY-BUILD`">
             Re-run 5.2, then re-emit the group card and re-prompt.
             </if>

         -   <if condition="<result/> is `CANCEL`">
             `git reset`, then leave the loop for STEP 6 (already
             committed groups stay committed; everything else stays in
             the working tree).
             </if>

    </step>

6.  <step id="STEP 6: Final Summary">

    Emit a concise recap:

    <template>
    <ase-tpl-head title="ACCEPTANCE SUMMARY"/>

    <ase-tpl-bullet-secondary/> **ACCEPTANCE SUMMARY** (<review-mode/>)

    <commit-table/>

    *Left uncommitted*: <left-uncommitted/>

    <ase-tpl-foot/>
    </template>

    Hints:

    -   `<commit-table/>` columns: `G#`, `SHA`, `TYPE`, `SUBJECT`,
        `FILES`.
    -   `<left-uncommitted/>` is one bullet per skipped/cancelled
        group with its reason, or `none`.
    -   Do *not* propose further actions and do *not* touch
        `CHANGELOG.md` -- changelog updates belong to a release step,
        never to a review step.

    </step>

</flow>
