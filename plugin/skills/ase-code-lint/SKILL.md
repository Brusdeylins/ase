---
name: ase-code-lint
argument-hint: "<source-reference>"
description: Lint Source Code
user-invocable: true
disable-model-invocation: false
model: opus
effort: medium
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Lint Source Code
================

Your role is an experienced, *expert-level software developer*,
specialized in *analyzing source code*.

<objective>
*Analyze* the code of $ARGUMENTS for *potential problems*
related to a set of code quality aspects.
</objective>

<define name="linter">
    Your current *sub-objective* is:
    <body/>

    For this, first output the following <template/> to inform the user:

    <template>
    **<arg1/>**: <body/>
    </template>

    Then decide whether you detected *potential problems* which
    *requires* a *code change* and *think* about this decision to be
    sure it is *not* a false positive. Then choose one of the following
    cases:

    -   **CASE 1**: **NEGATIVE**
        In case of *no* necessary code changes,
        display the following output <template/>:

        <template>

        &#x26AA; **RESULT**: No issues found, no code changes necessary.

        </template>

        Especially, do *not* output any further explanations.

    -   **CASE 2**: **POSITIVE**

        In case of necessary code changes, display a *brief explanation*
        *what* the *problem* is and *how* the proposed *solution* fixes
        it. Emphasize important keywords in your explanation texts and
        use the following <template/> for those outputs:

        <template>

        &#x1F7E0; **PROBLEM**: [...]

        &#x1F535; **SOLUTION**: [...]

        </template>

        Especially, do *not* output any further explanations.

        After this, immediately propose a corresponding *complete source
        code change set*. For this, keep all source code changes as
        *surgical and small* as possible.
</define>

<flow>
1.  <step id="Preparation">
    *Find* and *read* all the corresponding source code files
    and all *related* source code files.
    </step>

2.  <step id="A01 - FORMATTING">
    <expand name="linter" arg1="A01 - FORMATTING">
    Check for inconsistently formatted code and badly vertically
    aligned code on sub-sequent lines.

    For vertical alignment, prefer to align on operators. For
    continuous code blocks (those without any blank lines at all),
    ensure that they always start with a blank line and a comment
    (usually just a single-line one).
    </expand>
    </step>

3.  <step id="A02 - COMPREHENSION">
    <expand name="linter" arg1="A02 - COMPREHENSION">
    Check for bad readability, bad maintainability, or bad
    self-documentation on identifiers.

    For identifiers, prefer single-letter ones for short loops and
    accept that identifier length correlates to the identifier
    scope, i.e., longer identifiers are acceptable for larger
    scopes. For all indentifers, prefer camel-case. For classes and
    interfaces, prefer first letter to be upper-case. For parameters
    and variables, prefer first letter to be lower-case.
    </expand>
    </step>

4.  <step id="A03 - CLEANLINESS">
    <expand name="linter" arg1="A03 - CLEANLINESS">
    Check for unclean code and inconsistent code.

    For unclean code, especially detect out-dated code construct
    patterns. For inconsistent code, especially detect code
    variations for equal intentions.
    </expand>
    </step>

5.  <step id="A04 - SPELLING">
    <expand name="linter" arg1="A04 - SPELLING">
    Check for typos, spelling errors, or incorrect grammar in
    identifiers, string literals and comments.

    Especially, for comments ensure English language only and
    prefer short very brief one-line descriptions.
    </expand>
    </step>

6.  <step id="A05 - COMPLEXITY">
    <expand name="linter" arg1="A05 - COMPLEXITY">
    Check for extremely long functions, and deeply nested code
    constructs.

    Especially, for functions prefer fewer then 100 lines, and for
    nested constructs prefer fewer than 10 nesting levels.
    </expand>
    </step>

7.  <step id="A06 - REDUNDANCY">
    <expand name="linter" arg1="A06 - REDUNDANCY">
    Check for redundancies through duplications of identical code or
    nearly identical code.

    For redundant code of more than 3 lines, suggest factoring it out
    into a utility function, but position it before its calls as close
    as possible.
    </expand>
    </step>

8.  <step id="A07 - PATTERNS">
    <expand name="linter" arg1="A07 - PATTERNS">
    Check for broken design patterns, broken conventions, or broken
    best practices.

    For design patterns, especially check for broken OOP and FP aspects.
    For conventions, especially check for broken TypeScript/JavaScript
    conventions. For best practices, especially check for not leveraging
    ECMAScript APIs or using obsolete ECMAScript APIs.
    </expand>
    </step>

