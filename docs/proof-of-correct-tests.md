Proof of Correct Tests
======================

This document states the *scientific basis* of the `ase-test-obligate`,
`ase-test-prove`, and `ase-test-audit` skills. It exists because the
mechanism those skills implement is deliberately more expensive than
running a test suite, and that extra cost is only justified if the
cheaper alternative is *demonstrably* insufficient. Each design decision
below is stated as a claim, followed by the evidence that supports it.

The Problem
-----------

An agent that implements a change and then writes tests for it is in an
epistemically compromised position. The tests it produces are derived
from the artifact they are meant to judge, so they converge on
*agreement with the implementation* rather than on *conformance to the
requirement*. A green suite then attests only that the code does not
contradict a description of itself.

This is not a hypothetical failure mode of language models; it is the
documented one. <cite index="22-4,22-5">Generating tests from the code
under test is risky because bugs in the implementation are reflected
into the tests, making faulty behavior appear correct — such tests
capture what the code currently does rather than what it should
do</cite>. The same source notes the structural consequence: <cite
index="22-6">in test-driven development the code does not exist yet, so
relying on it for test generation is impossible</cite> — which is
precisely the property that makes claim-before-code sound.

Two further observations sharpen the picture. First, the volume problem:
<cite index="22-1">a substantial share of LLM-generated unit tests are
invalid, often 34-62%, mainly due to hallucination, where models invent
code that looks plausible but is incorrect</cite>. Second, the
degeneracy problem: LLM test generators produce tests that omit
assertions entirely — in an evaluation of an LLM test-generation tool,
one package yielded only trivial tests where <cite index="30-8">the
generated tests did include calls to its API, but they were all missing
assert statements</cite>. A test without an assertion executes code and
concludes nothing.

There is also a subtler trap specific to models with memorized code:
<cite index="24-5">if the LLM relies heavily on memorized structures, it
may implicitly assume the modified code is a "buggy" version of the
original program</cite>. The generated oracle then encodes the
remembered behavior rather than the intended one.

Practitioner-side commentary converges on the same distinction. Tests
auto-generated against existing code are *characterization* tests:
<cite index="26-1,26-2">they freeze the current behavior in place,
allowing refactoring with some safety, but they do not tell you whether
the system is right</cite>. That is a legitimate use — the illegitimate
one is substituting it for verification: <cite index="26-18,26-19">teams
are not using them to document old code; they are using them to replace
the thinking required for testing new code</cite>.

Decision 1: Obligations Are Fixed Before Implementation
-------------------------------------------------------

**Claim**: the *order* of authoring — claim before code — is
load-bearing, not stylistic.

The argument is primarily structural rather than statistical: an oracle
authored while the implementation is visible *can* be contaminated by
it, and an oracle authored before the implementation exists *cannot*.
The evidence above establishes that the contamination is real and
frequent in LLM-authored tests, which is sufficient to justify removing
the opportunity.

The controlled-experiment literature on test-first versus test-after is
genuinely mixed and should not be overstated. One study reports that
<cite index="18-1,18-3">test cases written for a TDD task had higher
defect detection ability than those written for an incremental non-TDD
task, with developers producing code at a higher quality rate</cite>,
but the broader body of work has not settled the question, and the
effect is often confounded with granularity and effort. The skills
therefore do *not* rest their case on TDD outperforming test-after in
general. They rest it on the narrower and better-supported point that a
test derived *from* an implementation cannot falsify that
implementation.

This is why `ase-test-obligate` refuses to read the
`IMPLEMENTATION DRAFT` section or the working-tree diff, and why every
obligation must cite a <source/> that exists independently of the
change. The `--infer` escape hatch in `ase-test-prove` exists for plans
that never received obligations, and it records in the ledger that the
guarantee is weaker.

Decision 2: Every Witness Must Be Empirically Falsified
--------------------------------------------------------

**Claim**: passing is not evidence; *failing under negation* is.

This is the mutation-testing insight, applied per claim rather than per
suite. The principle is standard: <cite index="8-1,8-2">when a mutant is
killed, the test detected the inserted error; if the code runs normally,
the test case is deemed inadequate due to its failure to detect the
inserted error</cite>. The empirical warrant is strong: <cite
index="8-4">there is strong empirical evidence that mutants, when
correctly applied, can provide great indication of real faults in
software systems</cite>, and mutation analysis has been <cite
index="9-11">empirically found to be the most effective strategy in
detecting faults</cite> among the testing strategies compared.

