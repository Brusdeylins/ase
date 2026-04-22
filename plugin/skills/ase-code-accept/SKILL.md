---
name: ase-code-accept
argument-hint: "[<ref>]"
description: "Review uncommitted changes and curate them into clean, bisect-safe commits grouped by theme."
user-invocable: true
disable-model-invocation: false
model: opus
effort: medium
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Accept AI-Generated Changes
===========================

Your role is an experienced, *expert-level software developer*,
specialized in *reviewing and curating* an accumulated pile of
uncommitted source code changes into clean, thematically-coherent,
build-verified Git commits on a dedicated work branch.

<objective>
*Review* the uncommitted changes at $ARGUMENTS (default: working
tree + index + untracked), *group* hunks by theme, *apply* them one
theme at a time on a dedicated work branch, *build-verify* each
theme before asking the user to decide, and *commit* only what the
user accepts.
</objective>

<flow>
1. <step id="STEP 1: Ingest Surface">
   Enumerate every uncommitted change as a flat, numbered *hunk
   manifest*. Cover working tree, index, and untracked files.

   Run:
   - `git status --porcelain`
   - `git diff` (working tree vs. index)
   - `git diff --staged` (index vs. HEAD)
   - list untracked files (each treated as one add-hunk)

   Emit the following <template/>:

   <template>
   &#x1F4CB; **HUNK MANIFEST** (<total-hunk-count/> hunks across <file-count/> files)

   <hunk-table/>
   </template>

   Hints:

   - `<hunk-table/>` is a Markdown table with columns:
     `H#`, `FILE`, `LINES`, `KIND`, `PEEK`.
   - `H#` is `H1`, `H2`, … unique across the manifest.
   - `LINES` formatted as `+<added> -<removed>` or `@<from>-<to>`
     for modify-in-place.
   - `KIND` is one of `add`, `modify`, `delete`, `rename`, `binary`.
   - `PEEK` is a one-line excerpt (≤ 60 chars) of the most
     informative added or changed line.
   - Detect `rename from/to` headers and mark the hunk `rename`;
     renames MUST be assigned atomically (no hunk-level split).
   - Binary hunks marked `binary`; assign whole-file to one theme.
   - Do *not* output full diffs in this step.
   </step>

2. <step id="STEP 2: Propose Themes (Top-Down)">
   *Before* looking at individual hunk content, propose 3–5
   *commit themes* that together span the full change surface.
   Use the taxonomy shared with `ase-code-commit` and
   `ase-code-changes`: FEATURE, BUGFIX, REFACTOR, UPDATE,
   CLEANUP, IMPROVEMENT.

   A theme is the *minimal build-safe commit unit*. It must
   compile and pass tests in isolation. Internally a theme MAY
   span multiple architectural layers (e.g., interface +
   implementation + caller); those layers are *reviewed*
   separately in STEP 6.5 but *committed* together as one
   atomic commit in STEP 6.7. This decouples commit
   granularity (topological, bisect-safe) from review
   granularity (architectural, comprehensible).

   Emit the following <template/>:

   <template>
   &#x1F535; **PROPOSED THEMES**

   <theme-list/>
   </template>

   Hints:

   - `<theme-list/>` is a numbered list `T1`, `T2`, … each entry
     one line: `T<n>: <TYPE>(<scope>): <one-liner>`.
   - Derive themes from *filenames*, *directory prefixes*, and
     *diff summaries* only — do not inspect individual line
     content yet. This enforces top-down naming.
   - Prefer 3–5 themes. Fewer is fine if the surface is narrow.
     More than 5 signals the change set is too broad for one
     acceptance session — stop and ask the user to reduce scope.
   </step>