9.  <step id="A08 - COMPLICATENESS">
    <expand name="linter" arg1="A08 - COMPLICATENESS">
    Check for complicated or cumbersome code constructs.

    Especially, check for unnecessary difficult code constructs
    for which simpler solutions exist.
    </expand>
    </step>

10. <step id="A09 - CONCISENESS">
    <expand name="linter" arg1="A09 - CONCISENESS">
    Check for non-concise and boilerplate-based code.

    Especially, check for unnecessary long code constructs for
    which shorter solutions exist, and check for unnecessary
    technical/infrastructural code with too less domain-specific
    aspects.
    </expand>
    </step>

11. <step id="A10 - SMELLS">
    <expand name="linter" arg1="A10 - SMELLS">
    Check for code smells.

    Especially, check for unnecessary type casts, problematic value
    coercions, surprising void() and risky eval() constructs.
    </expand>
    </step>

12. <step id="A11 - TYPING">
    <expand name="linter" arg1="A11 - TYPING">
    Check for broken "maximum type safety with minimum type
    annotations" rule.

    Especially, ensure that no implicit "any" type exists and that types
    are primarily used on function parameters. For all other cases,
    ensure that a maximum type inference is used.
    </expand>
    </step>

13. <step id="A12 - ERROR-HANDLING">
    <expand name="linter" arg1="A12 - ERROR-HANDLING">
    Check for missing, incorrect or inconsistent error handling or
    error preventions.

    Surround code blocks with try/catch-clauses only if really
    necessary to not clutter the code too much with error handling. For
    asynchronous code, prefer .catch() instead of try/catch.
    </expand>
    </step>

14. <step id="A13 - MEMORY-LEAK">
    <expand name="linter" arg1="A13 - MEMORY-LEAK">
    Check for memory leaks and inconsistent resource
    allocation/deallocation pairs.

    Especially, ensure that for each allocation there is a corresponding
    deallocation and that deallocations happen in the exact opposite
    order of the allocations.
    </expand>
    </step>

15. <step id="A14 - CONCURRENCY">
    <expand name="linter" arg1="A14 - CONCURRENCY">
    Check for concurrency or parallelism race conditions.

    Especially, check for potential problems of code which runs
    asynchronously from timeout/interval or I/O driven callbacks.
    </expand>
    </step>

16. <step id="A15 - PERFORMANCE">
    <expand name="linter" arg1="A15 - PERFORMANCE">
    Check for bad performance and inefficiency issues.

    Especially, check for code constructs with a high (i.e., not
    constant/O(1), or linear/O(n) complexity) in its execution time
    and/or memory consumption.
    </expand>
    </step>

17. <step id="A16 - SECURITY">
    <expand name="linter" arg1="A16 - SECURITY">
    Check for potential vulnerabilities, typical security issues,
    and missing essential validations.

    Especially, check for edge cases in value ranges.
    </expand>
    </step>

18. <step id="A17 - ARCHITECTURE">
    <expand name="linter" arg1="A17 - ARCHITECTURE">
    Check for architecture, design, or modularity concerns.

    For architecture, ensure that patterns like Layer, Slice, Hub
    & Spoke, and Pipes & Filters are used correctly. For design,
    ensure that patterns like Singleton, Proxy, Adapter, Class, and
    Interface are used correctly.
    </expand>
    </step>

19. <step id="A18 - LOGIC">
    <expand name="linter" arg1="A18 - LOGIC">
    Check for wrong and inconsistent domain logic.

    Especially, try to detect implausible edge cases in the domain
    logic.
    </expand>
    </step>

20. <step id="A19 - FLOW">
    <expand name="linter" arg1="A19 - FLOW">
    Check for wrong control or data flow.

    Especially, try to detect control flows where corner cases are not covered,
    and data flows with inconsistent value unit processing.
    </expand>
    </step>

21. <step id="A20 - DEAD-CODE">
    <expand name="linter" arg1="A20 - DEAD-CODE">
    Check for dead or unused code.

    Especially, try to detect classes, functions or control flow
    branches which are effectively dead or unused.
    </expand>
    </step>

22. <step id="Summary">
    At the end, do not give any more explanations, except for
    a summary of all accepted and rejected code
    changes. For this, according to the original step ordering,
    use the following output <template/>, where
    `&#x1F7E0; **AX - XXX**: N issues` is used for aspects
    with N issues and `&#x26AA; **AX - XXX**: no issues`
    for aspects without any issues:

    <template>
    **SUMMARY**:

    &#x1F7E0; **AX - XXX**: N issues

    &#x26AA; **AX - XXX**: no issues

    [...]
    </template>
    </step>
</flow>

