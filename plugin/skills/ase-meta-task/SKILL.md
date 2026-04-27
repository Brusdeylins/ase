---
name: ase-meta-task
argument-hint: "<id>"
description: >
    Get or set unique ASE task id.
    Use when user requests to work on a certain task.
user-invocable: true
disable-model-invocation: false
allowed-tools:
    - "Bash(ase config *)"
effort: low
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

1.  Determine request:
    <request>$ARGUMENTS</request>

2.  <if condition="<request/> is NOT empty">
    -   Set: <ase-task-id><request/></ase-task-id>
    -   Execute: `ase config --scope="session:<ase-session-id/>" set task.id "<ase-task-id/>"`
    -   Output:
        <template>
        ASE task id: **<ase-task-id/>** (*updated*)
        </template>
    </if>

3.  <if condition="<request/> is empty">
    -   Output:
        <template>
        ASE task id: **<ase-task-id/>** (*not updated*)
        </template>
    </if>

