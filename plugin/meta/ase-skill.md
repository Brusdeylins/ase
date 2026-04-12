---
name: ase-skill
argument-hint: "[none]"
description: Skill Meta Information
user-invocable: false
disable-model-invocation: false
---

- *IMPORTANT*: For each <task/> in <workflow/>, and in the given
  *chronological order*, you *MUST* use the `TaskCreate` tool to create
  a corresponding task. Transform each `<task id="xxx" [...]/>` into
  `TaskCreate({ subject: "xxx", description: "xxx", activeForm: "xxx" })`.
  In order words, use the text of the `id` attribute of <task/> for the
  `subject`, `description`, and `activeForm` fields of `TaskCreate`.

- *IMPORTANT*: Do *not* call `TaskCreate` tools in parallel. Instead
  *wait* for each `TaskCreate` tool call to complete before proceeding
  with the next.

- *IMPORTANT*: You *MUST* use the `TaskUpdate` tool with its `addBlockedBy`
  parameter to ensure that all tasks are running in the given *chronological order*,
  i.e., `TaskUpdate({ taskId: "<id-of-step2/>", addBlockedBy: [ "<id-of-step-1/>" ] })`,
  i.e., `TaskUpdate({ taskId: "<id-of-step3/>", addBlockedBy: [ "<id-of-step-2/>" ] })`, etc.

- *IMPORTANT*: For each <task/> you *MUST* use the `TaskUpdate` tool
  for updating its status during processing.

- *IMPORTANT*: You *MUST* sequentially execute every <task/> in
  a <workflow/> *EXACTLY* as the instructions specify.

- *IMPORTANT*: For any <task/> that specifies an *agent* in its
  `agent="[...]"` XML attribute, you *MUST* use the specified
  *agent* to perform the instructions for that <task/>.

- *IMPORTANT*: If you need clarification on any details of your current
  <task/>, stop and ask the user specific numbered questions, and then
  continue once you have all of the information you need.

- *IMPORTANT*: You *MUST* output the result of all <task/> *EXACTLY* as
  provided, without any further text interpretations and modifications.

- *IMPORTANT*: You *MUST* output all <template/> sections *EXACTLY* as provided,
  except for replacing the placeholders `<xxx/>` and `[...]` and replacing
  XML entities like `&#x25CB;` with the corresponding Unicode characters.

- *IMPORTANT*: You *MUST* *NEVER* output any `---` lines.

- Initially, once output your <objective/> with the following output <template/>:
  <template>
  &#x26AA; **OBJECTIVE**: <objective/>
  </template>

- When you have to reference a <task/>, use the following output <template/>
  (where <task-id/> correspondings to the `id="[...]"` XML attribute of
  the <task/> and <task-body/> correspondings to the XML body of the <task/>:
  <template>
  **<task-id/>**: <task-body/>
  </template>

