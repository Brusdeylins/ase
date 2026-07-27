---
name: ase-test-audit
argument-hint: "[--help|-h] [--severity|-S=(LOW|MEDIUM|HIGH)] [--scope|-c=(plan|suite)] [<id>]"
description: >
    Audit the evidentiary quality of tests and proof obligations -
    detecting tautological oracles, insensitive assertions, and tests
    that merely restate the implementation. Use when the user asks
    whether the tests "actually prove" anything, wants the tests
    "audited", "critiqued", or asks if a test "can even fail".
user-invocable: true
disable-model-invocation: false
effort: high
allowed-tools:
    - "Agent"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-control.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-getopt.md

<skill name="ase-test-audit">
Audit the Evidentiary Quality of Tests
</skill>

<expand name="getopt"
    arg1="ase-test-audit"
    arg2="--severity|-S=(LOW|MEDIUM|HIGH) --scope|-c=(plan|suite)">
    $ARGUMENTS
</expand>

<objective>
Judge whether the tests and proof obligations at hand *can prove
anything at all* -- exposing tautological oracles, insensitive
assertions, mirrored implementations, and claims that no witness
actually decides.
</objective>

@${CLAUDE_SKILL_DIR}/../../meta/ase-format-proof.md
@${CLAUDE_SKILL_DIR}/../../meta/ase-tenets-proof.md

Procedure
---------

This skill is a *static* critique of evidentiary quality: it reads,
reasons, and reports. It executes no test, applies no falsifier, and
modifies no file. Where it *suspects* insensitivity, it names the
falsifier that would settle the question empirically, and defers that
execution to `ase-test-prove`.

<flow>

1.  <step id="STEP 1: Determine Audit Scope">

    1.  Inherit the always existing <ase-task-id/> from the current
        context. If <getopt-arguments/> is a valid task id, set
        <ase-task-id/> to it. Do not output anything.

    2.  <if condition="<getopt-option-scope/> is equal `plan`">
        Set <audit-target/> to the `##  PROOF` and `##  VERIFICATION`
        sections of the task plan <ase-task-id/> together with the test
        cases they cite. Load the plan by calling the
        `ase_task_load(id: "<ase-task-id/>")` tool of the `ase` MCP
        server and set <task-content/> to its `text` output field.

        <if condition="<task-content/> starts with `ERROR:` or `WARNING:`">
        Only output the following <template/> and then immediately
        *STOP* processing this skill:

        <template>
        ⧉ **ASE**: ☻ skill: **ase-test-audit**, ▶ ERROR: no task plan **<ase-task-id/>** to audit
        </template>
        </if>
        </if>
        <else>
        Set <audit-target/> to the *test suite* of the project, or to
        the subset of it that the free-text <getopt-arguments/> names.
        </else>

    </step>

2.  <step id="STEP 2: Internalize Proof Tenets">

    1.  You *MUST* internalize and strictly honor the **PROOF TENETS**,
        and in particular **No Self-Reference**, **Falsifiability Is
        Mandatory**, and **Coverage of Intent, Not of Lines**, when
        judging in the following.

    2.  Do not output anything in this STEP 2.

    </step>

3.  <step id="STEP 3: Audit Investigation">

    <if condition="<ase-project-boxing/> is equal `black`">
    The project source artifacts are classified as a *black box*, so the
    tests are not scrutinized and no findings are surfaced. *Skip* the
    entire investigation: do *not* invoke the `Agent` tool, set
    <findings/> to the *empty* list, set <verdict/> to
    `SKIPPED (boxing: black)`, set <summary/> to a *one-line* neutral
    restatement of the audit scope, and proceed *directly* to STEP 4.
    </if>

    First, use the following <template/> to give a hint on this step:

    <template>
    <ase-tpl-bullet-secondary/> **AUDIT INVESTIGATION**
    </template>

    Dispatch the audit investigation to a *sub-agent* via the `Agent`
    tool so that *no* investigation details leak into the user-visible
    transcript. The sub-agent performs the silent reading and the
    critique; only its final structured return value is consumed here.

    For this, invoke *exactly once* the tool:

    ```text
        Agent(
            description:       "Test Evidence Audit",
            subagent_type:     "ase:ase-test-audit",
            prompt:            "Audit the evidentiary quality of: <audit-target/>",
            run_in_background: false
        )
    ```

    Parse the single result message of the `Agent` tool as a JSON
    object, set <summary/> to its `summary` field (a single crisp
    sentence stating what the audited evidence can and cannot prove),
    and set <findings/> to its `findings` field (a list).

    Then *derive* the overall <verdict/> from <findings/>: set
    <verdict/> to `EVIDENCE INSUFFICIENT` if *any* finding in
    <findings/> has a `severity` field of `HIGH`; otherwise set
    <verdict/> to `EVIDENCE SOUND`. The verdict is derived *before* the
    severity floor below, so the floor only affects which findings are
    *rendered*, never the verdict.

    Then determine the *effective severity floor* <floor/>: define the
    ordinal rank `LOW`=1, `MEDIUM`=2, `HIGH`=3, and set <floor/> to
    <getopt-option-severity/> (default `LOW`). Findings with a severity
    rank below <floor/> are *not* rendered in STEP 4; findings of
    severity `ACCEPTED` are rendered regardless of the floor, because
    their traceability is their entire purpose.

    </step>

4.  <step id="STEP 4: Report Findings">

    1.  Sort <findings/> by descending severity rank, and within equal
        severity by their `dimension` in the fixed dimension order.

    2.  Report the audit with the following <template/>:

        <template>
        <ase-tpl-head title="EVIDENCE AUDIT"/>

        <ase-tpl-bullet-signal/> **VERDICT**: **<verdict/>**
        <ase-tpl-bullet-secondary/> **SCOPE**: *<summary/>*

        ●   ⟨<severity/>⟩ **<dimension/>** @ `<location/>`
        ○   <finding/>
        ○   *REPAIR*: <repair/>

        [...]

        <ase-tpl-foot title="EVIDENCE AUDIT"/>
        </template>

    3.  <if condition="<findings/> rendered is empty">
        Output the following <template/> instead of the finding entries:

        <template>
        <ase-tpl-bullet-secondary/> *No findings at or above severity <floor/>.*
        </template>
        </if>

    4.  <ase-tpl-hint level="minimal">
    Run `/ase-test-prove` to settle every suspected insensitivity empirically -- an audit suspects, only a falsifier decides.
    </ase-tpl-hint>

    <ase-tpl-hint level="verbose">
    Use `--scope suite` to audit the whole test suite rather than the current plan, and `--severity HIGH` to see blocking findings only.
    </ase-tpl-hint>

    </step>

</flow>
