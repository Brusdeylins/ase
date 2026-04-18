---
name: ase-spec-edit
argument-hint: "<feature-id> <summary-or-change>"
description: "Edit a stand-alone feature specification."
user-invocable: true
disable-model-invocation: false
effort: high
allowed-tools:
    - "Bash(test)"
    - "Bash(echo)"
    - "Bash(date)"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Edit a Standalone Feature Specification
=======================================

Your role is an experienced, *expert-level business analyst*,
specialized in *editing stand-alone feature specifications* of IT systems.

<objective>
*Edit* the *feature specification* of an IT system
for the following stand-alone *feature*:
<arguments>$ARGUMENTS</arguments>.
</objective>

<flow>
1. <step id="STEP 1: Determine Operation">
   - The first word of <arguments/> is the unique <feature-id/> of the
     specification. The second and following words of <arguments/>
     are the <request/>.

   - Derive the specification file
     <feature-filename/> from `<feature-id/>.md`.

   - The file <feature-filename/> existance is:
     ! `test -f `<feature-filename/>` && echo yes || echo no`

   - If the <feature-filename/> already exists, read this artifact
     for the base information on the feature and try to apply the
     <request/> as a change request in order to change this feature
     specification. If <request/> is empty, just read and keep
     the feature specification as-is.

   - If the <feature-filename/> DOES NOT already exist, create
     a new feature specification by treating <request/> as the
     summary of the new feature. Set the <timestamp-created/>
     to the current timestamp.
   </step>

2. <step id="STEP 2: Edit Feature">
   Enter *plan mode* by using the `EnterPlanMode` tool. Then *elaborate
   on the feature* by using the following feature <template/> for the
   plan:

   <template>

   # ✪ **<feature-title/>**

   ⚑ id: **<feature-id/>** | ✳ created: **<timestamp-created/>** | ✎ modified: **<timestamp-modified/>**

   <feature-summary/>

   ## ⧉ INTERFACE

   <feature-interface/>

   ## ⚙ LOGIC

   <feature-logic/>

   ## ⛁ DATA

   <feature-data/>

   ## ✦ QUALITIES

   <feature-qualities/>

   ## ⚒ TECHNOLOGY

   <feature-technology/>

   </template>

   Hints:

   - The <timestamp-created/> is the timestamp when this feature specification
     was created. The <timestamp-modified/> is the timestamp when this
     feature specification was last modified. Both use the ISO-style format
     `YYYY-mm-dd HH:MM` which should be determined with `date "+%Y-%m-%d %H:%M"`.

   - The <feature-title/> is a short summary of
     the <feature-summary/>, no longer than 50 characters.

   - The <feature-summary/> summarizes the feature in a *precise*
     but *brief* way with the help of 2-7 sentences.

   - The sections <feature-summary/>, <feature-interface/>,
     <feature-logic/>, <feature-data/>, <feature-qualities/> and
     <feature-technology/> all are just a short list of 1-5 bullet
     points. Each bullet points is formatted as `- **<aspect/>**:
     <specification/>` where <aspect/> indicates the aspect of the
     section and <specification/> is 1-3 sentences giving a *ultra
     precise* but also *ultra brief* and *ultra concise* description of
     the aspect.

   - Always try to file all feature specification aspects into the
     sections <feature-summary/>, <feature-interface/>, <feature-logic/>,
     <feature-data/>, <feature-qualities/>, and <feature-technology/> only.
     If no content exists for a section, still keep the section but
     add a single bullet point `- *(none)*` to this section only.

   - In all feature specification sections <feature-summary/>,
     <feature-interface/>, <feature-logic/>, <feature-data/>,
     <feature-qualities/>, and <feature-technology/>, specify *only*
     aspects which really result in a potential *change* later.
     Especially, do *not* specify tautologies or platitudes.

   - Always *keep* the existing *wording*. Do *not re-formulate* the
     sentences, except when a sentence needs a *semantical change*.

   - In all sections, break the sentences with a newline character
     after about 100 characters per line.

   - The <feature-interface/> section describes affected external
     systems, User Interfaces (UI) (with screens, wireframes,
     interaction details, etc), Application Programming Interfaces
     (APIs) (with endpoints/methods/functions, input parameters,
     output/return values, payloads, data types, error/exceptions, etc),
     etc.

   - The <feature-logic/> section describes affected behavior,
     functionalities, workflows, control flows, state machines, sequence
     diagrams, edge cases, etc.

   - The <feature-data/> section describes affected data entities, data
     relationships, data schemas, data flows, etc.

   - The <feature-qualities/> section describes affected non-functional
     requirements (like performance, security, scalability,
     availability, compliance, etc), qualities, etc.

   - The <feature-technology/> section describes affected technology,
     like used utilities, tools, libraries, frameworks, etc.

   - If a section named `## ≡ IMPLEMENTATION DRAFT` already exists from
     the `ase-spec-preflight` skill, silently ignore it.

   - After the user accepted the plan, just stop. Do not execute any
     other actions or give any further explanations, except for writing
     back the new or updated feature specification to <feature-filename/>.
     On writing back, set the <timestamp-modified/>
     to the current timestamp.
   </step>
</flow>

