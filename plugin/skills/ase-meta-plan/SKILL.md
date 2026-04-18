---
name: ase-meta-plan
argument-hint: "<plan-id>"
description: "XXX"
user-invocable: false
disable-model-invocation: false
effort: medium
allowed-tools:
    - "Bash(ase:*)"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Plan a Task
===========

Your role is an experienced, *expert-level assistant*,
specialized in *Claude Code plan mode*.

<objective>
*Plan* a task in Claude Code *plan mode*.
</objective>

Setup
-----

-  The plan storage directory <plan-dir/> is:
   !`ase plan ensure`

-  The unique plan id <plan-id/> is given to this skill as:
   "$ARGUMENTS"

-  The unique plan file <plan-file/> is:
   <plan-dir/>`/`<plan-id/>`.md`

Action
------

Perform the following actions in sequence:

-  Enter *plan mode* by using the `EnterPlanMode` tool.

-  Use the `stdout` of the following command to load the plan contents:
   `ase plan load "`<plan-id/>`"`

-  Once the user leaves *plan mode* by using the `ExitPlanMode` tool,
   always *save* the current plan to <plan-file/> before proceeding
   with the execution of the plan by sending the plan contents to
   `stdin` of the following command:
   `ase plan save "`<plan-id/>`"`