3. <step id="STEP 3: Assign Hunks to Themes">
   Map every hunk `H<k>` from the manifest to exactly one theme
   `T<n>`. Mark `ORPHAN` if no theme fits. Mark `SPLIT` if the
   hunk bridges two themes and cannot be cleanly assigned.

   Emit the following <template/>:

   <template>
   &#x1F4CE; **HUNK-TO-THEME ASSIGNMENT**

   <assignment-table/>

   <orphan-section/>
   <split-section/>
   </template>

   Hints:

   - `<assignment-table/>` has columns: `H#`, `FILE`, `→`, `T#`.
   - `<orphan-section/>` omitted if empty; otherwise bullet list
     of orphan hunks with a short explanation of why no theme
     fits.
   - `<split-section/>` omitted if empty; otherwise each SPLIT
     hunk named with the two competing themes and a proposed
     split point.
   - Per-hunk consistency (mandatory): a hunk may appear in *at
     most one* theme. Overlap is a defect — re-investigate or
     force SPLIT.
   - For fine-grained separation within a single file, regenerate
     the diff with `git diff --unified=0` so adjacent edits that
     belong to different themes are not merged into one hunk by
     default context grouping.
   - When a SPLIT hunk must be broken apart, re-serialize the
     patch text into two independent hunk headers
     (`@@ -<from>,<n> +<to>,<m> @@`) covering disjoint line
     ranges before proceeding to STEP 4. A single git-level hunk
     spanning two themes cannot be staged with `git apply
     --cached` as a subset — it must be split at the text level
     first.
   </step>

4. <step id="STEP 4: Plan Staging Order">
   Determine a *topological order* over the themes so each theme
   can build independently given the previous ones. Then let the
   user confirm or override.

   Emit the following <template/>:

   <template>
   &#x1F5FA; **STAGING PLAN**

   <ordered-theme-list/>
   </template>

   Hints:

   - Inspect cross-theme symbol references: if theme `T2` adds a
     call to a function defined in `T3`, order `T3` before `T2`.
   - Detect renames first — always order rename-themes before
     any theme that touches the renamed file.
   - For each theme, dry-run `git apply --cached --check` on its
     patch subset against a simulated preceding state. If the
     dry run fails, reorder or return to STEP 3 and mark SPLIT.
   - After auto-sort, use `AskUserQuestion` with options:
     *accept-order* or *reorder*. If *reorder*, ask the user for
     the desired sequence and update the plan.
   </step>

5. <step id="STEP 5: Create Work Branch">
   Create a dedicated work branch so acceptance commits do not
   pollute the current branch until the user merges explicitly.

   Run:
   - `git rev-parse --abbrev-ref HEAD` — record the source branch.
   - `AskUserQuestion` — propose a work branch name
     `accept/<YYYY-MM-DD-HHMM>` and let the user override.
   - `git checkout -b <work-branch>` — switch to the work branch.

   Emit the following <template/>:

   <template>
   &#x1F33F; **WORK BRANCH** `<work-branch/>` (from `<source-branch/>`)
   </template>

   Hints:

   - Do *not* stash or reset the uncommitted changes. The work
     branch inherits the working tree and index from the source
     branch — hunks remain available for per-theme staging.
   - If a branch with the proposed name already exists, ask the
     user for a different name.
   </step>

