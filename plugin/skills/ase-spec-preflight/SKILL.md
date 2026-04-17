---
name: ase-spec-preflight
argument-hint: "<feature-id>"
description: "Edit a stand-alone feature specification."
user-invocable: true
disable-model-invocation: false
effort: high
allowed-tools:
    - "Bash(date)"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Preflight a Feature Specification
=================================

Your role is an experienced, *expert-level software developer*,
specialized in the *implementation* of IT systems.

<objective>
*Preflight* the *feature specification* of an IT system by creating a
draft for a corresponding, *complete source code change set*.
</objective>

<flow>
1. <step id="STEP 1: Determine Operation">
   - The first word of "$ARGUMENTS" is the unique <feature-id/> of the
     specification.

   - Derive the specification file
     <feature-filename/> from `<feature-id/>.md`.

   - If the <feature-filename/> DOES STILL NOT exist, 
     complain and tell the user to use the `ase-spec-edit <feature-id/>`
     skill first.

   - If the <feature-filename/> exists, read this artifact
     for the specification of the feature to be implemented.
   </step>

2. <step id="STEP 2: Create Implementation Draft">
   Perform a *preflight* of the *feature specification* by creating a
   draft for a corresponding, *complete source code change set*
   which would fully implement the feature. Append this source
   code change set as a complete <unified-diff/> to the end
   of the <feature-filename/> with the following <template/>:

   <template>

   ## ≡ IMPLEMENTATION DRAFT

   ```
   <unified-diff/>
   ```
   </template>

   Hints:

   - If a section named `## ≡ IMPLEMENTATION DRAFT` already exists from
     a previous run of this skill, update this existing section.

   - On modifying <feature-filename/>, set the "modified": timestamp to
     the current timestamp in the ISO-style format `YYYY-mm-dd HH:MM`
     which can be determined with `date "+%Y-%m-%d %H:%M"`.
   </step>
</flow>

