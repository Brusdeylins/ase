---
name: ase-code-review
argument-hint: "[--help|-h] [<ref>]"
description: >
    Review uncommitted changes and curate them into clean, bisect-safe
    commits grouped by theme: hunks are grouped, staged group by group,
    explained file by file, and committed only on the user's explicit
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
<expand name="custom-dialog" arg1="--other"><content/></expand>
Where the dispatch on <result/> below carries no explicit branch for a
result starting with `OTHER:`, treat such a result as `CANCEL`.
</define>

<objective>
Acting as an *expert-level software developer* who *reviews and curates*,
*review* the uncommitted changes at <ref><getopt-arguments/></ref> (default:
working tree + index + untracked), *group* hunks by theme, *walk* the
user through each file group with an explanation for confirmation,
*apply* them
one theme at a time on a dedicated work branch, *build-verify* each theme
in isolation before asking the user to decide, and *commit* only what the
user accepts. This skill *complements* its neighbours rather than
duplicating them: `ase-meta-diff` narrates *what changed*, `ase-meta-review`
renders a reviewer's *judgement*, `ase-code-lint`/`ase-code-analyze` flag
*quality/logic* problems, and `ase-meta-commit` crafts the *message* — this
skill *curates and commits*; it does *not* judge code quality.
</objective>

<flow>

1.  <step id="STEP 1: Ingest Surface">

    Enumerate every uncommitted change as a flat, numbered *hunk
    manifest*. Cover working tree, index, and untracked files.

    Run:

    -   `git status --porcelain`
    -   `git diff` (working tree vs. index)
    -   `git diff --staged` (index vs. HEAD)
    -   list untracked files (each treated as one add-hunk)

    Emit the following <template/>:

    <template>
    <ase-tpl-head title="HUNK MANIFEST"/>

    <ase-tpl-bullet-secondary/> **HUNK MANIFEST** (<total-hunk-count/> hunks across <file-count/> files)

    <hunk-table/>

    <ase-tpl-foot/>
    </template>

    Hints:

    -   `<hunk-table/>` is a Markdown table with columns:
        `H#`, `FILE`, `LINES`, `KIND`, `PEEK`.
    -   `H#` is `H1`, `H2`, … unique across the manifest.
    -   `LINES` formatted as `+<added> -<removed>` or `@<from>-<to>`
        for modify-in-place.
    -   `KIND` is one of `add`, `modify`, `delete`, `rename`, `binary`.
    -   `PEEK` is a one-line excerpt (≤ 60 chars) of the most
        informative added or changed line.
    -   Detect `rename from/to` headers and mark the hunk `rename`;
        renames MUST be assigned atomically (no hunk-level split).
    -   Binary hunks marked `binary`; assign whole-file to one theme.
    -   Do *not* output full diffs in this step.

    </step>

2.  <step id="STEP 2: Choose Curation Strategy">

    Before grouping any hunks, let the user choose *how* the changes
    are curated. This single choice governs how themes are formed in
    STEP 3 and whether per-commit build-verification *gates* the
    commits in STEP 8.

    Let the *user interactively choose*:

    <expand name="user-dialog">
        Curation Strategy: How should the changes be curated?
        VERTICAL: Compilable commits — every commit builds green and is bisect-safe.
        HORIZONTAL: Theme-near reviews — group by topical proximity; build is informational.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **review cancelled**
        </template>
        </if>

    -   <if condition="<result/> is `HORIZONTAL` or starts with `OTHER:`">
        Set <review-mode>HORIZONTAL</review-mode>.
        </if>

    -   <if condition="<result/> is `VERTICAL`">
        Set <review-mode>VERTICAL</review-mode>.
        </if>

    Emit the following <template/>:

    <template>
    <ase-tpl-bullet-secondary/> **CURATION STRATEGY**: <review-mode/>
    </template>

    Then let the *user interactively choose* how *test* changes are
    handled:

    <expand name="user-dialog">
        Test Handling: Should test changes be reviewed like everything else?
        REVIEW-TESTS: Tests join their themes and are reviewed alongside the code.
        TESTS-LAST: Keep tests out of the themes and stage them at the end as one block.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `TESTS-LAST`">
        Set <test-mode>TESTS-LAST</test-mode>.
        </if>

    -   <else>
        Set <test-mode>REVIEW-TESTS</test-mode>.
        </else>

    Emit the following <template/>:

    <template>
    <ase-tpl-bullet-secondary/> **TEST HANDLING**: <test-mode/>
    </template>

    Hints:

    -   *VERTICAL* (bisect-safe history): a theme is the minimal
        *build-safe* commit unit and may span several architectural
        layers (interface + implementation + caller); each committed
        theme MUST build green — STEP 8.3 *gates* the commit. Optimizes
        for a clean, bisectable history.
    -   *HORIZONTAL* (theme-near review): themes group hunks by *topical
        and architectural proximity* (one concern, or one layer, at a
        time) for the most coherent *review*, accepting that an
        individual commit may not compile standalone. STEP 8.3 still
        runs the build but only for *information* — it does NOT gate the
        commit, and ACCEPT stays available on a non-green build.
    -   The chosen <review-mode/> is carried through STEP 3 (theme
        proposal), STEP 5 (group walk), STEP 6 (staging order), and
        STEP 8 (build gating).
    -   The chosen <test-mode/> is carried through STEP 3/4: with
        `TESTS-LAST`, every hunk in a test file (test directories like
        `src/test/`, `tests/`, `__tests__/`, and test-named files like
        `*Test.java`, `*.spec.ts`, `*_test.go`) is kept out of the
        ordinary themes and assigned to one dedicated final theme
        `UPDATE(test): accompanying tests`, which is always ordered
        *last* in STEP 6, treated as a *single layer* in STEP 8.4, and
        thus staged and committed as one block. With `REVIEW-TESTS`
        (the default, also on CANCEL), test hunks join their themes
        like any other hunk.

    </step>

