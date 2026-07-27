---
name: ase-test-prove
argument-hint: "[--help|-h] [--infer|-i] [--no-falsify] [--next|-n <option>[,...]] [<id>]"
description: >
    Discharge the proof obligations of a task plan against the actual
    implementation by executing each witness and empirically falsifying
    it, then emit a PROVEN / NOT PROVEN verdict. Use when the user wants
    the implementation "proven", the tests "verified", the evidence
    "delivered", or asks whether the change is "really correct".
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

<skill name="ase-test-prove">
Prove a Task Plan Implementation
</skill>

<expand name="getopt"
    arg1="ase-test-prove"
    arg2="--infer|-i --no-falsify --next|-n=(none|DONE|EDIT|RESOLVE)... --int-reuse-task">
    $ARGUMENTS
</expand>

<objective>
*Discharge* the proof obligations of the task plan against the *actual*
implementation: execute each witness, *empirically falsify* it, and emit
a `PROVEN` / `NOT PROVEN` verdict backed by captured transcripts.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-format-proof.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-tenets-proof.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-task.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-common-proof.md

Procedure
---------

This skill *observes*; it does not repair. You *MUST* *NOT* fix a
failing implementation, rewrite a witness to make it pass, weaken an
assertion, relax an expected value, or add production code during this
entire skill, per the **Least Disturbance** tenet. The *only* files this
skill may modify are those it modifies *as a falsifier* and *restores*
immediately afterwards, plus the task plan via `ase_task_save(...)`.

A `NOT PROVEN` verdict is a *successful* run of this skill. Never soften
it, never reframe it, and never let a summarizing sentence contradict
the table it summarizes.

<flow>

1.  <step id="STEP 1: Determine Task and Obligations">

    1.  Set <instruction><getopt-arguments/></instruction> initially, with any
        leading and trailing whitespace stripped.
        Inherit the always existing <ase-task-id/> from the current context.
        Inherit the always existing <ase-session-id/> from the current context.
        Do not output anything.

    2.  React on task id:

        <expand name="task-react-id" arg1="ase-test-prove"></expand>

    3.  Determine the current task plan content:

        <expand name="task-load-content"></expand>

    4.  <if condition="<task-content/> is empty">
        Complain and tell the user to use the `ase-code-resolve`,
        `ase-code-refactor`, `ase-code-craft`, or `ase-task-edit` skills
        first to create a task plan. Then immediately *STOP* processing
        this skill.
        </if>

    5.  Locate the proof section:

        <expand name="proof-locate-section"></expand>

    6.  <if condition="<proof-present/> is `false` and <getopt-option-infer/> is not equal `true`">
        Without obligations there is nothing to discharge, and deriving
        them *now* -- with the implementation already in front of you --
        would violate the **Claim Before Code** tenet, which is the
        entire reason this mechanism exists. Only output the following
        <template/> and then immediately *STOP* processing this skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-test-prove**, ▶ ERROR: no `PROOF` section in plan **<ase-task-id/>**
        </template>

        <ase-tpl-hint level="minimal">
        Run `/ase-test-obligate` to fix the proof obligations -- ideally *before* implementing. Use `--infer` to derive them late, from the plan text only, accepting the weaker guarantee.
        </ase-tpl-hint>
        </if>

    7.  <if condition="<proof-present/> is `false` and <getopt-option-infer/> is equal `true`">
        The obligations are derived *late*. You *MUST* derive them from
        the `##  CONTEXT` and `##  CHANGES` sections of <task-content/>
        *alone*, and you *MUST* *NOT* consult the implementation diff,
        the `##  IMPLEMENTATION DRAFT` section, or the changed source
        files while choosing *what* is claimed and *what value* the
        oracle expects. Delegate this derivation to the
        `ase:ase-test-obligate` skill by calling the tool
        `Skill(skill: "ase:ase-test-obligate", args: "--int-reuse-task --next DONE")`,
        then reload the plan and re-expand `proof-locate-section`.
        Record <late-derivation>true</late-derivation> so the ledger
        states that the obligations were fixed after the fact.
        </if>

    8.  <if condition="<obligation-count/> is `0`">
        Only output the following <template/> and then immediately
        *STOP* processing this skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-test-prove**, ▶ ERROR: `PROOF` section contains no obligations
        </template>
        </if>

    9.  Parse <proof-section/> into the ordered obligation list
        <obligations/>, each carrying its <obligation-id/>, <kind/>,
        <source/>, <claim/>, <oracle/>, <witness/>, <falsifier-kind/>,
        <falsifier/>, <signal-pass/>, and <signal-falsified/>. Also
        parse the `EXEMPT` bullets into <exemptions/>.

    </step>

