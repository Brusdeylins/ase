
Proof
-----

A *task plan* may carry two additional, strictly formatted sections: the
`##  PROOF` section, which states the *proof obligations* a change must
discharge, and the `##  PROOF LEDGER` section, which records the
*empirical evidence* that they were discharged.

The two sections are *separate on purpose*. The `##  PROOF` section is
authored *before* the implementation exists, so that it can only be
derived from the *intent* of the plan. The `##  PROOF LEDGER` section is
authored *after* the implementation exists, from *captured* command
output only. Never author them in the same skill run, and never author
the ledger from expectation instead of observation.

### Proof Section

<format>

##  PROOF

-   **<obligation-id/>** ⟨<kind/>⟩ ⟵ <source/>
    -   **CLAIM**: <claim/>
    -   **ORACLE**: <oracle/>
    -   **WITNESS**: <witness/>
    -   **FALSIFIER**: ⟨<falsifier-kind/>⟩ <falsifier/>
    -   **SIGNAL**: pass=<signal-pass/>, falsified=<signal-falsified/>

-   [...]

</format>

You *MUST* honor the following hints on this *proof* format:

-   The <obligation-id/> is `PO` followed by a decimal number starting
    at `1`, numbered consecutively in the order of the obligations
    (`PO1`, `PO2`, ...). Ids are *stable*: once an obligation carries an
    id, that id is never reused for a different claim, even if earlier
    obligations are removed.

-   The <kind/> classifies *what* is claimed and is exactly one of:

    -   `BEHAVIOR`: an observable input/output behavior the change adds
        or alters.
    -   `REGRESSION`: the *concrete* misbehavior a bug fix removes,
        expressed as the reproducer of the original defect.
    -   `CONTRACT`: an interface, signature, protocol, schema, or type
        obligation at a boundary the change touches.
    -   `INVARIANT`: a property that must hold *across* the change,
        including behavior preservation under refactoring.
    -   `NEGATIVE`: a rejection, error, or failure path that must
        trigger for invalid input or state.
    -   `BOUNDARY`: a limit, edge, or degenerate case (empty, zero, one,
        maximum, overflow, concurrent, absent).

-   The <source/> is the *provenance* of the claim and *MUST* point at a
    statement that exists *independently of the implementation*: a
    `CHANGES` or `CONTEXT` bullet of this plan (cited as `CHANGES.<n/>`
    or `CONTEXT.WHAT`), a specification or architecture artifact (cited
    as `<file/>:<section/>`), an issue identifier, or a documented
    interface contract (cited as `<file/>:<line/>`). An obligation whose
    source is the *changed code itself* is *invalid* by construction --
    it proves only that the code agrees with itself.

-   The <claim/> is *one* falsifiable sentence in the *language of the
    requirement*, not of the implementation. It states what must be
    *true of the system*, phrased so that a reader who has never seen
    the diff can decide it. Name concrete values, not adjectives:
    `rejects a negative "timeout" with "ERR_RANGE"` rather than `handles
    bad input correctly`.

-   The <oracle/> states *how truth is decided* and *why that decision
    is independent of the implementation*. Valid oracles: a value stated
    in the specification, a hand-computed expected result, an
    independent reference implementation, a mathematical property
    (idempotence, round-trip, commutativity, monotonicity), a
    pre-existing recorded fixture, or the observable behavior of the
    *unchanged* system. Invalid oracles: the return value of the changed
    code, a snapshot recorded from the changed code and accepted without
    inspection, or a mock configured to return the expected answer.

-   The <witness/> is the *concrete executable evidence*: the test file
    and test case that carries the claim (cited as
    `<file/>::<case-name/>`) plus, when it is not implied by the project
    conventions, the exact command that runs *only* that case. If the
    witness does not exist yet, it is stated as the test case that the
    implementation *MUST* create, and the implementation is incomplete
    until it does.

-   The <falsifier-kind/> states *how* the witness is shown to be
    sensitive, and is exactly one of:

    -   `REVERT`: undo the change under test (reverse-apply the change
        hunks of the relevant files). The witness *MUST* fail. This is
        the *strongest* falsifier and the *required* one for `BEHAVIOR`,
        `REGRESSION`, and `NEGATIVE` obligations of a resolving or
        crafting task -- it proves the witness detects the *absence* of
        the very change being claimed.
    -   `MUTATE`: inject a *precisely stated* mutation into the changed
        code. The witness *MUST* fail. This is the required falsifier
        for `INVARIANT` obligations of a refactoring task, where a
        revert legitimately keeps the witness green and would therefore
        prove nothing.
    -   `PERTURB`: supply an input that violates the claim's
        precondition or an expectation that contradicts the claim. The
        witness *MUST* fail. Use only where neither a revert nor a
        mutation is applicable, e.g. for `CONTRACT` obligations checked
        by a schema or type checker.

