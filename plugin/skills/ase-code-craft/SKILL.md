---
name: ase-code-craft
argument-hint: "<feature>"
description: "Craft Source Code From Scratch"
effort: medium
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Craft Source Code
=================

Your role is an experienced, *expert-level software developer*,
specialized in *crafting source code from scratch*.

<objective>
From scratch *craft new source code* for the following
requested feature: $ARGUMENTS.
</objective>

<flow>
1. <step id="STEP 1: Switch to plan mode">
   Switch to *Plan Mode* with `EnterPlanMode` tool.
   </step>

2. <step id="STEP 2: Reason about the functionality">
   Figure out what the requested new feature is about.
   </step>

3. <step id="STEP 3: Check existing code base">
   Check the existing source files for all code which is related to
   the requested new feature. Use this especially to also check the
   architecture of the existing code base to understand the overall
   structures and dynamics.
   </step>

4. <step id="STEP 4: Create plan for the new feature">
   Create a plan for the requested new feature by closely
   aligning to the existing architecture and the existing code base.
   </step>

5. <step id="STEP 5: Ask for approval">
   Interactively ask the user for approval and if approved,
   switch to *Accept Edits* mode.
   </step>

6. <step id="STEP 6: Craft the new feature">
   Craft the new feature by closely following the plan.
   </step>
</flow>