3.  <step id="STEP 3: Propose Themes (Top-Down)">

    *Before* looking at individual hunk content, propose 3–5
    *commit themes* that together span the full change surface.
    Use the taxonomy shared with `ase-meta-commit` and
    `ase-meta-diff`: FEATURE, BUGFIX, REFACTOR, UPDATE, CLEANUP,
    IMPROVEMENT.

    A theme is the *minimal commit unit*. Internally a theme MAY span
    multiple architectural layers (e.g., interface + implementation +
    caller); those layers are *reviewed* separately in STEP 8.5 but
    *committed* together as one atomic commit in STEP 8.7. This
    decouples commit granularity (topological) from review
    granularity (architectural, comprehensible).

    Emit the following <template/>:

    <template>
    <ase-tpl-bullet-normal/> **PROPOSED THEMES** (<review-mode/>)

    <theme-list/>
    </template>

    Hints:

    -   `<theme-list/>` is a numbered list `T1`, `T2`, … each entry
        one line: `T<n>: <TYPE>(<scope>): <one-liner>`.
    -   Derive themes from *filenames*, *directory prefixes*, and
        *diff summaries* only — do not inspect individual line
        content yet. This enforces top-down naming.
    -   Group according to <review-mode/>: in *VERTICAL* mode each
        theme is a *build-safe vertical slice* spanning the layers
        needed to compile in isolation; in *HORIZONTAL* mode each
        theme groups hunks by *topical/architectural proximity* (one
        concern or one layer), optimizing review coherence over
        standalone compilability.
    -   Prefer 3–5 themes. Fewer is fine if the surface is narrow.
        More than 5 signals the change set is too broad for one
        review session — stop and ask the user to reduce scope.

    </step>

4.  <step id="STEP 4: Assign Hunks to Themes">

    Map every hunk `H<k>` from the manifest to exactly one theme
    `T<n>`. Mark `ORPHAN` if no theme fits. Mark `SPLIT` if the
    hunk bridges two themes and cannot be cleanly assigned.

    Emit the following <template/>:

    <template>
    <ase-tpl-bullet-normal/> **HUNK-TO-THEME ASSIGNMENT**

    <assignment-table/>
    </template>

    <if condition="there is at least one ORPHAN hunk">
    Then additionally emit the following <template/>:

    <template>
    <ase-tpl-bullet-signal/> **ORPHANS**

    <orphan-section/>
    </template>
    </if>

    <if condition="there is at least one SPLIT hunk">
    Then additionally emit the following <template/>:

    <template>
    <ase-tpl-bullet-signal/> **SPLITS**

    <split-section/>
    </template>
    </if>

    Hints:

    -   `<assignment-table/>` has columns: `H#`, `FILE`, `→`, `T#`.
    -   `<orphan-section/>` is a bullet list of orphan hunks with a
        short explanation of why no theme fits.
    -   `<split-section/>` names each SPLIT hunk with the two
        competing themes and a proposed split point.
    -   Per-hunk consistency (mandatory): a hunk may appear in *at
        most one* theme. Overlap is a defect — re-investigate or
        force SPLIT.
    -   For fine-grained separation within a single file, regenerate
        the diff with `git diff --unified=0` so adjacent edits that
        belong to different themes are not merged into one hunk by
        default context grouping.
    -   When a SPLIT hunk must be broken apart, re-serialize the
        patch text into two independent hunk headers
        (`@@ -<from>,<n> +<to>,<m> @@`) covering disjoint line
        ranges before proceeding to STEP 6. A single git-level hunk
        spanning two themes cannot be staged with `git apply
        --cached` as a subset — it must be split at the text level
        first.

    </step>

