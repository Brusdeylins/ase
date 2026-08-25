
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

-   SEVERITY:

    The *Focus Area* indicate the severity of the aspect:

    -   severity *MUST*   for *DOMAIN*         focus area
    -   severity *MUST*   for *INTERFACE*      focus area
    -   severity *SHOULD* for *ARCHITECTURE*   focus area
    -   severity *MAY*    for *IMPLEMENTATION* focus area

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

