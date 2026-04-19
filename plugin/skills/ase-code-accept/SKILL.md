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
build-verified Git commits.

<objective>
*Review* the uncommitted changes at $ARGUMENTS (default: working
tree + index + untracked), *group* hunks by theme, and *produce*
a sequence of bisect-safe commits — each with a meaningful
message and a green build.
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
   </step>

4. <step id="STEP 4: Render Theme Cards">
   For each theme, render a self-contained card that the user
   can read without looking at the raw diff.

   Emit one of the following <template/> per theme:

   <template>
   &#x1F7E0; **THEME CARD** T<n/> · <type/>(<scope/>): <one-liner/>

   *Why*: <rationale/>
   *Hunks*: <hunk-refs/>
   *Files*: <file-list/>
   *Flow*:

   <ascii-diagram-as-fenced-code-block/>
   </template>

   Hints:

   - `<rationale/>` is one or two sentences explaining *why* the
     AI made this change — reconstruct intent from the diff.
   - `<hunk-refs/>` is `H1, H4, H7`-style list.
   - `<ascii-diagram-as-fenced-code-block/>` is a small Unicode
     box-and-arrow diagram showing the theme's data or control
     flow (how the changed pieces interact). Follow the
     *Diagrams* rules in the skill meta (Unicode box-drawing,
     bottom-up sizing, post-render rectangle verification).
     Keep diagrams under 25 lines. Omit entirely if the theme
     is purely textual (docs, comments, constants).
   - Apply the *Findings* rules from the skill meta:
     evidence-grounded (cite exact hunk ids), contract-
     already-addressed (downgrade if existing contract already
     covers the intent), performance-cost reality check.
   </step>

5. <step id="STEP 5: Confirm Themes Interactively">
   Let the user *interactively confirm* each theme. Use the
   `AskUserQuestion` tool with single-selection per theme.

   Options per theme:
   - *accept* — keep theme as-is.
   - *merge* — fold into another theme; ask which.
   - *split* — divide into two sub-themes; ask for new titles.
   - *drop* — abandon these hunks (leave in working tree,
     not staged).
   - *reassign* — move specific hunks to a different theme.

   Loop until all themes are in state *accept* or *drop*.
   </step>

6. <step id="STEP 6: Plan Staging Order">
   Determine a *topological order* over the accepted themes so
   each theme can build independently given the previous ones.

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
     patch subset against the current index state. If the dry
     run fails, either reorder or flag as SPLIT and return to
     STEP 3.
   </step>

7. <step id="STEP 7: Stage, Commit, and Verify Build">
   For *each* theme in the planned order, execute the full
   per-theme cycle:

   1. `git reset` to clear the index (first theme) or leave
      previous commits in place (subsequent themes).
   2. `git apply --cached <patch-subset>` — stage only the
      hunks assigned to this theme.
   3. Verify `git diff --staged` matches the planned hunk set.
   4. Expand the `ase-code-commit` skill to generate the commit
      message for the staged bucket.
   5. `git commit`.
   6. *Run the project build command*. Discover it from, in
      order: `AGENTS.md`, `CLAUDE.md`, `package.json` scripts,
      `Makefile` targets, `Cargo.toml`, `pom.xml`, `go.mod`,
      language-idiomatic defaults. If ambiguous, use
      `AskUserQuestion` with the top candidates plus a free-
      text option.
   7. If build *fails*, emit the following <template/>:

      <template>
      &#x1F7E0; **BUILD FAIL** at T<n/> (<type/>: <one-liner/>)

      *Command*: `<build-command/>`
      *Exit*: <exit-code/>
      *Error*:
      ```
      <error-excerpt/>
      ```
      *Likely cause*: <diagnosis/>
      *Suggestion*: <suggestion/>
      </template>

      Then `AskUserQuestion` with options:
      - *amend* — add missing hunks to this commit.
      - *squash-previous* — merge with the previous commit.
      - *drop* — `git reset --soft HEAD~1` and abandon this
        theme.
      - *manual-fix* — pause, let user resolve, then continue.

      Loop until the build returns exit 0.
   8. On success, mark the commit *bisect-safe* and continue
      with the next theme.

   Hints:

   - Every intermediate commit *MUST* build green before the
     next one is staged. Do not batch commits and verify only
     at the end — that hides dependency defects.
   - If `git apply --check` fails during stage-attempt, abort
     the whole cycle and return to STEP 6 to replan ordering.
   </step>

8. <step id="STEP 8: Final Summary">
   Emit a concise recap of what was produced.

   <template>
   &#x26AA; **ACCEPTANCE SUMMARY**

   <commit-table/>

   *Leftover*: <leftover-hunks/>
   </template>

   Hints:

   - `<commit-table/>` columns: `T#`, `SHA`, `TYPE`, `SUBJECT`,
     `FILES`, `BUILD`.
   - `BUILD` is `✓` (green) or `✗` (failed and retried).
   - `<leftover-hunks/>` lists any hunks dropped or left in the
     working tree, one bullet per hunk with reason.
   - Do *not* propose further actions; the user decides what to
     do with leftovers.
   </step>
</flow>