5.  <step id="STEP 5: Walk and Confirm Groups">

    *Before* any staging, work branch, or commit, walk the *user*
    through the proposed *file groups* (themes) one at a time — each
    with a plain-language *explanation* and its *file list* — and let
    the user *confirm* or *adjust* every group. This pass reviews the
    *grouping* only: no diffs, no line content, no staging. The deep
    per-file walk over the actual changes happens later, per theme, in
    STEP 8.5.

    Maintain a cursor `<group-index/>` over the themes `T1…Tn` in
    proposal order and record `<group-count/>` = n. Process the groups
    with:

    <while condition="<group-index/> ≤ <group-count/> and not every group is confirmed">

    Set `<group-index/>` to the current group and emit the following
    <template/>:

    <template>
    <ase-tpl-bullet-secondary/> **GROUP <group-index/>/<group-count/>** — T<n/>: <type/>(<scope/>): <one-liner/>
    *Progress*: Group <group-index/>/<group-count/>

    *Files* (<file-count/>):
    <group-file-list/>

    *Why grouped*: <group-rationale/>
    </template>

    Then let the *user interactively choose* (offer `BACK-GROUP` only
    when `<group-index/>` is not the first group):

    <expand name="user-dialog">
        Group <group-index/>/<group-count/>: How would you like to handle this group?
        CONFIRM-GROUP: The grouping is right — mark it reviewed and advance.
        ADJUST-GROUP: Reassign or split files across groups.
        DISCUSS-GROUP: Ask a question about this group.
        BACK-GROUP: Return to the previous group.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **review cancelled**
        </template>
        </if>

    -   <if condition="<result/> is `CONFIRM-GROUP`">
        Mark the group reviewed and set `<group-index/>` to
        `<group-index/>` + 1.
        </if>

    -   <if condition="<result/> is `ADJUST-GROUP` or starts with `OTHER:`">
        Return to STEP 4, reassign this group's hunks (move a file to
        another group, or force a SPLIT), then re-enter this walk with
        the updated grouping (update `<group-count/>`).
        </if>

    -   <if condition="<result/> is `DISCUSS-GROUP`">
        Answer scoped to *this group* only — filenames, roles, and why
        the files belong together, with *no* line content — then
        re-prompt the *same* group.
        </if>

    -   <if condition="<result/> is `BACK-GROUP`">
        Set `<group-index/>` to `<group-index/>` − 1.
        </if>

    </while>

    Once every group is confirmed, emit the following <template/>:

    <template>
    <ase-tpl-bullet-normal/> **GROUPS CONFIRMED** (<group-count/> groups, <review-mode/>)
    </template>

    Hints:

    -   `<group-file-list/>` is a bullet list, one entry per file:
        `- <filepath> — <kind>, <hunk-refs> — <one-line role>`.
        Derive the role from the filename, path, and the STEP 4
        assignment; do *not* inspect line content here.
    -   `<group-rationale/>` is 1–3 sentences on *why these files form
        one group* — shared concern, layer, or feature — reconstructed
        from names and the assignment, not from diffs.
    -   This walk is *grouping review*, not *code review*: no diffs, no
        quality judgement, no staging. `ADJUST-GROUP` is the only path
        that mutates assignments and always routes back through STEP 4,
        so the per-hunk consistency invariant is preserved.
    -   A group confirmed here is *not* yet committed. Staging is
        deferred to STEP 8.1 (only the current group's files) and the
        commit decision to STEP 8.7, both per theme.

    </step>

6.  <step id="STEP 6: Plan Staging Order">

    Determine an order over the themes and let the user confirm or
    override. Record the total theme count into `<theme-total/>` for
    the progress display.

    Emit the following <template/>:

    <template>
    <ase-tpl-bullet-normal/> **STAGING PLAN** (<theme-total/> themes, <review-mode/>)

    <ordered-theme-list/>
    </template>

    Then let the *user interactively choose* whether to accept the
    auto-sorted order:

    <expand name="user-dialog">
        Staging Order: Accept the proposed staging order or reorder it?
        ACCEPT-ORDER: Accept the auto-sorted order.
        REORDER: Provide a different theme sequence.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **review cancelled**
        </template>
        </if>

    -   <if condition="<result/> is `REORDER` or starts with `OTHER:`">
        Ask the user for the desired sequence and update
        `<ordered-theme-list/>` accordingly, then re-emit the
        STAGING PLAN <template/> above.
        </if>

    -   <if condition="<result/> is `ACCEPT-ORDER`">
        Keep the auto-sorted order.
        </if>

    Hints:

    -   In *both* modes the order is first of all a *comprehension*
        order: every theme may build only on concepts the user has
        already accepted — foundations (types, interfaces, utilities)
        come before the code depending on them, so the reviewer's
        mental model grows monotonically and never meets a forward
        reference to a not-yet-reviewed concept.
    -   In *VERTICAL* mode, choose a *topological* order so each theme
        builds independently given the previous ones: if theme `T2`
        adds a call to a function defined in `T3`, order `T3` before
        `T2`.
    -   Detect renames first — always order rename-themes before any
        theme that touches the renamed file (both modes).
    -   For each theme, dry-run `git apply --cached --check` on its
        patch subset against a simulated preceding state. If the dry
        run fails, reorder or return to STEP 4 and mark SPLIT.
    -   In *HORIZONTAL* mode a standalone green build per theme may be
        impossible by design; the patch-applicability dry-run still
        applies, and build-greenness is not required for ordering —
        keep topically related themes adjacent, but still
        dependency-first per the comprehension order above.

    </step>

7.  <step id="STEP 7: Create Work Branch">

    Create a dedicated work branch so review commits do not pollute
    the current branch until the user merges explicitly.

    Run `git rev-parse --abbrev-ref HEAD` to record the source
    branch into `<source-branch/>`. Propose a work branch name
    `review/<YYYY-MM-DD-HHMM>` into `<work-branch/>` and let the
    *user interactively choose*:

    <expand name="user-dialog">
        Work Branch: Use the proposed work branch name or a custom one?
        ACCEPT-NAME: Use the proposed `review/<YYYY-MM-DD-HHMM>` name.
        CUSTOM-NAME: I will provide a different branch name.
    </expand>

    Dispatch on the tool <result/>:

    -   <if condition="<result/> is `CANCEL`">
        Only output the following <template/> and then immediately
        *STOP* processing the entire current skill:

        <template>
        ⧉ **ASE**: ✪ skill: **ase-code-review**, ▶ status: **review cancelled**
        </template>
        </if>

    -   <if condition="<result/> is `CUSTOM-NAME` or starts with `OTHER:`">
        Take the user-provided name (the text after `OTHER:` when
        present, otherwise ask for it) into `<work-branch/>`.
        </if>

    Then run `git checkout -b <work-branch/>` to switch to the work
    branch and emit the following <template/>:

    <template>
    <ase-tpl-bullet-normal/> **WORK BRANCH** `<work-branch/>` (from `<source-branch/>`)
    </template>

    Hints:

    -   Do *not* stash or reset the uncommitted changes. The work
        branch inherits the working tree and index from the source
        branch — hunks remain available for per-theme staging.
    -   If a branch with the chosen name already exists, ask the
        user for a different name.

    </step>

8.  <step id="STEP 8: Per-Theme Review Loop">

    Maintain a *queue* of themes in the order from STEP 6. Process
    one theme at a time. Non-accepted themes are handled per the
    chosen option and do not re-enter the queue unless *regrouped*.

    *Never prompt in free text.* Across *every* sub-step (8.1
    through 8.8) — staging, isolation, build, layer entry, file
    prompt, section walk, correction, decision view, stash-pop
    conflict — any continuation, confirmation, or decision *MUST*
    go through `<expand name="user-dialog">` with a defined option
    set (2–4 options per dialog; use nested dialogs where more
    choices are needed). Free-text prompts like "OK weiter?",
    "Commit?", or "Soll ich noch was klären?" are a defect.

    *Progress display (mandatory)*: every card emitted inside this
    loop carries a `*Progress*:` breadcrumb so the user always sees
    their position in the whole review — `Batch <theme-pos/>/<theme-total/>`
    for the theme, then `Layer <layer-index/>/<layer-count/>` and
    `File <file-index/>/<file-total/>` (and `Section <section-index/>/<section-count/>`)
    as those cursors apply. `<theme-pos/>` is the 1-based staging
    index of the current theme.

    Process the queue with:

    <while condition="the theme queue is not empty and not all remaining themes are deferred">

    Take the next theme from the queue as `<item/>`, set `<theme-pos/>`
    to its 1-based staging index, and execute the following sub-cycle:

    8.1. *Announce and stage the group — before any review walk.*
         First emit the batch-entry banner so the user sees the
         position before the silent staging/build:

         <template>
         <ase-tpl-bullet-normal/> **BATCH <theme-pos/>/<theme-total/>** — entering theme T<n/>: <type/>(<scope/>): <one-liner/>
         </template>

         Then clear the index with `git reset` (working tree
         preserved), and `git apply --cached <patch-subset>` to stage
         *only* the files of this group that await sign-off. Staging
         *precedes* the review walk: the index MUST hold *exactly*
         this group's files and nothing else — no other group's files
         may be staged. Verify with `git diff --staged --name-only`
         that the staged file set equals this group's planned file set
         (and `git diff --staged` matches the planned hunk set); on any
         mismatch, abort this theme and return to STEP 5.

    8.2. *Isolate the working tree to the post-commit state.* Other
         themes' hunks must not influence the build result.

         <if condition="`git diff` against the index is NOT empty (other themes' hunks remain)">
         Run `git stash push --keep-index --include-untracked
         --message "review-isolate-T<n>"`. Effect: the stash
         captures every working-tree change *not* in the index
         (all other themes' hunks and untracked files), leaving the
         working tree byte-equal to the index — exactly what the
         commit will produce. Record that a stash was pushed.
         </if>

         <if condition="`git diff` against the index is empty">
         Skip the stash (`git stash` with nothing to stash fails).
         Record that no stash was pushed.
         </if>

    8.3. *Build-test.* Discover the project build command from, in
         order: `AGENTS.md`, `CLAUDE.md`, `package.json` scripts,
         `Makefile` targets, `Cargo.toml`, `pom.xml`, `go.mod`,
         language-idiomatic defaults.

         <if condition="the build command is ambiguous">
         Let the *user interactively choose* the build command:

         <expand name="user-dialog">
             Build Command: Which command build-verifies this theme?
             <build-candidate-1/>: (first discovered candidate)
             <build-candidate-2/>: (second discovered candidate)
             <build-candidate-3/>: (third discovered candidate)
         </expand>

         Take the selected (or `OTHER:`-provided) command as the
         build command.
         </if>

         Run the command and capture exit code and output into
         `<exit-code/>` and `<error-excerpt/>`.

         -   In *VERTICAL* mode this exit code *gates* the commit: it
             represents the true post-commit, post-push build result,
             since no other themes' changes interfere.
         -   In *HORIZONTAL* mode the exit code is *informational
             only*: a non-green standalone build is expected and does
             NOT block the commit.

    8.4. *Decompose and visualize the theme.*

         Partition the theme's staged hunks into an ordered list of
         *layers* `L1, L2, …, Lk`, and record `<layer-count/>` = k.
         Layers are a *review-only* concept — they are never committed
         separately. Apply these heuristics in order; stop when one
         produces a stable partition:

         -   *Path-prefix*: group by top-level directory (e.g.,
             `interfaces/`, `domain/`, `service/`, `api/`, `ui/`).
         -   *Symbol-kind*: separate type declarations,
             implementations, and call-sites.
         -   *Dependency direction*: partition along the reference
             structure itself when neither paths nor symbol kinds
             yield a stable split.

         Whatever heuristic produced the partition, *order* the
         layers — and the files within each layer — strictly
         bottom-up along the dependency direction: every layer and
         file may reference only identifiers introduced earlier in
         the walk, so the explanation never leans on a
         not-yet-seen concept and the reviewer's mental model grows
         monotonically. Fall back to path-prefix order only where
         references are circular.

         Build a Mermaid specification showing how *this theme's*
         files collaborate and dispatch its rendering to the
         `ase-meta-diagram` sub-agent via the `Agent` tool
         (`subagent_type: "ase:ase-meta-diagram"`), then reproduce
         its returned fenced code block verbatim as
         `<rendered-diagram/>`. Pick the Mermaid type by theme intent:

         -   *classDiagram* — theme introduces types with
             inheritance, implementation, or composition.
         -   *flowchart TB* — dependencies across components,
             modules, or layers.
         -   *sequenceDiagram* — actor/message flow (e.g., caller →
             port → adapter → impl).

         Default to *flowchart TB* when uncertain.

         Emit the following <template/>:

         <template>
         <ase-tpl-head title="THEME OVERVIEW"/>

         <ase-tpl-bullet-secondary/> **THEME OVERVIEW** T<n/> · <type/>(<scope/>): <one-liner/>
         *Progress*: Batch <theme-pos/>/<theme-total/> · Layers <layer-count/>

         *Rationale*: <rationale/>

         *Layers* (review order):
         <layer-purpose-list/>

         *Collaboration*:

         <rendered-diagram/>

         <ase-tpl-foot/>
         </template>

         Hints:

         -   `<rationale/>` is 2–4 sentences reconstructing the goal
             the theme addresses — what problem, what user outcome,
             what design choice. *Not* a line-by-line diff summary.
         -   `<layer-purpose-list/>` is a bullet list `- L<i>:
             <label> — <one-sentence purpose>` per layer. Acts as
             upfront orientation before the file walk in STEP 8.5.
         -   Omit the diagram with a one-line note (`*no
             collaboration to diagram — purely textual*`) for
             docs/constants/comments themes and for single-file
             themes (where it is usually redundant). Hand-drawn
             ASCII frames and raw Mermaid source as a substitute for
             a rendered block are defects.
         -   Layer count range: 1 to 5. If exactly one layer
             emerges, skip STEP 8.5 and render the full diff in
             STEP 8.6. More than 5 layers means the theme is too
             broad — recommend *regroup* in STEP 8.7.
         -   Review-order is independent from staging-order (STEP 6);
             the theme still commits atomically in one `git commit`.

    8.5. *Walk the theme file by file, interactively.*

         <if condition="the theme contains exactly one file">
         Skip this entire sub-step 8.5 and go to STEP 8.6.
         </if>

         Traverse the theme's files grouped by the layers from
         STEP 8.4. Maintain the explicit cursors `<layer-index/>`
         (current layer, 1…`<layer-count/>`) and `<file-index/>`
         (current file `i` of `<file-total/>` within the layer).
         *Walk-position invariant (mandatory)*: side actions
         (`show-diff`, `discuss`, `fix`, the section walk) ALWAYS
         re-prompt the *same* `<file-index/>` — they NEVER advance the
         cursor. The transition to STEP 8.6 happens *exclusively* via
         `NEXT` on the last file of the last layer, or via an explicit
         `DECIDE-NOW`. No other path may leave the walk.

         Walk the layers with:

         <while condition="<layer-index/> ≤ <layer-count/> and the walk was not ended by DECIDE-NOW">

         On entering each layer, set `<file-total/>` to the number of
         files in this layer and emit a *layer card*:

         <template>
         <ase-tpl-bullet-secondary/> **Layer L<layer-index/> — <layer-label/>** of T<n/>
         (<file-total/> files: <file-list/>)
         *Progress*: Batch <theme-pos/>/<theme-total/> · Layer <layer-index/>/<layer-count/>

         <one-sentence-purpose/>
         </template>

         Then let the *user interactively choose* (offer `BACK-LAYER`
         only when `<layer-index/>` is not the first layer):

         <expand name="user-dialog">
             Layer L<layer-index/>: How would you like to handle this layer?
             PROCEED-LAYER: Enter the per-file walk for this layer.
             SKIP-LAYER: Treat the layer as reviewed and advance.
             BACK-LAYER: Return to the previous layer.
             DECIDE-NOW: Abort the walk and jump to the decision view.
         </expand>

         Dispatch on the tool <result/>:

         -   `SKIP-LAYER`/`CANCEL`: set `<layer-index/>` to
             `<layer-index/>` + 1 (advance).
         -   `BACK-LAYER`: set `<layer-index/>` to `<layer-index/>` − 1.
         -   `DECIDE-NOW`: end the walk and go to STEP 8.6.
         -   `PROCEED-LAYER`: set `<file-index/>` to 1 and enter the
             per-file walk below; when it completes by `NEXT` on the
             last file, set `<layer-index/>` to `<layer-index/>` + 1.

         Per-file walk inside the layer:

         <while condition="<file-index/> ≤ <file-total/> and the walk was not ended by DECIDE-NOW">

         (a) Emit a *file card*:

             <template>
             <ase-tpl-bullet-secondary/> **File <file-index/>/<file-total/>** of T<n/> · `<filepath/>`
             (<lines/>, <kind/>, L<layer-index/>: <layer-label/>)
             *Progress*: Batch <theme-pos/>/<theme-total/> · Layer <layer-index/>/<layer-count/> · File <file-index/>/<file-total/>

             <short-explanation/>

             <editor-hint/>
             </template>

         (b) Let the *user interactively choose* the primary file
             action (offer `BACK` only when `<file-index/>` > 1):

             <expand name="user-dialog">
                 File <file-index/>/<file-total/>: How would you like to proceed?
                 NEXT: Advance to the next file.
                 BACK: Re-render the previous file.
                 ACT: Inspect, discuss, or correct this file.
                 DECIDE-NOW: Abort the walk and jump to the decision view.
             </expand>

             Dispatch on the tool <result/>:

             -   `NEXT`/`CANCEL`: set `<file-index/>` to `<file-index/>`
                 + 1. When this was the last file of the last layer,
                 end the walk and go to STEP 8.6.
             -   `BACK`: set `<file-index/>` to `<file-index/>` − 1 and
                 re-render that file.
             -   `DECIDE-NOW`: end the walk and go to STEP 8.6.
             -   `ACT`: open the *act* sub-dialog in (c); it always
                 returns to the *same* `<file-index/>` afterwards.

         (c) *Act* sub-dialog (offer `SECTIONS` only when the file's
             *total LOC* exceeds *300*):

             <expand name="user-dialog">
                 Act on File <file-index/>: What would you like to do?
                 SHOW-DIFF: Render this file's staged diff inline.
                 DISCUSS: Ask a question about this file.
                 FIX: Prepare or apply a correction to this file.
                 SECTIONS: Walk this large file section by section.
             </expand>

             Dispatch on the tool <result/>, then *always* re-prompt
             the *same* file at (b):

             -   `SHOW-DIFF`: render `<diff-per-file/>` scoped to the
                 current file (see 8.6 format), then re-prompt (b).
             -   `DISCUSS`: enter discussion mode — wait for the
                 user's free-text question, answer it scoped to the
                 *current* file only, then re-prompt (b). Discussion
                 is review dialogue — *no* code editing here.
             -   `FIX`: enter the *correction* sub-flow in (d).
             -   `SECTIONS`: enter the *section walk* in (e).
             -   `CANCEL`: re-prompt (b) unchanged.

         (d) *Correction* sub-flow on `FIX`. First capture the
             correction intent for the *current* file — *what* to
             change and *why* — into a structured entry
             `{ file, instruction, rationale }`. Then let the *user
             interactively choose*:

             <expand name="user-dialog">
                 Fix `<filepath/>`: How would you like to correct this file?
                 PREPARE-TASK: Queue the correction for a sub-agent (do not edit now).
                 FIX-NOW: Solve it now with an isolated sub-agent.
                 CANCEL: Do not correct; return to the file.
             </expand>

             Dispatch on the tool <result/>, then *always* re-prompt
             the *same* file at (b):

             -   `PREPARE-TASK`: append the entry to the per-theme
                 fix-queue `<fix-queue/>`. Do *not* edit now.
             -   `FIX-NOW`: dispatch the correction to a *sub-agent*
                 via the `Agent` tool so the editing transcript never
                 leaks into the review context — route substantive
                 work through `ase-code-refactor` / `ase-code-resolve`
                 semantics. On return, *re-manifest* the touched file
                 (regenerate its hunks, re-apply the theme's staged
                 subset via `git apply --cached`), and record that a
                 *re-build* is required before this theme may be
                 committed.
             -   `CANCEL`/`OTHER:`: discard the captured intent.

         (e) *Section walk* on `SECTIONS`. Partition the current file
             into *3–8 semantic sections* grouped by *responsibility*
             (e.g., fields & class header, hot-path method, helper
             cluster, seqlock read path) — *not* by raw syntactic
             slicing. Record `<section-count/>` = k and walk them
             sequentially with the cursor `<section-index/>` (`s` of
             `<section-count/>`):

             <while condition="<section-index/> ≤ <section-count/> and the user did not pick FILE-DONE">

             Emit a *section card* with 2–6 sentences on *what* the
             section does and *why* it is shaped that way (pattern,
             invariant, trade-off), referencing concrete identifiers
             and line ranges (`Z.NN-MM`). No diff, no full listing.

             <template>
             <ase-tpl-bullet-secondary/> **Section <section-index/>/<section-count/> — <section-concern/>** of `<filepath/>` (Z.<from/>-<to/>)
             *Progress*: Batch <theme-pos/>/<theme-total/> · Layer <layer-index/>/<layer-count/> · File <file-index/>/<file-total/> · Section <section-index/>/<section-count/>

             <section-explanation/>
             </template>

             Then let the *user interactively choose*:

             <expand name="user-dialog">
                 Section <section-index/>/<section-count/>: How would you like to proceed?
                 NEXT-SECTION: Advance to the next section.
                 DISCUSS-SECTION: Ask a question about this section.
                 FIX: Prepare or apply a correction to this section.
                 FILE-DONE: Exit the section walk; return to the file.
             </expand>

             Dispatch on the tool <result/>:

             -   `NEXT-SECTION`/`CANCEL`: set `<section-index/>` to
                 `<section-index/>` + 1 (auto `FILE-DONE` after the
                 last section).
             -   `DISCUSS-SECTION`: answer scoped to the section, then
                 re-prompt the *same* section.
             -   `FIX`: run the (d) correction sub-flow, then re-prompt
                 the *same* section.
             -   `FILE-DONE`: exit the section walk.

             </while>

             On exit, return to the file prompt (b) at the *same*
             `<file-index/>`.

         </while>

         </while>

         Hints:

         -   `<short-explanation/>` is 2–5 sentences describing what
             the file/change does and its role in the theme — *not*
             a diff. The user reviews actual lines in the editor
             (VSCode Source Control, vim-fugitive, etc.).
         -   `<editor-hint/>` differs by hunk kind: *add* (new file)
             — "Whole file is the change — view directly in editor.";
             *modify* — "File has other unstaged changes; view staged
             subset with `git diff --staged <filepath>`."; *rename* —
             note old and new path; *binary* — note size, no preview;
             *delete* — note file was removed.
         -   `discuss` does *not* count as a commit decision. The
             *accept/skip/regroup/defer/discard* decision comes
             exclusively from STEP 8.7, on the whole theme.
         -   A correction (`FIX`) changes the diff. The skill stays
             in scope: corrections are performed by sub-agents and
             the theme is re-manifested — the review context itself
             never edits code inline.

    8.6. *Render the decision view.*

         <if condition="the build in 8.3 succeeded (<exit-code/> is 0)">
         Emit the following <template/>:

         <template>
         <ase-tpl-head title="THEME"/>

         <ase-tpl-bullet-normal/> **THEME T<n/>** · <type/>(<scope/>): <one-liner/>
         *Progress*: Batch <theme-pos/>/<theme-total/>

         *Hunks*: <hunk-refs/>
         *Files*: <file-list/>
         *Build*: `<build-command/>` — exit 0
         *Queued fixes*: <fix-queue-count/>

         *Why & Flow*: see **THEME OVERVIEW** in STEP 8.4 above.

         *Diff*:

         <diff-per-file/>

         <ase-tpl-foot/>
         </template>
         </if>

         <if condition="the build failed AND <review-mode/> is `VERTICAL`">
         The failure *blocks* the commit. Emit the following <template/>:

         <template>
         <ase-tpl-head title="BUILD FAIL"/>

         <ase-tpl-bullet-signal/> **BUILD FAIL** at T<n/> · <type/>(<scope/>): <one-liner/>
         *Progress*: Batch <theme-pos/>/<theme-total/>

         *Hunks*: <hunk-refs/>
         *Files*: <file-list/>
         *Command*: `<build-command/>`
         *Exit*: <exit-code/>
         *Error*:
         ```
         <error-excerpt/>
         ```
         *Likely cause*: <diagnosis/>

         *Diff*:

         <diff-per-file/>

         <ase-tpl-foot/>
         </template>
         </if>

         <if condition="the build failed AND <review-mode/> is `HORIZONTAL`">
         The failure is *informational* and does NOT block the commit.
         Emit the following <template/>:

         <template>
         <ase-tpl-head title="THEME"/>

         <ase-tpl-bullet-normal/> **THEME T<n/>** · <type/>(<scope/>): <one-liner/>
         *Progress*: Batch <theme-pos/>/<theme-total/>

         *Hunks*: <hunk-refs/>
         *Files*: <file-list/>
         *Build*: `<build-command/>` — exit <exit-code/> (informational — horizontal mode, not gating)
         *Queued fixes*: <fix-queue-count/>

         *Why & Flow*: see **THEME OVERVIEW** in STEP 8.4 above.

         *Diff*:

         <diff-per-file/>

         <ase-tpl-foot/>
         </template>
         </if>

         Hints:

         -   `<diff-per-file/>` groups the staged diff *per file*.
             Each file becomes one block: a `### <filepath>
             (<hunk-refs>)` headline, followed by a fenced ```diff```
             block containing only that file's diff lines. Do not
             abridge; show full diff content per file. This decision
             view is the primary rendering location; STEP 8.5 emits
             the same format on-demand via `SHOW-DIFF` scoped to a
             single file.
         -   Do *not* add quality judgements, improvement
             suggestions, or severity-tagged findings. This skill
             curates changes, it does not review them. Use
             `ase-code-lint` or `ase-code-analyze` for that.

    8.7. *Decide.* Let the *user interactively choose* with an option
         set matching the *mode*, the *build outcome*, and the
         *fix-queue*. A theme is *never* committed with unapplied
         queued corrections, so `ACCEPT` is withheld whenever
         `<fix-queue/>` is non-empty. *Every* terminal branch restores
         the parked hunks via `git stash pop` (skip pop only when 8.2
         pushed no stash).

         <if condition="<fix-queue/> is empty AND the build succeeded">
         <expand name="user-dialog">
             Decide T<n/>: What should happen with this theme?
             ACCEPT: Commit this theme on the work branch.
             REQUEUE: Skip, regroup, or defer this theme.
             DISCARD: Destructively drop this theme's hunks.
         </expand>
         </if>

         <if condition="<fix-queue/> is empty AND the build failed AND <review-mode/> is `HORIZONTAL`">
         <expand name="user-dialog">
             Decide T<n/>: Build is non-green (informational) — what now?
             ACCEPT: Commit this theme anyway (horizontal mode).
             FIX: Apply a correction via a sub-agent, then re-verify.
             REQUEUE: Skip, regroup, or defer this theme.
             DISCARD: Destructively drop this theme's hunks.
         </expand>
         </if>

         <if condition="<fix-queue/> is NOT empty">
         `ACCEPT` is withheld until the queued corrections are flushed:

         <expand name="user-dialog">
             Decide T<n/>: Queued corrections pending — what now?
             CORRECT: Apply the queued fixes via a sub-agent, then re-verify.
             REQUEUE: Skip, regroup, or defer this theme.
             DISCARD: Destructively drop this theme's hunks.
         </expand>
         </if>

         <if condition="the build failed AND <review-mode/> is `VERTICAL` AND <fix-queue/> is empty">
         The build *gates* the commit, so `ACCEPT` is unavailable:

         <expand name="user-dialog">
             Decide T<n/>: The build failed — what now?
             FIX: Correct the failure via a sub-agent, then re-verify.
             RETRY: Re-run the build without changes.
             REQUEUE: Skip, regroup, or defer this theme.
             DISCARD: Destructively drop this theme's hunks.
         </expand>
         </if>

         Dispatch on the tool <result/>:

         -   <if condition="<result/> is `ACCEPT`">
             Invoke `Skill(skill: "ase:ase-meta-commit")` to craft a
             commit message, then `git commit`. Restore parked hunks
             with `git stash pop`. The theme leaves the queue. (In
             *VERTICAL* mode the theme is thereby *bisect-safe*; in
             *HORIZONTAL* mode the commit may be non-green by design.)
             </if>

         -   <if condition="<result/> is `CORRECT`">
             Dispatch the entire `<fix-queue/>` to a *sub-agent* via
             the `Agent` tool (isolated context; route through
             `ase-code-refactor` / `ase-code-resolve` semantics).
             Then re-manifest the theme, empty `<fix-queue/>`, return
             to STEP 8.3 to *re-run the build-verify*, and re-enter
             this decision view.
             </if>

         -   <if condition="<result/> is `FIX`">
             Dispatch the build/quality correction to a *sub-agent*
             via the `Agent` tool (isolated context). Then
             re-manifest, return to STEP 8.3 to *re-run the
             build-verify*, and re-enter this decision view.
             </if>

         -   <if condition="<result/> is `RETRY`">
             Return to STEP 8.3 and re-run the build without
             unstashing.
             </if>

         -   <if condition="<result/> is `REQUEUE`">
             Let the *user interactively choose* how to requeue:

             <expand name="user-dialog">
                 Requeue T<n/>: How should this theme be requeued?
                 SKIP: Do not commit; reinstate the hunks in the working tree.
                 REGROUP: Reassign this theme's hunks (back to STEP 4).
                 DEFER: Move the theme to the end of the queue.
             </expand>

             Then dispatch:

             -   `SKIP`: `git stash pop` (if pushed), then `git reset`
                 (index back to HEAD; popped hunks reinstated as
                 working-tree changes). Theme leaves the queue.
             -   `REGROUP`: `git stash pop` (if pushed), `git reset`.
                 Return to STEP 4 and reassign this theme's hunks; the
                 new theme(s) re-enter the queue at their topologically
                 correct position (update `<theme-total/>`).
             -   `DEFER`/`CANCEL`: `git stash pop` (if pushed),
                 `git reset`. Move the theme to the *end* of the
                 queue. If on the next iteration every remaining theme
                 is *deferred*, stop the loop and jump to STEP 9.
             </if>

         -   <if condition="<result/> is `DISCARD`">
             *Destructive* — require a second confirmation:

             <expand name="user-dialog">
                 Discard T<n/>: This permanently drops the hunks — confirm?
                 CONFIRM-DISCARD: Yes, permanently drop this theme's hunks.
                 CANCEL: No, keep the hunks; return to the decision.
             </expand>

             <if condition="<result/> is `CONFIRM-DISCARD`">
             `git stash pop` (if pushed), `git reset`, then
             `git checkout -- <files>` for tracked files and `rm` for
             untracked files touched by this theme. Hunks are lost;
             the theme leaves the queue.
             </if>

             <if condition="<result/> is NOT `CONFIRM-DISCARD`">
             Return to the decision view for this theme.
             </if>
             </if>

         *Stash-pop conflict handling*: if `git stash pop` reports a
         conflict (rare, only when the disjoint-theme assumption
         breaks), pause the loop, emit a diagnostic with the
         conflicting paths, and ask the user to resolve manually
         before resuming. Do *not* auto-resolve.

    8.8. *Continue* with the next theme until the queue is empty or
         all remaining themes are deferred.

    </while>

    Hints:

    -   In *VERTICAL* mode every committed theme *MUST* build green;
        do *not* batch commits and verify only at the end — that hides
        dependency defects and breaks `git bisect`. In *HORIZONTAL*
        mode commits are grouped for review coherence and may not
        build standalone — bisect-safety is intentionally traded away.
    -   Corrections are *in scope* via the `FIX` paths (8.5d, 8.7):
        they run in isolated sub-agents and the theme is re-manifested
        and re-built before any commit. Editing the review context
        itself remains out of scope.
    -   Never invoke `ase-meta-changelog` from this skill.
        `CHANGELOG.md` updates belong to a release step, not a
        review step.

    </step>

9.  <step id="STEP 9: Final Summary">

    Emit a concise recap of what was produced:

    <template>
    <ase-tpl-head title="ACCEPTANCE SUMMARY"/>

    <ase-tpl-bullet-secondary/> **ACCEPTANCE SUMMARY** (<review-mode/>)

    *Work branch*: `<work-branch/>` (from `<source-branch/>`)

    <commit-table/>

    *Left in working tree*: <skipped-and-deferred/>
    *Open corrections*: <open-fix-queue/>
    *Discarded*: <discarded/>

    <ase-tpl-foot/>
    </template>

    Hints:

    -   `<commit-table/>` columns: `T#`, `SHA`, `TYPE`, `SUBJECT`,
        `FILES`, `BUILD`. `BUILD` is `✓` (green), `✗` (failed), or
        `~` (non-green, committed in horizontal mode).
    -   `<skipped-and-deferred/>` lists hunks left uncommitted in the
        working tree, one bullet per theme with reason.
    -   `<open-fix-queue/>` lists any still-unapplied queued
        corrections, omitted (`none`) if empty.
    -   `<discarded/>` lists themes the user destructively removed.
    -   Do *not* propose further actions (no automatic merge into the
        source branch, no push). The user decides what to do with the
        work branch.

    </step>

</flow>
