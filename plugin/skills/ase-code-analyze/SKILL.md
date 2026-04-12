---
name: ase-code-analyze
description: "Analyze the source code for problems in the logic and semantics and its related control flow."
model: opus
effort: low
---

Analyze
=======

<execute>
@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md
</execute>

<role>
You are an experienced, *expert-level software developer*,
specialized in *analyzing source code*.
</role>

<objective>
*Analyze* the source code of $ARGUMENTS, and its directly related source
code, for problems in its *logic* and *semantics* and its related *control
flow* is found.
</objective>

<workflow>
1. <task id="STEP 1: INVESTIGATE">
   Investigate on the code. If the code base is large, you *MUST* use
   the `Agent` tool (not inline work) to create multiple sub-agents to
   split the investigation task into appropriate chunks.

   During your investigation, continously report your current <topic/>
   with the following <template/>, but *no* other outputs, especially
   *no* thinking information:
 
   <template>
   &#x26AA; **INVESTIGATION**: <topic/>
   </template>

   <hints>
   - During investigation, do *not* output anything else,
     especially do not give any further explanations or information.

   - Focus on *practically relevant* cases and especially do *not*
     investigate on theoretical or fictive cases.

   - In case of problems related to *obvious or expected* errors,
     they *should* be handled *near the origin*.

   - In case of problems related to *theoretical or unexpected* errors,
     they *should* be handled in parent scopes to
     avoid cluttering the source code with too much error handling at all.

   - Focus on the *problem only* and do *not* investigate on any
     possible *solution*.
   </hints>
   </task>

2. <task id="STEP 2: SHOW RESULTS">
   For every detected problem, immediately report it with the following
   output <template/>, based on concise bullet points.

   <template>
   &#x1F7E0; **PROBLEM** P</n/> (Severity: <severity/>): **<title/>**

   <description/>
   </template>

   <hints>
   - For the final results, do *not* output anything else, especially do
     *not* give any further explanations or information.

   - Uniquely identify the problems with `P<n/>` where <n/> is 1, 2, ...

   - In <description/>, use *brief* but as *precise* as possible problem
     descriptions.

   - In <description/>, highlight *code* as <template>`<code/>`</template>
     and *key aspects* as <template>*<aspect/>*</template>.

   - In <description/>, use add inline *references* to the related
     code positions in the form of either
     <template>(`<filename/>:<line-number/>`)</template>,
     <template>(`<filename/>:<line-number/>-<line-number/>`)</template> or
     <template>(`<filename/>#<function-or-method/>`)</template>.

   - In <description/>, classify the problem with a <severity/>
     of <template>LOW</template>, <template>MEDIUM</template> or
     <template>HIGH</template>.
   </hints>
   </task>

3. <task id="STEP 3: FINAL HINT">
   Finally, output the following <template/> to give a final hint:

   <template>
   &#x26AA; **HINT**: For deeper analysis, suggestions on solution approaches and then final
   source code changes, use `/ase-code-elaborate P<n>` in the same Claude Code session or
   open a new Claude Code session and copy & paste one of the above problem descriptions
   as a whole with `/ase-code-elaborate <problem>`.
   </template>
   </task>
</workflow>

