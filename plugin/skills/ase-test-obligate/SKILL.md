---
name: ase-test-obligate
argument-hint: "[--help|-h] [--strict|-s] [--next|-n <option>[,...]] [<id>]"
description: >
    Derive the proof obligations of a task plan before implementation.
    Use when the user wants to "obligate", establish the "proof
    obligations", "define the evidence", or fix the "acceptance criteria"
    or "success criteria" of a "task", "plan", or "specification".
user-invocable: true
disable-model-invocation: false
effort: xhigh
allowed-tools:
    - "Skill"
    - "Agent"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-dialog.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<skill name="ase-test-obligate">
Derive the Proof Obligations of a Task Plan
</skill>

<expand name="getopt"
    arg1="ase-test-obligate"
    arg2="--strict|-s --next|-n=(none|DONE|EDIT|PREFLIGHT|IMPLEMENT|PROVE)... --int-reuse-task">
    $ARGUMENTS
</expand>

<objective>
Fix the *proof obligations* of the task plan -- the falsifiable claims,
their implementation-independent oracles, their witnesses, and their
falsifiers -- *before* any implementation exists.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-format-proof.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-tenets-proof.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-proof.md

Procedure
---------

The *entire value* of this skill lies in running *before* the
implementation. Its obligations are derived from the *intent* of the
plan, never from code that already realizes it. You *MUST* therefore
*NOT* read the implementation of the change under any circumstances:
do *NOT* read an `##  IMPLEMENTATION DRAFT` section of <task-content/>,
do *NOT* read an uncommitted working-tree diff, and do *NOT* let a
proposed diff inform *what* is claimed. Reading the *pre-existing*
code base -- to learn its interfaces, its conventions, and how its
tests are written -- is not only permitted but required by STEP 3.

You *MUST* *NOT* call `Edit`, `Write`, `NotebookEdit`, or any
filesystem-modifying tool during this entire skill. The *only*
permitted way to persist artifacts is via `ase_task_save(...)`.

<flow>

1.  <step id="STEP 1: Determine Task">

    1.  Set <instruction><getopt-arguments/></instruction> initially, with any
        leading and trailing whitespace stripped.
        Inherit the always existing <ase-task-id/> from the current context.
        Inherit the always existing <ase-session-id/> from the current context.
        Do not output anything.

    2.  React on task id:

        <expand name="task-react-id" arg1="ase-test-obligate"></expand>

    3.  Determine the current task plan content:

        <expand name="task-load-content"></expand>

    4.  <if condition="<task-content/> is empty">
        Complain and tell the user to use the `ase-code-resolve`,
        `ase-code-refactor`, `ase-code-craft`, or `ase-task-edit` skills
        first to create a task plan. Then immediately *STOP* processing
        this skill.
        </if>

    5.  Locate any pre-existing proof section:

        <expand name="proof-locate-section"></expand>

    6.  <if condition="<proof-present/> is `true`">
        A `##  PROOF` section already exists with <obligation-count/>
        obligations. This run *replaces* it wholesale, because a partial
        merge would let obligations survive that the current plan no
        longer warrants. Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚗ obligations: **<obligation-count/>** existing, ▶ status: **proof section will be replaced**
        </template>
        </if>

    </step>

2.  <step id="STEP 2: Internalize Proof Tenets">

    1.  You *MUST* internalize and strictly honor the **PROOF TENETS**,
        and in particular **Claim Before Code**, **No Self-Reference**,
        and **Coverage of Intent, Not of Lines**, throughout the
        remainder of this skill.

    2.  Do not output anything in this STEP 2.

    </step>

3.  <step id="STEP 3: Establish the Oracle Basis">

    1.  Determine, for the change described by <task-content/>, *where
        truth comes from* -- the sources against which correctness can
        be decided *without* consulting the change. Inspect, as far as
        they exist in this project: the specification and architecture
        artifacts, the interface contracts and docstrings of the
        boundaries the plan touches, the referenced issue or problem
        description, the `CHANGELOG.md`, and the *current, unchanged*
        behavior of the system.

    2.  Determine how tests are executed and selected in this project:

        <expand name="proof-discover-runner"></expand>

    3.  Study *how existing tests in this project are written* -- their
        directory, their naming, their assertion library, their fixture
        style -- so that every witness proposed below reads as if the
        existing tests wrote it, per the **Code Base Alignment** tenet.

    4.  <if condition="<runner-all/> is empty">
        No test execution mechanism could be determined for this
        project. Every obligation would be unexecutable, so the proof
        would be a formality. Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ WARNING: no test runner determined -- witnesses will be unexecutable until a test setup exists
        </template>

        Then continue: the obligations are still worth fixing, and their
        `BLOCKED` status in a later ledger is the honest signal that the
        project needs a test setup.
        </if>

    5.  Do not output anything else in this STEP 3.

    </step>

