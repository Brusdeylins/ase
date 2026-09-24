
Grill Skill Common Steps
========================

<define name="grill-understanding">

-   GOAL:

    Interactively interviewing the user *relentlessly* about every
    *essential aspect* of <arg1/> *until* reaching a shared
    understanding and no major decisions/questions are left open.

    This especially means that you *MUST* clarify as many aspects as
    necessary to ensure that for at least the most important decisions,
    during a subsequent implementation, no essential freedom of choice
    exists any longer.

-   FOCUS:

    Focusing on the following outside-in *Focus Areas*, in order of
    descending importance for the grilling operation:

    1.  *DOMAIN*: Aspects affecting domain-specifics. These
        aspects *MUST* be clarified, as they are about
        the "what" of the solution and they
        non-technically shape the solution noticeably.

    2.  *INTERFACE*: Aspects affecting externally observable
        behavior or interfaces, especially aspects about user (UI)
        and machine (API) interfaces. These aspects *MUST* be
        clarified, as they are externally visible and
        shape the boundary of the solution.

    3.  *ARCHITECTURE*: Aspects affecting software and system
        architecture, especially decisions on structure, wiring,
        placement, or dependencies. These aspects *SHOULD*
        be clarified, as they technically shape the solution noticeably.

    4.  *IMPLEMENTATION*: Aspects affecting any other
        implementation details, especially how <arg1/>
        is realized in the code base. These aspects *CAN* be
        clarified, as they shape technical inner details only.

    5.  *REGRESSION*: Aspects affecting the regression checks of
        <arg1/>, i.e. decisions on what must *not* break. These
        aspects *SHOULD* be clarified, as they decide when the
        solution counts as safe.

    6.  *CONFIRMATION*: Aspects affecting the confirmation checks of
        <arg1/>, i.e. decisions on what proves the specified
        behavior. These aspects *SHOULD* be clarified, as they
        decide when the solution counts as complete and correct.

-   SEVERITY:

    The *Focus Area* indicate the severity of the aspect:

    -   severity *MUST*   for *DOMAIN*         focus area
    -   severity *MUST*   for *INTERFACE*      focus area
    -   severity *SHOULD* for *ARCHITECTURE*   focus area
    -   severity *MAY*    for *IMPLEMENTATION* focus area
    -   severity *SHOULD* for *REGRESSION*     focus area
    -   severity *SHOULD* for *CONFIRMATION*   focus area

-   IMPACT:

    Independent of its *Focus Area*, every open point carries an
    individual *impact* rating, describing how noticeably its decision
    shapes the solution:

    -   impact *HIGH*:   the decision shapes the solution fundamentally
    -   impact *MEDIUM*: the decision shapes the solution noticeably
    -   impact *LOW*:    the decision shapes the solution marginally

    The impact decides *which* open points are raised as questions --
    points of higher impact first, so points of lowest impact are the
    first ones to be dropped -- and in which *order* they are raised
    *within* a focus area.

-   INDICATORS:

    Check the following indicators for identifying problematic
    aspects:

    -   *Fuzzy Language*:
        When the user uses vague or overloaded terms instead of
        a precise or canonical term.

    -   *Conflicting Terminology*:
        When the user uses a term that conflicts with the
        existing terminology in the code base.

    -   *Conflicting Code*:
        When the user states how something works, check whether the
        current code state really agrees.

    -   *Non-Concrete Scenarios*:
        When domain relationships are being discussed,
        stress-test them with specific scenarios. Theoretically
        invent realistic scenarios that probe edge cases and
        force the user to be precise about the boundaries
        between concepts.

    -   *Unspecified Architecture Patterns*:
        When the realization of the functionality is known to
        be reasonably realizable with more than one decent
        architecture pattern, but no such pattern was
        mentioned.

    -   *Unspecified Dependencies*:
        When the realization of functionality usually is known
        to be supported by the use of frameworks or libraries,
        but no dependencies on such solutions were mentioned.

</define>

<define name="grill-stop">

The requested number of grilling rounds is a *maximum* only: the
grilling *stops early* once all open points of severity <arg1/> or
higher are clear. For this, the freshly determined questions of the
current round are the *still open points*, ranked by their
<context-N-severity/> in the descending order `MUST`, `SHOULD`, `MAY`.

<if condition="no question has a <context-N-severity/> of <arg1/> or higher">
Set <grill-stop>true</grill-stop> and only output the following <template/>:

<template>
⧉ **ASE**: <arg2/>, ▶ status: **grilling finished early -- all points of severity <arg1/> or higher are clear**
</template>
</if>
<else>
Set <grill-stop>false</grill-stop>. Do not output anything.
</else>

</define>

