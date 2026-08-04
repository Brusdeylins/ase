---
name: ase-meta-proximity
description: "Determine the Conceptual Proximity of a Topic"
effort: high
tools:
    - "Agent"
---

@../meta/ase-control.md

<define name="gather-facts">
<if condition="<ground/> is equal `true`">
Use the `ase-meta-search` skill in a sub-agent to gather facts with
the following tool call and store the returned facts in the placeholder
named `<arg2/>`:

`Agent(
    description: "Query Web Search Service",
    subagent_type: "ase:ase-meta-search",
    prompt: "Search the Internet/Web and gather facts about <arg1/>",
    run_in_background: false
)`

<if condition="the placeholder named `<arg2/>` contains no usable facts">
Set the placeholder named `<arg2/>` to empty, so the determination below
silently falls back to model knowledge. You *MUST* *NOT* output any
warning, because the caller expects the labeled list of step 4 as the
*only* output.
</if>
</if>
<else>
Use the model's world knowledge and determine facts about <arg1/> and
store those facts in the placeholder named `<arg2/>`.
</else>
</define>

1.  Set <args>$ARGUMENTS</args>, the single whitespace-separated string.

    <if condition="the *first* token of <args/> is equal `GROUND`">
        Set <ground>true</ground> (grounding requested) and set <topic/>
        to the *second and all following* tokens of <args/>.
    </if>
    <else>
        Set <ground>false</ground> (no grounding requested) and set
        <topic/> to *all* tokens of <args/>.
    </else>

    You *MUST* *NOT* output anything related to this step.

2.  *Determine Topic*:

    Determine the canonical name of the central *topic* which is stored
    in <topic/>.

    <expand name="gather-facts"
        arg1="the following topic: <topic/>"
        arg2="facts-topic"></expand>

    Ground the determination of the canonical name of the topic <topic/>
    in the facts of <facts-topic/> and do not contradict them. Update
    <topic/> accordingly.

    You *MUST* *NOT* output anything related to this step.

3.  *Determine Proximity*:

    Determine the *conceptual proximity* of the current <topic/> along
    three *dimensions* in parallel:

    -   **PARENT**:

        The single most relevant *parent* topic (the broader topic that
        <topic/> is a specialization of), which will be stored in
        <parent/>.

        <expand name="gather-facts"
            arg1="the PARENT topic (the broader topic that the given topic is a specialization of) of the following topic: <topic/>"
            arg2="facts-parent"></expand>

        Ground the determination of the canonical name of the parent
        topic <parent/> in the facts of <facts-parent/> and do not
        contradict them.

    -   **SIBLINGS**:

        The *four* most relevant *sibling* topics (topics on the same
        level that share the same parent), which will be stored in
        <sibling-1/> to <sibling-4/>.

        <expand name="gather-facts"
            arg1="the SIBLING topics (topics on the same level that share the same parent) of the following topic: <topic/>"
            arg2="facts-siblings"></expand>

        Ground the determination of the canonical names of the most
        relevant sibling topics <sibling-1/> to <sibling-4/> in the facts
        of <facts-siblings/> and do not contradict them.

    -   **CHILDREN**:

        The *four* most relevant *child* topics (narrower topics that
        are specializations of <topic/>), stored in <child-1/> to
        <child-4/>.

        <expand name="gather-facts"
            arg1="the CHILD topics (narrower topics that are specializations) of the following topic: <topic/>"
            arg2="facts-children"></expand>

        Ground the determination of the canonical names of the most
        relevant child topics <child-1/> to <child-4/> in the facts of
        <facts-children/> and do not contradict them.

    You *MUST* determine *exactly* one parent, *exactly* four siblings,
    and *exactly* four children. All nine proximity topics *MUST* be
    *distinct* from each other and *MUST* *NOT* be <topic/> itself or a
    mere synonym or spelling variant of it. You *MUST* *NOT* output
    anything related to this step.

4.  Return *exclusively* as the last message the following <template/>
    (no prose, no preamble, no summary, and no Markdown formatting):

    <template>
    TOPIC:   <topic/>
    PARENT:  <parent/>
    SIBLING: <sibling-1/>
    SIBLING: <sibling-2/>
    SIBLING: <sibling-3/>
    SIBLING: <sibling-4/>
    CHILD:   <child-1/>
    CHILD:   <child-2/>
    CHILD:   <child-3/>
    CHILD:   <child-4/>
    </template>

