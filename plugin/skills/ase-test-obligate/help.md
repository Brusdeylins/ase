
##  NAME

`ase-test-obligate` - Derive the Proof Obligations of a Task Plan

##  SYNOPSIS

`ase-test-obligate`
    [`--help`|`-h`]
    [`--strict`|`-s`]
    [`--next`|`-n` *option*[,...]]
    [*id*]

##  DESCRIPTION

The `ase-test-obligate` skill fixes the *proof obligations* of a task
plan *before* the implementation exists, and persists them as a
`##  PROOF` section of the plan.

A proof obligation is not a test case. It is a falsifiable *claim* about
the system, stated in the language of the requirement, together with the
*oracle* that decides its truth independently of the implementation, the
*witness* that carries it, and — decisively — the *falsifier* that must
make the witness fail. A test that cannot be made to fail proves
nothing, so every obligation carries the exact revert, mutation, or
perturbation that later has to redden it.

The order matters more than the content. Once an implementation exists,
expected values get read off the code and the test degenerates into a
mirror of what was built. Running this skill *before*
`ase-task-implement` is therefore the entire point: the claims are
derived from the `CONTEXT` and `CHANGES` sections, from the
specification and interface contracts, and from the behavior of the
*unchanged* system — never from the diff. The skill refuses to read an
`IMPLEMENTATION DRAFT` section for this reason.

Obligations are derived per change kind: a bug fix must carry the
`REGRESSION` reproducer of the original defect, a refactoring must carry
`INVARIANT` claims of behavior preservation, a new feature must carry
the `NEGATIVE` and `BOUNDARY` claims of its interface. Every
behavior-altering `CHANGES` bullet must be the source of at least one
obligation; bullets that are deliberately unobservable are recorded as
explicit exemptions rather than silently skipped.

The obligations are discharged later by `ase-test-prove`, which executes
each witness, applies its falsifier, and emits a verdict.

##  OPTIONS

`--strict`|`-s`:
    Refuse to persist the proof section if any obligation lacks an
    implementation-independent oracle. Without this flag such
    obligations are persisted with their gap recorded and reported as a
    warning.

`--next`|`-n` *option*[,...]:
    Automatically answer the user dialog for the next step. *option*
    is a single token or a *comma-separated chronological list* of
    tokens; the *first* token is consumed by this skill, and any
    remaining tokens are *forwarded* (via `--next`) to the downstream
    skill so an entire pipeline can be pre-scripted in one shot.
    Recognized tokens at this skill: `none` (default, interactive
    answer required), `DONE` (stop), `EDIT` (hand off to
    `ase-task-edit`), `PREFLIGHT` (hand off to `ase-task-preflight`),
    `IMPLEMENT` (hand off to `ase-task-implement`), or `PROVE` (hand off
    to `ase-test-prove`).

##  ARGUMENTS

*id*:
    The unique identifier of the task whose plan should receive the
    proof obligations. If omitted, the *current* task id is used.

##  EXAMPLES

Fix the obligations of the current task plan:

```text
❯ /ase-test-obligate
```

Fix the obligations, then implement and immediately prove:

```text
❯ /ase-test-obligate --next IMPLEMENT,DONE
❯ /ase-test-prove
```

Insist on independent oracles:

```text
❯ /ase-test-obligate --strict
```

##  SEE ALSO

[`ase-test-prove`](../ase-test-prove/help.md), [`ase-test-audit`](../ase-test-audit/help.md),
[`ase-task-implement`](../ase-task-implement/help.md), [`ase-task-preflight`](../ase-task-preflight/help.md),
[`ase-task-grill`](../ase-task-grill/help.md), [`ase-task-view`](../ase-task-view/help.md).