2.  <step id="STEP 2: Internalize Proof Tenets">

    1.  You *MUST* internalize and strictly honor the **PROOF TENETS**,
        and in particular **Evidence Over Assertion**, **Baseline
        Sanctity**, **One Falsifier At A Time**, and **Honest Verdict**,
        throughout the remainder of this skill.

    2.  Do not output anything in this STEP 2.

    </step>

3.  <step id="STEP 3: Establish Execution Context">

    1.  Determine how tests are executed and selected in this project:

        <expand name="proof-discover-runner"></expand>

    2.  <if condition="<runner-all/> is empty">
        No witness can be executed, so no obligation can reach `PROVEN`.
        Set the status of *every* obligation to `BLOCKED` with the
        finding `no test runner determined for this project`, set
        <verdict>NOT PROVEN</verdict>, set <baseline>restored</baseline>
        (nothing was touched), and continue *directly* to STEP 6. Do
        *not* capture a baseline and do *not* apply any falsifier.
        </if>

    3.  Determine the *change under test* -- the set of files the
        implementation modified -- by inspecting the working tree
        against its last committed state, and record it as
        <changed-files/>. This set defines what a `REVERT` falsifier
        reverses, so it *MUST* be established before any falsifier runs.

    4.  Determine the *witness completeness*: for every obligation,
        check whether its <witness/> test case *exists*. Record the
        obligations whose witness is absent into <missing-witnesses/>;
        they will be `BLOCKED`, since a claim without an executable
        witness cannot be evidence.

    5.  <if condition="<missing-witnesses/> is not empty">
        Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ WARNING: **<n/>** obligation(s) have no witness test case -- the implementation is incomplete
        </template>
        </if>

    6.  Do not output anything else in this STEP 3.

    </step>

4.  <step id="STEP 4: Establish Baseline">

    1.  <if condition="<getopt-option-no-falsify/> is equal `true`">
        No falsifier will be applied, so no file will be modified.
        *Skip* the baseline capture entirely, set
        <baseline>restored</baseline>, and continue with STEP 5.
        </if>

    2.  Capture the pre-run state of the working tree:

        <expand name="proof-capture-baseline"></expand>

    3.  Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⌘ baseline: **<baseline-mode/>** anchor captured, ▶ status: **working tree secured**
        </template>

    </step>

