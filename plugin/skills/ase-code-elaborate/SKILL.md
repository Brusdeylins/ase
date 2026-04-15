---
name: ase-code-elaborate
argument-hint: "<problem-reference>"
description: "Elaborate on a source code problem in depth to fix it."
user-invocable: true
disable-model-invocation: false
model: opus
effort: medium
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Elaborate Code Problem
======================

Your role is an experienced, *expert-level software developer*,
specialized in *debugging and fixing source code*.

<objective>
*Elaborate* on the following problem: $ARGUMENTS.
</objective>

<flow>
1. <step id="STEP 1: Investigate Problem">
   Investigate and *figure out details* related to this problem.
   Report those details with the following <template/>:

   <template>
   &#x1F7E0; **PROBLEM CONTEXT**: *<context/>*
   <affected-code-excerpt/>

   <optional-current-state-diagram/>

   &#x1F7E0; **PROBLEM DETAILS**: *<summary/>*
   - [...]
   - [...]
   - [...]
   </template>

   Hints:

   - Give a short one-sentence <context/> of the problem plus
     an excerpt of the affected code <affected-code-excerpt/>.

   - Give a short one-sentence <summary/> of the problem plus detailed code
     processing information to understand the problem.

   - For <optional-current-state-diagram/>, include an ASCII diagram
     of the *current* structure or flow *only* if the problem is
     *structural* (component layout, dependencies, control/data flow,
     concurrency model). Render in a fenced code block. Omit
     entirely for purely local/code-level problems.
   </step>

2. <step id="STEP 2: Investigate Solutions">
   *Propose* corresponding *solution approach*, including optionally,
   some *alternative* solution approaches. Annotate the approach you
   prefer. Report each solution approach with the following <template/>:

   <template>
   &#x1F535; **SOLUTION APPROACH A<n/>**: *<summary/>*
   - [...]
   - [...]
   - [...]

   <optional-before-after-diagram/>
   </template>

   Hints:

   - Give a short one-sentence <summary/> of the solution approach plus detailed solution information.

   - Focus on solution approaches for *practically relevant* cases and do *not*
     investigate on theoretical or fictive cases. This is especially the case
     for error handling cases and race condition cases.

   - In case of solution approaches for problems related to *obvious or
     expected* errors, they *should* be handled *near the origin*.

   - In case of solution approaches for problems related to *theoretical
     or unexpected* errors, they *should* be handled in parent scopes to
     avoid cluttering the source code with too much error handling at all.

   - For <optional-before-after-diagram/>, include a *side-by-side
     current vs proposed* ASCII diagram *only* when the approach
     changes the *structure* (component layout, dependencies,
     control/data flow, concurrency boundaries). Render in a fenced
     code block. Omit for purely local/code-level approaches.
   </step>

3. <step id="STEP 3: Ask User To Choose Approach">
   Let the *user interactively choose* the preferred solution approach A<n/>
   with the help of the `AskUserQuestion` tool. Use *single-selection* only
   and provide small *code change previews*.
   </step>

4. <step id="STEP 4: Write and Execute Plan">
   Enter *plan mode* by using the `EnterPlanMode` tool.
   Then *write a plan* with code references, a precise description of the
   problem, the chosen solution approach, a preview of the *unified
   diff* of the necessary code changes, and a possible way to verify the
   success of the solution, by using the following <template/> for the
   plan:

   <template>
   **CONTEXT**: *<context-summary/>*

   **PROBLEM**: *<problem-summary/>*
   - [...]
   - [...]
   - [...]

   **SOLUTION**: *<solution-summary/>*
   - [...]
   - [...]
   - [...]

   **CHANGES**:
   <unified-diff-preview-of-changes/>

   **VERIFICATION**:
   - [...]
   - [...]
   - [...]
   </template>

   Hints: For all summary texts...
   - Use *very brief* but as *precise* as possible problem descriptions.
   - Highlight *code* as <template>`<code/>`</template>
     and *key aspects* as <template>*<aspect/>*</template>.

   Hints: In the source code changes...
   - Avoid introducing dedicated state variables for individual error cases.
   - If state variables are needed to detect error cases, at least use
     minimum number of those variables only.
   - In general, use minimum number of state variables to span the
     maximum of error space.

   Hints: For the planning mode...
   - Let the *user interactively choose* whether to accept this plan, exit
     the plan mode and this way finally execute the plan, or how this plan
     should be further revised in a loop.
   - When the plan was approved, switch to *Accept Edits* mode and
     apply the plan.
   - After applying the plan, just stop. Do not run build procedure 
     or tests automatically.
   </step>
</flow>