Mutation testing also changes developer behavior, not just measurement:
projects exposed to it <cite index="4-1">write more tests on average
over longer periods of time, compared to projects that only consider
code coverage</cite>.

Why *per obligation* rather than a suite-wide mutation score? Because
the aggregate is unstable and therefore a poor gate: <cite
index="3-1">the same test suite can have vastly different values of
mutation coverage depending on the mutation operators used to generate
mutants</cite>. A targeted falsifier that negates *one stated claim*
sidesteps operator-choice sensitivity entirely — the question is not
"what fraction of arbitrary mutants die" but "does this witness detect
the absence of the behavior it claims to check".

Two practical constraints in the skills follow directly from known
mutation-testing pitfalls. The **Targeted Signal** tenet — a falsifier
must fail for the predicted reason — addresses crash mutants, which are
a large fraction of the total: <cite index="1-5,1-6">mutants classify as
crash, killed, and surviving, and identifying effective mutants is
crucial for testing efficiency</cite>, with one study finding <cite
index="1-10">crash mutants accounting for 38.79% of all mutants</cite>.
A mutation that breaks compilation kills the witness for the wrong
reason and proves nothing, so the skills record it as `BLOCKED` rather
than as evidence. And the cost objection to classical mutation testing —
<cite index="9-12,9-14">mutation imposes unacceptable demands on
computing and human resources due to the large number of mutants, and is
generally regarded by the practicing test engineer as too expensive to
use</cite> — is why the skills apply *one* stated falsifier per
obligation instead of generating a mutant population.

Decision 3: Coverage of Intent, Not of Lines
---------------------------------------------

**Claim**: line and branch coverage are inadequate as the completeness
criterion for a change.

The foundational result is Inozemtseva and Holmes: across <cite
index="2-7,2-8,2-9">31,000 test suites generated for five large Java
systems, measuring statement, branch, and modified-condition coverage
and using mutation testing to evaluate fault-revealing effectiveness,
they found a low to moderate correlation between coverage and
effectiveness when the number of test cases is controlled for</cite>.
The control for suite size is the crux: much of the apparent
coverage-effectiveness relationship is simply that bigger suites cover
more *and* find more.

The literature is not unanimous — some studies report a statistically
significant correlation, and among criteria <cite index="2-4,2-5">branch
coverage and intra-procedural acyclic path coverage perform best, with
all evaluated criteria predicting mutation scores reasonably well</cite>
— and later work notes that <cite index="6-1,6-4">coverage measured on a
clean program differs substantially from coverage on its faulty
versions, so the "Clean Program Assumption" should be avoided or treated
as a threat to validity</cite>. The honest summary is that coverage is a
weak and context-dependent proxy, not that it is worthless.

For this mechanism, weak-and-contested is disqualifying: the gate must
be something a reviewer can check by reading. The skills therefore make
the unit of completeness the *behavior-altering `CHANGES` bullet*. Every
such bullet must be the source of at least one obligation, or be
explicitly exempted with a stated reason. Unobservable changes are
declared rather than silently uncounted.

Decision 4: Transcripts, Not Claims
------------------------------------

**Claim**: a verification step that reports its own conclusions is not a
verification step.

An agent asked to verify its own work and to report the outcome in prose
has every incentive and every opportunity to report the outcome it
expects. The countermeasure is mechanical: each obligation's status must
trace to a command that was executed, with its exit code and decisive
output captured verbatim. A command that was not run yields `BLOCKED`,
never the status it would presumably have produced. The **Evidence Over
Assertion** tenet forbids paraphrasing or reconstructing a transcript.

The related risk is over-fitting to whichever signal the agent is
allowed to iterate against. Work on LLM debugging loops observes that
<cite index="21-1">without backtracking and validation across other
generated unit tests, LLMs tend to overfit on the unit test contained in
the feedback</cite>. The `VACUOUS` status exists to surface exactly this
in the ledger: the witness passed, its falsifier also passed, and so the
witness never constrained anything.

Decision 5: Determinism Is a Precondition of Evidence
------------------------------------------------------

**Claim**: an unstable witness cannot testify, and rerunning it until it
agrees is data manipulation.

`ase-test-prove` runs each positive witness twice and marks divergent
outcomes `BLOCKED`. The concern is well documented — assertion bounds
are a known source of instability, with one study attributing ineffective
tests to <cite index="1-1">the inappropriate setting of test case
assertion boundaries</cite>, and the practice of *widening* assertion
bounds to make flaky tests pass being common enough to have dedicated
tooling. Widening a bound until the test stops failing is precisely the
move that turns a witness vacuous, so the skills report instability as a
finding rather than resolving it.

