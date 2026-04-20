---
name: ase-spec-implement
argument-hint: "<feature-id>"
description: >
    Implement a stand-alone feature specification.
user-invocable: true
disable-model-invocation: false
effort: xhigh
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Implement a Feature Specification
=================================

Your role is an experienced, *expert-level software developer*,
specialized in the *implementation* of IT systems.

<objective>
*Implement* the *feature specification* of an IT system by modifying the
*source code* with a corresponding, complete *change set*.
</objective>

<flow>
1. <step id="STEP 1: Determine Operation">
   -  The first word of "$ARGUMENTS" is the unique <feature-id/> of the
      specification.

   -  Derive the specification file
      <feature-filename/> from `<feature-id/>.md`.

   -  If the <feature-filename/> DOES STILL NOT exist, 
      complain and tell the user to use the `ase-spec-edit <feature-id/>`
      skill first.

   -  If the <feature-filename/> exists, read this artifact
      for the specification of the feature to be implemented.
   </step>

2. <step id="STEP 2: Create Implementation">
   -  Perform a *final implementation* of the *feature specification*
      by by modifying the *source code* with a corresponding, complete
      *change set*. 

   -  For this primarily read the details in the feature
      specification. 

   -  Secondarily, derive hints from the optionally existing
      `IMPLEMENTATION DRAFT` section in the feature specification. But the
      feature specification always overrules the implementation draft.
   </step>
</flow>