5.  <step id="STEP 5: Discharge Obligations">

    First, use the following <template/> to give a hint on this step:

    <template>
    <ase-tpl-bullet-secondary/> **PROOF EXECUTION**
    </template>

    Process the obligations in <obligations/> *strictly one at a time*,
    in order. For each obligation, perform the following sub-steps
    completely -- *including the restoration* -- before starting the
    next one, per the **One Falsifier At A Time** tenet.

    1.  <if condition="this obligation is in <missing-witnesses/>">
        Set its <status>BLOCKED</status> and its <finding/> to the test
        case that the implementation must add in order to carry this
        claim. Set <positive/> and <falsified/> to `n/a`. *Skip* the
        remaining sub-steps for this obligation and continue with the
        next one.
        </if>

    2.  **Positive run.** Set <cmd/> to the command that runs *only*
        this obligation's witness, derived from <runner-one/> and the
        witness selector, and execute it:

        <expand name="proof-run-capture"></expand>

        Set <positive/> to `exit=<observed-exit/>, <observed-signal/>`
        and retain <transcript/> as this obligation's positive
        transcript.

    3.  **Determinism check.** Re-run the *same* <cmd/> once more and
        compare the outcome. If the two outcomes differ, the witness is
        unstable and cannot testify: set its <status>BLOCKED</status>,
        set its <finding/> to the observed instability and the suspected
        source (timing, ordering, clock, randomness, shared state), and
        *skip* the falsification for this obligation, continuing with
        the next one.

    4.  <if condition="the positive run did not produce <signal-pass/>">
        Set its <status>FAILED</status> and its <finding/> to what the
        implementation does instead of what the claim requires. Do *not*
        falsify a witness that is already red -- a red-under-falsifier
        result would carry no information. *Skip* the remaining
        sub-steps for this obligation and continue with the next one.
        </if>

    5.  <if condition="<getopt-option-no-falsify/> is equal `true`">
        Set <falsified/> to `skipped` and set its
        <status>BLOCKED</status> with the finding `falsification
        skipped -- witness sensitivity unproven`. A witness that was
        never falsified is *not* evidence, so it never reaches `PROVEN`.
        *Skip* the remaining sub-steps for this obligation and continue
        with the next one.
        </if>

    6.  **Apply the falsifier.** Apply *exactly* the <falsifier/> stated
        by this obligation, and *nothing else*:

        -   For <falsifier-kind/> `REVERT`: reverse-apply the change
            hunks of the stated files, keeping the *witness itself*
            untouched -- reverting the test alongside the code would
            make the run green again and prove nothing.
        -   For <falsifier-kind/> `MUTATE`: replace the stated verbatim
            <old-text/> at the stated `<file/>:<line/>` with the stated
            verbatim <new-text/>, and nothing else.
        -   For <falsifier-kind/> `PERTURB`: substitute the stated input
            or expectation, and nothing else.

        Record the applied files into the restore journal *before*
        running anything, so an interruption remains recoverable.

    7.  **Falsified run.** Execute the *same* <cmd/> as in sub-step 2:

        <expand name="proof-run-capture"></expand>

        Set <falsified/> to `exit=<observed-exit/>, <observed-signal/>`
        and retain <transcript/> as this obligation's falsified
        transcript.

    8.  **Restore, always.** Immediately undo the falsifier and verify
        the undo, *regardless* of the outcome of sub-step 7:

        <expand name="proof-restore-baseline"></expand>

    9.  **Judge.** Determine the <status/> of this obligation:

        -   If the falsified run produced <signal-falsified/> -- the
            witness failed, *for the reason the claim predicts* -- set
            <status>PROVEN</status> and set <finding/> to what the
            evidence shows.

        -   If the falsified run *passed*, set <status>VACUOUS</status>.
            Set <finding/> to the *precise insensitivity*: which
            assertion is missing, too weak, or watching the wrong value,
            such that the witness cannot detect the absence of the
            claimed behavior. This is the most valuable finding this
            skill produces, so state it plainly rather than gently.

        -   If the falsified run failed for a reason *other* than
            <signal-falsified/> -- a compile error, an unrelated
            cascade, an infrastructure failure -- set
            <status>BLOCKED</status> and set <finding/> to the fact that
            the falsifier was too coarse to isolate the claim, together
            with the narrower falsifier that would isolate it. A crude
            falsifier proves nothing about the witness, per the
            **Targeted Signal** tenet.

    10. Output the per-obligation progress with the following
        <template/>:

        <template>
        ○   **<obligation-id/>** ⟨<kind/>⟩: <status/>
        </template>

    </step>

6.  <step id="STEP 6: Judge Coverage and Verdict">

    1.  *Audit the coverage of intent*: for every bullet of the
        `##  CHANGES` section of <task-content/>, check whether it is
        the <source/> of at least one obligation, or whether it is
        listed in <exemptions/>. Record every bullet that is neither
        into <uncovered/> -- a behavior-altering change nobody claimed
        is exactly the gap this mechanism exists to expose.

    2.  Count <proven/>, <vacuous/>, <failed/>, and <blocked/> across
        all obligations, and set <total/> to <obligation-count/>.

    3.  Determine the <verdict/>: set <verdict>PROVEN</verdict> *if and
        only if* <proven/> equals <total/>, <uncovered/> is empty, and
        <baseline/> is `restored`. Otherwise set
        <verdict>NOT PROVEN</verdict>. You *MUST* *NOT* apply any other
        rule, threshold, or judgment to this decision.

    4.  <if condition="<late-derivation/> is `true`">
        Set <caveat/> to `obligations derived after implementation
        (--infer) -- weaker guarantee than claim-before-code` and carry
        it into the ledger. A late-derived proof is worth less than an
        early one, and the ledger *MUST* say so.
        </if>

    </step>

