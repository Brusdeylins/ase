
Approach Skill Common Steps
===========================

<define name="approach-select">

Determine, compare, and select the overall *<arg1/> approach*, where
<arg2/> is the identification prefix of the status line of the
automatic choice (like `◉ task: **<ase-task-id/>**`).

Set <approach-label><arg1/></approach-label> and
<approach-status><arg2/></approach-status>, so both stay available
inside the nested expansions below, which bind their own arguments.
Set <approach-auto>true</approach-auto> if <ase-project-boxing/> is
equal `black` or <ase-headless/> is equal `true`, else set
<approach-auto>false</approach-auto>. Set
<chosen-approach></chosen-approach> (empty). Do not output anything.

You *MUST* perform the following sub-steps *internally* and *without
any output* until and including the recommendation decision. In
particular, you *MUST* *NEVER* output any placeholder, tag, or marker
(like `<xxx/>`) on your own, as all placeholders above and below are
internal state only. Only
sub-steps 4-8 below are allowed to produce output; sub-steps 4-6 only if
<approach-auto/> is equal `false`.

If <approach-auto/> is equal `true`, *skip* the reporting sub-steps 4-6
entirely (they perform no output at all) to speed up processing.

1.  *Propose* a corresponding *<arg1/> approach*, optionally including
    some *alternative* <arg1/> approaches. Do *not* output anything
    in this sub-step.

2.  *Reflect* on and *critique* the proposed approaches by deriving,
    per approach, a small set of concrete *pros* and *cons*. Do
    *not* output anything in this sub-step.

3.  Based on the reflection, *decide* which approach to recommend
    and annotate it with an <annotation/> of
    ` ⚝ **RECOMMENDATION** ⚝`. All other approaches receive an
    empty <annotation/>. Do *not* output anything in this sub-step.

4.  Indicate start of reporting by showing the following <template/>,
    which *MUST* be the very first output of this definition -- output
    nothing at all before it:

    <template>
    <ase-tpl-head title="APPROACHES"/>
    </template>

5.  Now report each approach with the following <template/>,
    inlining its pros/cons derived in sub-step 2, and do not output
    anything else in this step:

    <template>
    ●   **APPROACH A<n/>**<annotation/>: **<summary/>**
    ○   [...]
    ⊕   *PRO*: [...]
    ⊖   *CON*: [...]
    </template>

    Hints:

    -   Give a short one-sentence <summary/> of the <arg1/> approach
        plus *precise* and *ultra brief and concise* <arg1/>
        information. Try to keep the number of bullet points
        (`○ [...]`) in the range of 1-4.

6.  Indicate end of reporting by showing the following <template/>:

    <template>
    <ase-tpl-foot title="APPROACHES"/>
    </template>

7.  <if condition="<approach-auto/> is equal `false`">

    In the following, you *MUST* *NOT* use your built-in
    <user-dialog-tool/> tool! Instead, you *MUST* just show a
    custom dialog according to the expanded `custom-dialog`
    definition. You *MUST* closely follow this definition.

    Let the user choose the preferred approach A<n/> by raising
    a question with the following custom dialog, where per
    approach A<n/>, you determine an ultra brief summary
    <short-summary/> and then use the answer option `A<n/>:
    ⚝ **RECOMMENDATION** ⚝ - <short-summary/>` for your
    recommended approach plus zero or more answer options `A<n/>:
    <short-summary/>` for all other approaches:

    <expand name="custom-dialog" arg1="--no-other">
        Select Approach: Select your preferred <approach-label/> approach to follow?
        A<n/>: <short-summary/>
        [...]
    </expand>

    If <result/> is `CANCEL`, keep <chosen-approach/> empty and *skip*
    sub-step 8. Otherwise, set <n/> to the number of the approach
    A<n/> selected by <result/>.

    </if>
    <else>

    Set <n/> to the number of the <approach-label/> approach A<n/> you recommend.
    Output a hint with the following <template/>:

    <template>
    ⧉ **ASE**: <approach-status/>, ▶ status: **auto-chosen approach A<n/>**
    </template>

    </else>

8.  Set <chosen-approach/> to the complete description of the chosen approach
    A<n/>: its summary, its details, and all realization decisions it
    implies. Do not output anything in this sub-step.

</define>

