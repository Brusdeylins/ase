---
name: optimizer
argument-hint: "[-i <id>] <context>"
description: >
    Resolve problems.
user-invocable: true
disable-model-invocation: false
allowed-tools:
    - "Bash(ase meta *)"
---

!`ase meta control skill getopt`

<purpose name="optimizer">
Analyze and Resolve Source Code Problems
</purpose>

<expand name="getopt"
    arg1="optimizer"
    arg2="--id|-i <id>=optimizer">
    $ARGUMENTS
</expand>

<flow>

1.  <step id="STEP 1: Analyze Code">

    <agent description="Analyze Code"
        subagent_type="general-purpose"
        model="opus"
        run_in_background=false>

        Run <skill name="ase-code-analyze" args="--prefix <id/> <getopt-arguments/>"/>

        Return the problem ids and their one-line findings, nothing else.

        Think hard about this.

    </agent>

    </step>

2.  <step id="STEP 2: Resolve Code Problems">

    <parallel>

    For each `P<n/>` in the result set, in ascending order and strictly *one at a time*:

    1.  Call the Agent:

        <agent description="Resolve P<n/>"
            subagent_type="general-purpose"
            isolation="worktree"
            model="sonnet"
            run_in_background=true>

            1.  Run <skill name="ase:ase-code-resolve" args="-a <id/>-P<n/>"/>

            2.  Run <skill name="ase:ase-task-implement" args="<id/>-P<n/>"/>

            3.  Run <skill name="ase:ase-task-delete" args="<id/>-P<n/>"/>

            4.  Return the touched files and the applied fix, telegraphically,
                one clause per fact, nothing else.

            Think hard about this.

        </agent>

    </parallel>

    </step>

3.  <step id="STEP 3: Result Consolidation">

    <agent-consolidation/>

    </step>

</flow>