7.  <step id="STEP 7: Report and Persist Ledger">

    1.  <if condition="<ase-project-boxing/> is equal `black`">
        Report only the *outcome*, with no evidence and no findings, by
        outputting the following <template/>, then continue with
        sub-step 4:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚖ verdict: **<verdict/>**
        </template>
        </if>

    2.  Report the result with the following <template/>, rendering one
        table row per obligation and one evidence block per obligation
        whose <status/> is *not* `PROVEN` (and, when
        <ase-project-boxing/> is `white`, for every obligation):

        <template>
        <ase-tpl-head title="PROOF LEDGER"/>

        <ase-tpl-bullet-signal/> **VERDICT**: **<verdict/>** -- <proven/>/<total/> proven, <vacuous/> vacuous, <failed/> failed, <blocked/> blocked

        | ID | KIND | POSITIVE | FALSIFIED | STATUS |
        | -- | ---- | -------- | --------- | ------ |
        | <obligation-id/> | <kind/> | <positive/> | <falsified/> | <status/> |

        <ase-tpl-bullet-secondary/> **EVIDENCE**

        ●   **<obligation-id/>** ⟨<status/>⟩: <finding/>

        ```text
        <transcript/>
        ```

        <ase-tpl-foot title="PROOF LEDGER"/>
        </template>

        Honor the *Markdown Tables* alignment rule of `ase-skill.md` for
        the table above.

    3.  <if condition="<uncovered/> is not empty">
        Output the following <template/>, listing each uncovered
        `CHANGES` bullet:

        <template>
        <ase-tpl-bullet-signal/> **UNCLAIMED CHANGES**: *behavior-altering changes with no obligation*
        ●   <changes-bullet/>
        [...]
        </template>
        </if>

    4.  Render the `##  PROOF LEDGER` section strictly following the
        `Proof Ledger` <format/>, including <caveat/> when set, and
        insert it at the *end* of <task-content/>. If such a section
        already exists, *replace* it entirely.

    5.  Save the updated plan:

        <expand name="task-save-content" arg1="proof ledger recorded"></expand>

    6.  Output the following <template/>:

        <template>
        ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚖ verdict: **<verdict/>**, ⌘ baseline: **<baseline/>**, ▶ status: **proof ledger persisted**
        </template>

    </step>

8.  <step id="STEP 8: Decide Next Step">

    1.  <if condition="<verdict/> is equal `PROVEN`">

        *Determine next step*:

        <expand name="task-next-select"
            arg1="ase-test-prove"
            arg2="DONE|EDIT">
            Next Step: The implementation is proven. How would you like to proceed?
            DONE: Stop processing.
            EDIT: Hand processing off to editing the plan.
        </expand>

        </if>
        <else>

        The verdict is `NOT PROVEN`, so the honest next steps are to
        *repair* rather than to conclude.

        <expand name="task-next-select"
            arg1="ase-test-prove"
            arg2="DONE|EDIT|RESOLVE">
            Next Step: The implementation is NOT proven. How would you like to proceed?
            DONE: Stop processing and keep the ledger as-is.
            EDIT: Hand processing off to editing the plan.
            RESOLVE: Hand processing off to resolving the strongest finding.
        </expand>

        </else>

    2.  Check the tool <result/> and dispatch accordingly:

        -   If <result/> is `DONE` or `CANCEL`:
            Only output the following <template/> and then *STOP*.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚖ verdict: **<verdict/>**, ▶ status: **proof completed -- done**
            </template>

            <ase-tpl-hint level="normal">
            Run `/ase-test-audit` to have the proof itself critiqued for tautological oracles and insensitive witnesses.
            </ase-tpl-hint>

        -   If <result/> is `EDIT`:
            Set <args>--int-reuse-task</args>.
            <if condition="<getopt-option-next/> is not equal `none`">
                Set <args><args/> --next <getopt-option-next/></args>
            </if>
            Only output the following <template/> and then call the tool
            `Skill(skill: "ase:ase-task-edit", args: "<args/>")`.
            Immediately stop processing the current skill once the
            `Skill` tool was used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚖ verdict: **<verdict/>**, ▶ status: **proof completed -- hand-off to edit**
            </template>

        -   If <result/> is `RESOLVE`:
            Set <problem/> to the *strongest* finding of the ledger,
            selecting in this order of precedence: the first `FAILED`
            obligation (the implementation is wrong), else the first
            `VACUOUS` obligation (the witness is blind), else the first
            `BLOCKED` obligation, else the first uncovered `CHANGES`
            bullet. Phrase <problem/> as the concrete defect plus its
            cited location.
            Only output the following <template/> and then call the tool
            `Skill(skill: "ase:ase-code-resolve", args: "<problem/>")`.
            Immediately stop processing the current skill once the
            `Skill` tool was used.

            <template>
            ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ⚖ verdict: **<verdict/>**, ▶ status: **proof completed -- hand-off to resolve**
            </template>

    </step>

</flow>
