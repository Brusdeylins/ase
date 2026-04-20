---
name: ase-code-refactor
argument-hint: "<refactor-hint>"
description: >
    Refactor Source Code.
user-invocable: true
disable-model-invocation: false
context: fork
effort: medium
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Refactor Source Code
====================

Your role is an experienced, *expert-level software developer*,
specialized in *refactoring source code*.

<objective>
*Refactor* existing source code the following way: $ARGUMENTS.
</objective>

<flow>
1. <step id="STEP 1: Reason about the refactoring">
   Enter *Plan Mode* with the `EnterPlanMode` tool.
   Figure out what the requested refactoring is about.
   </step>

2. <step id="STEP 2: Check existing code base">
   Check the existing source files for all code which is related to the
   requested refactoring.
   </step>

3. <step id="STEP 3: Check existing architecture">
   Check the architecture of the existing code base to understand the
   overall structures and dynamics.
   </step>

4. <step id="STEP 4: Refactor the existing code">
   Refactor the existing code the requested way by still closely
   aligning to the existing architecture and the existing code base.
   </step>

5. <step id="STEP 5: Ensure cleanness of code base">
   Lint the entire code base to ensure that everything is still sane.
   </step>
</flow>