4.  <step id="STEP 4: Enumerate Claims">

    You *MUST* perform this entire step *internally*, without any
    output.

    1.  Enumerate every bullet of the `##  CHANGES` section of
        <task-content/>, plus the `**WHAT**` statement of its
        `##  CONTEXT` section. These are the *claim candidates*, and
        they are the only admissible origin of an obligation.

    2.  Classify each candidate as either *observable* -- it alters
        what the system does, returns, rejects, emits, persists, or
        exposes -- or *unobservable* -- pure comment, formatting,
        documentation-only, or changelog-only. Record the unobservable
        ones together with the *reason* they cannot be witnessed; they
        become the exemption list of STEP 6.

    3.  For each *observable* candidate, derive one or more falsifiable
        <claim/>s in the language of the *requirement*. Split a
        candidate into several claims wherever it bundles a happy path
        with a rejection path, a boundary, or a contract change --
        one claim per decidable proposition.

    4.  Additionally derive the claims that the candidates *imply* but
        do not state, and which a change of this kind characteristically
        breaks:

        -   For a *resolving* task: the `REGRESSION` claim expressing
            the *original defect's reproducer*, which is the single
            most important obligation of a bug fix.
        -   For a *refactoring* task: the `INVARIANT` claims expressing
            *behavior preservation* across the change, per the
            **Behavior Preservation** tenet.
        -   For a *crafting* task: the `NEGATIVE` and `BOUNDARY` claims
            for the new interface -- invalid input, empty input, and
            the limits of the accepted range.
        -   For any task touching a boundary: the `CONTRACT` claims for
            the signature, schema, or protocol at that boundary.

    5.  For each claim, determine the <kind/>, the <source/> citation,
        the <oracle/>, the <witness/>, the <falsifier-kind/>, the
        <falsifier/>, and the two <signal/> values, strictly per the
        `Proof` <format/>.

    6.  *Audit your own oracles* before proceeding. For every obligation,
        answer internally: "if the implementation were subtly wrong,
        where would this oracle's expected value have come from?" Any
        oracle whose expected value could only be obtained by running
        the changed code violates **No Self-Reference** and *MUST* be
        replaced by a specification value, a hand-computed value, a
        reference implementation, a property, or the unchanged system's
        behavior. If no independent oracle exists for a claim, do *not*
        silently weaken the claim -- keep it and mark its oracle as
        `NONE AVAILABLE: <reason/>`, which STEP 5 will surface.

    7.  *Audit your own falsifiers*. For every obligation, answer
        internally: "does this falsifier negate *the claim*, or does it
        merely damage the code?" Replace every falsifier that would turn
        the whole suite red, break compilation, or fail for a reason
        other than <signal-falsified/>, per the **Targeted Signal**
        tenet.

    8.  Number the surviving obligations `PO1`, `PO2`, ... in the order
        of their source candidates.

    </step>

5.  <step id="STEP 5: Report Obligations">

    <if condition="<ase-project-boxing/> is equal `black`">
    The project source artifacts are classified as a *black box*, so the
    obligations are persisted but *not* surfaced. *Skip* this entire
    STEP 5 without any output and continue with STEP 6.
    </if>

    1.  Determine <weak-count/> as the number of obligations whose
        oracle is `NONE AVAILABLE`, and <unobservable-count/> as the
        number of exempt candidates from STEP 4.2.

    2.  Report the obligations with the following <template/>, listing
        every obligation in order:

        <template>
        <ase-tpl-head title="PROOF OBLIGATIONS"/>

        <ase-tpl-bullet-signal/> **<obligation-id/>** ⟨<kind/>⟩ ⟵ <source/>
        ○   **CLAIM**:     <claim/>
        ○   **ORACLE**:    <oracle/>
        ○   **WITNESS**:   <witness/>
        ○   **FALSIFIER**: ⟨<falsifier-kind/>⟩ <falsifier/>

        [...]

        <ase-tpl-foot title="PROOF OBLIGATIONS"/>
        </template>

    3.  <if condition="<unobservable-count/> is greater than `0`">
        Report the exempt candidates with the following <template/>, so
        that the exemption is *visible* rather than silent:

        <template>
        <ase-tpl-bullet-secondary/> **UNWITNESSED CHANGES** (<unobservable-count/>): *deliberately not observable*
        ○   <candidate/>: <reason/>
        [...]
        </template>
        </if>

    4.  <if condition="<weak-count/> is greater than `0`">
        Output the following <template/>, because an obligation without
        an independent oracle is the precise point where a proof
        silently degenerates into a tautology:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ WARNING: **<weak-count/>** obligation(s) without an implementation-independent oracle
        </template>
        </if>

    5.  <if condition="<getopt-option-strict/> is equal `true` and <weak-count/> is greater than `0`">
        The `--strict` flag forbids persisting a proof section that
        cannot decide truth independently. Only output the following
        <template/> and then immediately *STOP* processing this skill,
        without saving:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-test-obligate**, ▶ ERROR: strict mode -- **<weak-count/>** obligation(s) lack an independent oracle
        </template>

        <ase-tpl-hint level="normal">
        Provide the missing expected values in the specification, or re-run without `--strict` to persist the obligations with their gaps recorded.
        </ase-tpl-hint>
        </if>

    </step>