Decision 6: Baseline Sanctity
------------------------------

**Claim**: a verification mechanism that can corrupt the working tree is
a net negative regardless of its analytical merit.

This decision is engineering judgment rather than a literature result.
Falsification requires mutating the user's code in place; a mutation
left behind after an interrupted run is a silent, actively harmful
defect. The skills therefore capture a restore anchor before the first
falsifier (a dangling `git stash create` commit, or verbatim file copies
outside Git), write a recovery journal to `.ase/proof/journal.json`,
restore after *every* falsifier, and *verify* the restoration by content
hash. An unverifiable restoration aborts execution and forces the
verdict to `NOT PROVEN` — the analytical result is worth less than the
integrity of the tree.

What This Mechanism Does Not Claim
-----------------------------------

Intellectual honesty about the limits matters more here than anywhere
else, since the mechanism's whole purpose is to prevent overstated
confidence.

-   **It is not a correctness proof.** `PROVEN` means every stated claim
    was checked by a witness demonstrated to be sensitive to that
    claim's negation. Claims nobody thought to state remain unchecked.
    The mechanism improves the *quality* of the evidence, not the
    *completeness* of the specification.

-   **Falsifier quality bounds the result.** A `REVERT` falsifier is
    strong because it negates exactly the change under test. A `MUTATE`
    falsifier is only as good as the mutation chosen, and the
    operator-sensitivity finding above applies in miniature.

-   **The oracle problem is not solved.** The skills demand that oracles
    be implementation-independent and refuse to accept values read off
    the changed code, but they cannot verify that a specification is
    itself correct. Nothing can, from inside the system.

-   **Single-technique verification remains incomplete.** The classical
    finding holds: defect-detection techniques are <cite
    index="15-14">of broadly similar effectiveness individually, their
    relative effectiveness depends on the nature of the program and its
    faults, and they are consistently much more effective when used in
    combination</cite>. Proof obligations complement review
    (`ase-meta-review`), static analysis (`ase-code-analyze`), and
    linting (`ase-code-lint`); they do not replace them.

-   **`ase-test-audit` suspects; only `ase-test-prove` decides.** The
    audit is static. It flags oracles that look implementation-derived
    and assertions that look insensitive, and it names the mutation that
    would settle each question — but a static suspicion is a hypothesis,
    and only execution discharges it.

References
----------

-   Inozemtseva, L., Holmes, R.: *Coverage Is Not Strongly Correlated
    with Test Suite Effectiveness*. ICSE 2014, pp. 435-445.
-   Papadakis, M., et al. / Kintis, M., et al.: *How Effective Are
    Mutation Testing Tools? An Empirical Analysis of Java Mutation
    Testing Tools with Manual Analysis and Real Faults*. Empirical
    Software Engineering, 2018.
-   Petrović, G., Ivanković, M., Fraser, G., Just, R.: *Does Mutation
    Testing Improve Testing Practices?* ICSE 2021.
-   Chekam, T.T., Papadakis, M., Le Traon, Y., Harman, M.: *An Empirical
    Study on Mutation, Statement and Branch Coverage Fault Revelation
    that Avoids the Unreliable Clean Program Assumption*. ICSE 2017.
-   Gligoric, M., et al.: *Comparing Non-Adequate Test Suites Using
    Coverage Criteria*. ISSTA 2013.
-   Kochhar, P.S., Thung, F., Lo, D.: *Code Coverage and Test Suite
    Effectiveness: Empirical Study with Real Bugs in Large Systems*.
    SANER 2015.
-   *Mutation Coverage Is Not Strongly Correlated with Mutation
    Coverage*. AST 2024.
-   Schäfer, M., Nadi, S., Eghbali, A., Tip, F.: *An Empirical
    Evaluation of Using Large Language Models for Automated Unit Test
    Generation*. arXiv:2302.06527.
-   *Consistency Meets Verification: Enhancing Test Generation Quality
    in Large Language Models Without Ground-Truth Solutions*.
    arXiv:2602.10522.
-   *Evaluating LLM-Based Test Generation Under Software Evolution*.
    arXiv:2603.23443.
-   Feathers, M.: *Working Effectively with Legacy Code*. Prentice Hall,
    2004. (characterization testing)
-   Popper, K.: *Logik der Forschung*. 1934. (falsifiability as the
    demarcation criterion)
