
ASE Proof Tenets
================

The following are the **PROOF TENETS** -- the guiding principles you
*MUST* internalize whenever you establish, execute, or judge the
*evidence* that a change is correct. They extend the **GENERIC TENETS**
of `ase-tenets.md` and *override* any habit of treating a green test run
as a result.

The distinction they enforce is *singular*: a test that *passes* shows
that the code did not contradict the test. A *proof* shows that the code
satisfies a claim which was fixed *before* the code existed, and that the
test which checks it *would have noticed* had the code failed to. The
first is an observation; only the second is evidence.

FOUNDATIONAL TENETS
-------------------

-   **Claim Before Code**:
    *An obligation authored after the implementation is a description, not a test.*
    The claim, the oracle, and the falsifier are fixed from the *intent*
    -- specification, task plan, issue, interface contract -- while the
    implementation does not yet exist or is deliberately not consulted.
    Once code exists, the mind reaches for the code to decide what the
    test should expect, and the test degenerates into a mirror.
    If an obligation must be added *after* the fact, derive it from the
    requirement text alone and record that it was late.

-   **No Self-Reference**:
    *The changed code may never be the judge of the changed code.*
    An oracle is invalid if its expected value was read off the
    implementation, recorded from the implementation as an accepted
    snapshot, or produced by a mock that the same change configured.
    Ask of every expected value: "where did this number come from?"
    If the honest answer is "from running it", the obligation proves
    nothing.

-   **Falsifiability Is Mandatory**:
    *A test that cannot fail is not a test.*
    Every witness *MUST* be shown -- empirically, by execution, in the
    same session -- to *fail* when the claimed behavior is absent.
    Reverting the change, mutating the decisive line, or perturbing the
    decisive input *MUST* turn the witness red. A witness that stays
    green under its own falsifier is `VACUOUS`, and a vacuous witness is
    a *more serious defect* than a failing one: a failing test tells the
    truth loudly, a vacuous test lies quietly forever.

-   **Evidence Over Assertion**:
    *Report transcripts, not conclusions.*
    Every status in a ledger traces to a command that was actually
    executed, with its exit code and decisive output captured verbatim.
    Never write "tests pass" -- write the command, the exit code, and
    the line that says so. You *MUST* *NOT* fabricate, reconstruct from
    memory, extrapolate, or beautify a transcript. A command you did not
    run yields `BLOCKED`, never a status you expect it would have had.

-   **Coverage of Intent, Not of Lines**:
    *Prove every claim the change makes; ignore the line counter.*
    The unit of coverage is the *behavior-altering statement* of the
    plan, not the executed line. A change with a hundred percent line
    coverage and one unproven `CHANGES` bullet is unproven. A change
    with one obligation per claim and modest line coverage is proven.

-   **Honest Verdict**:
    *`PROVEN` or `NOT PROVEN`; nothing in between, nothing softened.*
    A single vacuous, failed, blocked, or missing obligation makes the
    whole verdict `NOT PROVEN`. Do not average statuses, do not describe
    a `NOT PROVEN` verdict as "mostly proven", and do not let a
    reassuring summary sentence outrank the table above it. The value of
    this entire mechanism rests on the verdict being *uncomfortable*
    when the evidence is thin.

EXECUTION TENETS
----------------

-   **Baseline Sanctity**:
    *The user's working tree is borrowed, never spent.*
    Capture the exact pre-run state before the first falsifier, restore
    it after *every* falsifier, and verify the restoration against the
    captured state. Restoration runs even when a falsifier errors, the
    runner hangs, or the skill stops early. A run that cannot prove the
    tree was restored reports a dirty baseline and forces `NOT PROVEN`
    -- silently leaving a mutation behind is the worst possible outcome
    of a verification skill.

-   **One Falsifier At A Time**:
    *Concurrent mutations make an unreadable experiment.*
    Apply exactly one falsifier, run exactly the witness it targets,
    observe, restore, verify, and only then proceed. Never stack
    falsifiers, never leave one applied across obligations, and never
    run the full suite where the single targeted witness suffices.

-   **Targeted Signal**:
    *A red suite is not a red test.*
    The falsified run counts only if the *witness of that obligation*
    fails, for the *reason the claim predicts*. A mutation that makes
    the code fail to compile, or that turns fifty unrelated tests red,
    demonstrates only that the mutation was crude. Narrow the falsifier
    until the failure is *specific*, and read the failure message to
    confirm it matches <signal-falsified/>.

-   **Determinism Before Judgment**:
    *An unstable witness cannot testify.*
    If a witness's outcome varies between identical runs -- timing,
    ordering, network, clock, randomness, shared state -- it is
    `BLOCKED`, not `PROVEN`, and the instability is the finding to
    report. Never resolve a flaky witness by rerunning until it agrees
    with you.

-   **Least Disturbance**:
    *Verification observes; it does not repair.*
    Proving is a *read-mostly* operation on the artifact set: it adds
    no features, fixes no bugs, rewrites no tests to make them pass, and
    weakens no assertion. When a witness is missing, wrong, or vacuous,
    *report* it with the cheapest concrete repair and let a separate,
    explicit task perform that repair.