6. <step id="STEP 6: Per-Theme Review Loop">
   Maintain a *queue* of themes in the order from STEP 4. Process
   one theme at a time. Non-accepted themes are handled per the
   chosen option and do not re-enter the queue unless *regroup*ed.

   For each theme in the queue, execute the following sub-cycle:

   6.1. *Stage*. Clear the index with `git reset` (working tree
        preserved), then `git apply --cached <patch-subset>` to
        stage only the hunks assigned to this theme. Verify
        `git diff --staged` matches the planned hunk set.

   6.2. *Isolate the working tree to the post-commit state*.
        Other themes' hunks must not influence the build result.

        Run:
        - `git stash push --keep-index --include-untracked
          --message "accept-isolate-T<n>"`

        Effect: the stash captures every working-tree change
        *not* in the index (i.e. all other themes' hunks and
        untracked files), leaving the working tree byte-equal
        to the index — exactly what the commit will produce.

        Skip this sub-step if `git diff` against the index is
        empty (no other themes' hunks remain). `git stash` with
        nothing to stash fails; guard with a pre-check.

   6.3. *Build-test*. Discover the project build command from,
        in order: `AGENTS.md`, `CLAUDE.md`, `package.json`
        scripts, `Makefile` targets, `Cargo.toml`, `pom.xml`,
        `go.mod`, language-idiomatic defaults. If ambiguous,
        use `AskUserQuestion` with the top candidates plus a
        free-text option. Run the command and capture exit code
        and output. *This exit code represents the true
        post-commit, post-push build result* — no other themes'
        changes interfere.

   6.4. *Decompose the theme into review layers*.

        Partition the theme's staged hunks into an ordered list
        of *layers* `L1, L2, …, Lk`. Layers are a *review-only*
        concept — they are never committed separately.

        Apply these heuristics in order; stop when one produces
        a stable partition:

        - *Path-prefix*: group by top-level directory
          (e.g., `interfaces/`, `domain/`, `service/`, `api/`,
          `ui/`).
        - *Symbol-kind*: separate type declarations,
          implementations, and call-sites.
        - *Dependency direction*: within the theme, order
          layers so later layers reference earlier ones
          (bottom-up) or the reverse (top-down narrative),
          whichever explains the change best.

        Emit the following <template/>:

        <template>
        &#x1F9F1; **LAYERS** in T<n/>: <layer-summary/>
        </template>

        Hints:

        - `<layer-summary/>` is a one-line list
          `L1: <label>, L2: <label>, …` with concise labels
          from the chosen heuristic (e.g.,
          `L1: interfaces, L2: domain, L3: api`).
        - Layer count range: 1 to 5. If exactly one layer
          emerges, skip STEP 6.5 and render the full diff in
          STEP 6.6. More than 5 layers means the theme is too
          broad — recommend *regroup* in STEP 6.7.
        - Review-order is independent from build-order
          (STEP 4). Review-order follows architectural
          comprehension; build-order is already fixed. The
          theme still commits atomically in one `git commit`.
        - Heuristic ambiguity → `AskUserQuestion` with top-two
          partition proposals plus a free-text override.

   6.5. *Walk the layers*.

        Skip this sub-step if STEP 6.4 produced exactly one
        layer.

        For each layer `L<i>` emit one *layer card*. Render all
        cards sequentially in the same response. Do *not* pause
        with `AskUserQuestion` between layers — walkthrough is
        a continuous read-through, the single decision for the
        whole theme comes in STEP 6.7.

        Emit the following <template/> per layer:

        <template>
        &#x1F539; **LAYER L<i/>** of T<n/> · <label/>

        *Why*: <layer-rationale/>
        *Hunks*: <hunk-refs/>
        *Files*: <file-list/>

        <diff-per-file/>
        </template>

        Hints:

        - `<layer-rationale/>` explains what this layer
          contributes to the theme's goal — not merely what
          changed line-wise.
        - `<diff-per-file/>` follows the same format as in
          STEP 6.6 but scoped to this layer's hunks only.
        - No flow diagram at layer level — the full-theme flow
          diagram is reserved for STEP 6.6.
        - This sub-step changes no staging, runs no build,
          asks no questions. Pure review rendering.

   6.6. *Render the decision view*.

        On build *success*, emit the following <template/>:

        <template>
        &#x1F7E2; **THEME T<n/>** · <type/>(<scope/>): <one-liner/>

        *Why*: <rationale/>
        *Hunks*: <hunk-refs/>
        *Files*: <file-list/>
        *Build*: `<build-command/>` — exit 0

        *Flow*:

        <ascii-diagram-as-fenced-code-block/>

        *Diff*: if STEP 6.5 rendered layer cards, reference
        them here with "see layer cards in STEP 6.5 above"
        (diffs already shown per layer); otherwise —
        single-layer theme — include full `<diff-per-file/>`.

        </template>

        On build *failure*, emit the following <template/>:

        <template>
        &#x1F534; **BUILD FAIL** at T<n/> · <type/>(<scope/>): <one-liner/>

        *Hunks*: <hunk-refs/>
        *Files*: <file-list/>
        *Command*: `<build-command/>`
        *Exit*: <exit-code/>
        *Error*:
        ```
        <error-excerpt/>
        ```
        *Likely cause*: <diagnosis/>

        *Diff*: if STEP 6.5 rendered layer cards, reference
        them with "see layer cards in STEP 6.5 above";
        otherwise — single-layer theme — include full
        `<diff-per-file/>` here for diagnosis.

        </template>

        Hints:

        - `<rationale/>` is one or two sentences explaining *why*
          the AI made this change — reconstruct intent from the
          diff.
        - `<ascii-diagram-as-fenced-code-block/>` follows the
          *Diagrams* rules in the skill meta (Unicode
          box-drawing, bottom-up sizing, post-render rectangle
          verification). Keep under 25 lines. Omit if the theme
          is purely textual (docs, comments, constants).
        - `<diff-per-file/>` groups the staged diff *per file*.
          Each file becomes one block of the form:
          a `### <filepath>  (<hunk-refs>)` headline, followed
          by a fenced ```diff``` block containing only that
          file's diff lines. Do not abridge; show full diff
          content per file. Primary rendering location is
          STEP 6.5 layer cards (scoped per layer); this
          decision view only includes full `<diff-per-file/>`
          for single-layer themes where STEP 6.5 was skipped.
          On build failure the same rule applies — diagnose
          against the layer cards above.
        - Do *not* add quality judgements, improvement
          suggestions, or severity-tagged findings. This skill
          curates changes, it does not review them. Use
          `ase-code-lint`, `ase-code-analyze`, or
          `ase-code-audit` for that.

   6.7. *Decide*. Use `AskUserQuestion` with the single-selection
        options matching the build outcome. *Every* branch ends
        by restoring the parked hunks via `git stash pop` (skip
        pop only if 6.2 was skipped).

        On build *success*:

        - *accept* — expand the `ase-code-commit` skill to craft
          a commit message, then `git commit`. `git stash pop`.
          Mark the theme *bisect-safe*. Theme leaves the queue.
        - *skip* — do *not* commit. `git stash pop`, then
          `git reset` (index back to HEAD; popped hunks
          reinstated as working-tree changes). Theme leaves the
          queue.
        - *regroup* — `git stash pop`, `git reset`. Return to
          STEP 3 and reassign this theme's hunks. The new
          theme(s) re-enter the queue at their topologically
          correct position.
        - *defer* — `git stash pop`, `git reset`. Move the theme
          to the *end* of the queue. If on the next iteration
          every remaining theme is in *deferred* state, stop the
          loop and jump to STEP 7.
        - *discard* — *destructive*. Requires a second
          `AskUserQuestion` confirmation (*confirm-discard* vs.
          *cancel*). If confirmed, `git stash pop`, `git reset`,
          then `git checkout -- <files>` for tracked files and
          `rm` for untracked files touched by this theme. Hunks
          are lost. Theme leaves the queue.

        On build *failure*:

        - *retry* — re-run the build without unstashing (e.g.
          after an external fix the user applied to the parked
          stash manually; rare). Prefer *defer* in practice.
        - *defer* — `git stash pop`, `git reset`. Theme to queue
          end.
        - *skip* — `git stash pop`, `git reset`. Hunks back in
          working tree.
        - *regroup* — `git stash pop`, `git reset`. Back to STEP 3.
        - *discard* — destructive, see above.

        *Stash-pop conflict handling*: if `git stash pop` reports
        conflict (rare, only when disjoint-theme assumption
        breaks), pause the loop, emit a diagnostic with the
        conflicting paths, and ask the user to resolve manually
        before resuming. Do not auto-resolve.

   6.8. *Continue* with the next theme in the queue until the
        queue is empty or all remaining themes are deferred.

   Hints:

   - Every committed theme *MUST* build green. Do *not* batch
     commits and verify only at the end — that hides dependency
     defects and breaks `git bisect`.
   - Editing the code to fix a build failure or to change what
     the diff looks like is *out of scope* for this skill. Use
     *defer*, leave the skill, edit (manually or via
     `ase-code-refactor` / `ase-code-elaborate`), then re-enter
     the skill — it will re-manifest the working tree.
   - Never invoke `ase-code-changes` from this skill.
     `CHANGELOG.md` updates belong to a release step, not an
     acceptance step.
   </step>

7. <step id="STEP 7: Final Summary">
   Emit a concise recap of what was produced.

   <template>
   &#x26AA; **ACCEPTANCE SUMMARY**

   *Work branch*: `<work-branch/>` (from `<source-branch/>`)

   <commit-table/>

   *Left in working tree*: <skipped-and-deferred/>
   *Discarded*: <discarded/>
   </template>

   Hints:

   - `<commit-table/>` columns: `T#`, `SHA`, `TYPE`, `SUBJECT`,
     `FILES`, `BUILD`.
   - `BUILD` is `✓` (green, committed) or `✗` (failed, not
     committed).
   - `<skipped-and-deferred/>` lists hunks left uncommitted in
     the working tree, one bullet per theme with reason.
   - `<discarded/>` lists themes the user destructively removed.
   - Do *not* propose further actions (no automatic merge into
     the source branch, no push). The user decides what to do
     with the work branch.
   </step>
</flow>