6.  <step id="STEP 6: Persist Proof Section">

    1.  Render the obligations into a `##  PROOF` section strictly
        following the `Proof` <format/>. Append to it, when
        <unobservable-count/> is greater than `0`, a final bullet
        `-   **EXEMPT**: <candidate/> -- <reason/>` per exempt candidate,
        so the coverage argument of the ledger is complete and auditable.

    2.  Insert this section into <task-content/> *directly after* the
        `##  CHANGES` section and *before* any `##  VERIFICATION`
        section. If a `##  PROOF` section already exists, *replace* that
        entire existing section in place. Never place the proof section
        after an `##  IMPLEMENTATION DRAFT` or `##  PROOF LEDGER`
        section.

    3.  <if condition="<task-content/> contains a `##  PROOF LEDGER` section">
        The obligations have changed, so any existing ledger now
        describes a superseded set of claims and would be read as
        evidence for claims it never tested. *Remove* the entire
        `##  PROOF LEDGER` section from <task-content/> and output the
        following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ status: **stale proof ledger discarded**
        </template>
        </if>

    4.  Save the updated plan:

        <expand name="task-save-content" arg1="proof obligations fixed"></expand>

    5.  Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚗ obligations: **<obligation-count/>** fixed, ▶ status: **proof obligations persisted**
        </template>

    </step>

7.  <step id="STEP 7: Decide Next Step">

    1.  *Determine next step*:

        <expand name="task-next-select"
            arg1="ase-test-obligate"
            arg2="DONE|EDIT|PREFLIGHT|IMPLEMENT|PROVE">
            Next Step: How would you like to proceed with the plan?
            DONE: Stop processing.
            EDIT: Hand processing off to editing.
            PREFLIGHT: Hand processing off to preflight.
            IMPLEMENT: Hand processing off to implementation.
            PROVE: Hand processing off to proving (implementation must already exist).
        </expand>

    2.  Check the tool <result/> and dispatch accordingly:

        -   If <result/> is `DONE` or `CANCEL`:
            Only output the following <template/> and then *STOP*.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚗ obligations: **<obligation-count/>** fixed, ▶ status: **proof obligations fixed -- done**
            </template>

            <ase-tpl-hint level="minimal">
            Run `/ase-task-implement` to realize the plan, then `/ase-test-prove` to discharge the obligations against the implementation.
            </ase-tpl-hint>

        -   If <result/> is `EDIT`, `PREFLIGHT`, `IMPLEMENT`, or `PROVE`:
            Set <args>--int-reuse-task</args>.
            <if condition="<getopt-option-next/> is not equal `none`">
                Set <args><args/> --next <getopt-option-next/></args>
            </if>
            Set <target/> to `ase:ase-task-edit` for `EDIT`,
            `ase:ase-task-preflight` for `PREFLIGHT`,
            `ase:ase-task-implement` for `IMPLEMENT`, and
            `ase:ase-test-prove` for `PROVE`.
            Only output the following <template/> and then call the tool
            `Skill(skill: "<target/>", args: "<args/>")`. Immediately
            stop processing the current skill once the `Skill` tool was
            used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚗ obligations: **<obligation-count/>** fixed, ▶ status: **proof obligations fixed -- hand-off to <result/>**
            </template>

    </step>

</flow>
