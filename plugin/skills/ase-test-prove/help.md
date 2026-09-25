
##  NAME

`ase-test-prove` - Prove a Task Plan Implementation

##  SYNOPSIS

`ase-test-prove`
    [`--help`|`-h`]
    [`--infer`|`-i`]
    [`--no-falsify`]
    [`--next`|`-n` *option*[,...]]
    [*id*]

##  DESCRIPTION

The `ase-test-prove` skill discharges the proof obligations of a task
plan against the *actual* implementation and emits a `PROVEN` /
`NOT PROVEN` verdict backed by captured transcripts, persisted as a
`##  PROOF LEDGER` section of the plan.

For each obligation it performs a *two-sided experiment*. The positive
run executes only that obligation's witness and must produce the
expected pass signal. The witness is then run a second time to detect
instability. Finally the obligation's *falsifier* is applied — the
change under test is reverted, the decisive line is mutated, or the
decisive input is perturbed — and the same witness is executed again. It
must now *fail*, and fail for the reason the claim predicts.

The falsified run is what separates a proof from an observation. A
witness that stays green while the behavior it claims to check is absent
is recorded as `VACUOUS`, and a vacuous witness is a more serious defect
than a failing one: a failing test tells the truth loudly, a vacuous
test lies quietly forever.

Every status traces to a command that was actually executed, with its
exit code and decisive output captured verbatim. Transcripts are never
reconstructed, and a command that was not run yields `BLOCKED` rather
than the status it would presumably have had.

The verdict is `PROVEN` if and only if every obligation is `PROVEN`,
every behavior-altering `CHANGES` bullet is the source of at least one
obligation, and the working tree was verifiably restored. There is no
intermediate verdict.

Falsifiers modify the working tree in place. Before the first one, the
skill captures a restore anchor — a dangling `git stash create` commit
in a Git working tree, verbatim file copies otherwise — and writes a
recovery journal to `.ase/proof/journal.json`. After *every* falsifier
the affected files are restored and the restoration is *verified* by
content hash. A restoration that cannot be verified aborts all remaining
execution, is reported, and forces the verdict to `NOT PROVEN`.

The skill observes and never repairs: it will not fix a failing
implementation, rewrite a witness to make it pass, or weaken an
assertion. Repairs are handed off explicitly.

##  OPTIONS

`--infer`|`-i`:
    Derive the proof obligations now, from the plan text alone, when the
    plan carries no `PROOF` section. The derivation refuses to consult
    the implementation, but obligations fixed after the fact are a
    weaker guarantee than claim-before-code, and the ledger records that
    caveat. Without this flag a missing `PROOF` section is an error.

`--no-falsify`:
    Run only the positive side of each experiment. Since witness
    sensitivity then remains unproven, *every* obligation is recorded as
    `BLOCKED` and the verdict is necessarily `NOT PROVEN`. Intended for
    a quick status check, never as evidence.

`--next`|`-n` *option*[,...]:
    Automatically answer the user dialog for the next step. *option*
    is a single token or a *comma-separated chronological list* of
    tokens; the *first* token is consumed by this skill, and any
    remaining tokens are *forwarded* (via `--next`) to the downstream
    skill. Recognized tokens at this skill: `none` (default,
    interactive answer required), `DONE` (stop), `EDIT` (hand off to
    `ase-task-edit`), or `RESOLVE` (hand off to `ase-code-resolve` with
    the strongest ledger finding; offered only on a `NOT PROVEN`
    verdict).

##  ARGUMENTS

*id*:
    The unique identifier of the task whose plan should be proven. If
    omitted, the *current* task id is used.

##  EXAMPLES

Prove the current implementation:

```text
❯ /ase-test-prove
```

Prove a plan that never received obligations, accepting the weaker
guarantee:

```text
❯ /ase-test-prove --infer
```

Prove and, if the verdict is negative, go straight to resolving the
strongest finding:

```text
❯ /ase-test-prove --next RESOLVE
```

##  SEE ALSO

[`ase-test-obligate`](../ase-test-obligate/help.md), [`ase-test-audit`](../ase-test-audit/help.md),
[`ase-task-implement`](../ase-task-implement/help.md), [`ase-code-resolve`](../ase-code-resolve/help.md),
[`ase-meta-review`](../ase-meta-review/help.md), [`ase-task-view`](../ase-task-view/help.md).
