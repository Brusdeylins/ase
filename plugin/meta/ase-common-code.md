
Code Skill Common Steps
=======================

<define name="code-tenets">

You *MUST* internalize and strictly honor the **GENERIC TENETS**, and
the **<arg1/> TENETS** of the **ASE Tenets** in the following creation
and updating of code. Do not output anything.

</define>

<define name="code-tenets-from-plan">

Determine the *kind of change* the task plan describes and internalize
the corresponding tenet sets:

-   If <task-content/> contains a `☯   Kind:     <text/>` header line
    and <text/> is one of `CRAFTING`, `REFACTORING`, or `RESOLVING`:
    Set <task-kind><text/></task-kind> (set task kind to the stated kind).

-   Else:
    The plan states no kind at all, or an unrecognized one, so *infer*
    the kind from the plan content itself: `RESOLVING` if the plan
    predominantly fixes a defect, `REFACTORING` if it predominantly
    re-structures existing artifacts without changing their observable
    behavior, and `CRAFTING` otherwise. Set <task-kind/> to the inferred
    kind, defaulting to `CRAFTING` if the inference stays inconclusive.

Then honor the tenet sets of <task-kind/>:

<expand name="code-tenets" arg1="<task-kind/>"></expand>

</define>