-   The <falsifier/> is *executable in its precision*: for `REVERT` the
    exact file set whose change hunks are reverse-applied; for `MUTATE`
    the exact `<file/>:<line/>` plus the *verbatim* replacement
    (`<old-text/>` → `<new-text/>`); for `PERTURB` the exact input or
    expectation substitution. A falsifier stated as prose
    (`break the function`) is *not* a falsifier.

-   A `MUTATE` falsifier *MUST* negate *the claim*, not merely dirty the
    code. Deleting a whole function so that everything fails proves
    nothing about the claim; flipping the specific comparison, boundary,
    sign, or branch that the claim is *about* proves the witness watches
    that spot.

-   The <signal-pass/> and <signal-falsified/> state the *observable*
    outcome of the positive and the falsified run in a form a reader can
    check against a transcript: the expected exit code plus the decisive
    line, e.g. `exit=0, "12 passing"` and `exit≠0, "AssertionError:
    expected ERR_RANGE"`.

-   Every bullet of the `##  CHANGES` section that alters *observable
    behavior* *MUST* be the <source/> of at least one obligation.
    A `CHANGES` bullet that is deliberately unobservable (pure comment,
    formatting, documentation) is exempt, and its exemption is stated in
    the plan rather than left implicit.

-   In all sections, break all lines with a newline character after
    about 100 characters per line for better subsequent manual editing.

### Proof Ledger Section

<format>

##  PROOF LEDGER

⎈   Executed: <timestamp-executed/>
⚖   Verdict:  <verdict/>
⚗   Result:   <proven/>/<total/> proven, <vacuous/> vacuous, <failed/> failed, <blocked/> blocked
⌘   Baseline: <baseline/>

| ID | KIND | POSITIVE | FALSIFIED | STATUS |
| -- | ---- | -------- | --------- | ------ |
| <obligation-id/> | <kind/> | <positive/> | <falsified/> | <status/> |

### Evidence

-   **<obligation-id/>**: <finding/>

    ```text
    <transcript/>
    ```

</format>

You *MUST* honor the following hints on this *proof ledger* format:

-   The <status/> of each obligation is exactly one of:

    -   `PROVEN`: the positive run produced <signal-pass/> *and* the
        falsified run produced <signal-falsified/>. Only this status is
        evidence.
    -   `VACUOUS`: the positive run passed but the falsified run *also*
        passed. The witness is *insensitive* -- it cannot detect the
        absence of the claimed behavior, so it proves nothing. This is a
        *defect of the test*, and it is the single most important
        finding this ledger can carry.
    -   `FAILED`: the positive run did not produce <signal-pass/>. The
        *implementation* does not satisfy the claim.
    -   `BLOCKED`: the run could not be executed or its outcome could
        not be observed (missing witness, missing runner, unusable
        falsifier, restore failure). Never silently upgrade a `BLOCKED`
        obligation to any other status.

-   The <verdict/> is `PROVEN` *if and only if* every obligation is
    `PROVEN`, every behavior-altering `CHANGES` bullet is the source of
    at least one obligation, and the working tree <baseline/> was
    restored intact. Otherwise the verdict is `NOT PROVEN`. There is no
    intermediate verdict, and a verdict is *never* stated as `PROVEN`
    with qualifications in prose.

-   The <positive/> and <falsified/> cells carry the *observed* exit
    code and the decisive observed signal, never the expected one.

-   The <baseline/> is `restored` when the post-run working tree state
    matches the state captured before the first falsifier, and
    `DIRTY: <detail/>` otherwise. A dirty baseline forces the verdict to
    `NOT PROVEN` regardless of the obligation statuses.

-   Every <transcript/> is *captured verbatim* from the executed
    command: the command line, its exit code, and the decisive output
    lines (head and tail, elided in the middle with `[...]` when long).
    You *MUST* *NOT* paraphrase, reconstruct, beautify, or invent a
    transcript, and you *MUST* *NOT* write a transcript for a command
    you did not run. An obligation whose command was not run is
    `BLOCKED`, never `PROVEN`.

-   The <finding/> is one sentence stating what the evidence *shows*.
    For `VACUOUS`, `FAILED`, and `BLOCKED` it additionally states the
    *cheapest concrete repair* -- which assertion is missing, which
    behavior is wrong, which prerequisite is absent.
