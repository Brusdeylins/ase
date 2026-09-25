
##  NAME

`ase-test-audit` - Audit the Evidentiary Quality of Tests

##  SYNOPSIS

`ase-test-audit`
    [`--help`|`-h`]
    [`--severity`|`-S` `LOW`|`MEDIUM`|`HIGH`]
    [`--scope`|`-c` `plan`|`suite`]
    [*id*]

##  DESCRIPTION

The `ase-test-audit` skill judges whether a body of tests *can prove
anything at all*. Its question is never "do the tests pass?" but "what
would have to be true for this test to fail, and is that the thing it
claims to check?"

The audit is dispatched to a silent sub-agent that reads the tests
together with the production code under test — the relationship between
the two is invisible from either side alone — and returns
severity-tagged, line-cited findings across eight dimensions:
`TAUTOLOGY` (the expected value came from the implementation),
`INSENSITIVITY` (the assertion cannot fail for the reason it exists),
`PROVENANCE` (the oracle has no traceable authority), `COVERAGE` (a
claim no test decides), `SCOPE` (a failure that would localize nothing),
`DETERMINISM` (an outcome that is not a function of the code),
`BOUNDARY` (only the comfortable middle of the input domain is
exercised), and `OBLIGATION` (a defect of the proof obligation itself).

Each finding carries the *mutation that would go undetected* and the
cheapest concrete repair. The verdict is `EVIDENCE INSUFFICIENT` if any
finding is `HIGH`, otherwise `EVIDENCE SOUND`.

This skill is *static*: it executes no test, applies no falsifier, and
modifies no file. It therefore *suspects* insensitivity where
`ase-test-prove` *demonstrates* it. Use the audit to survey a suite
cheaply and to critique obligations before they are relied upon; use
`ase-test-prove` to settle any individual question empirically.

##  OPTIONS

`--severity`|`-S` `LOW`|`MEDIUM`|`HIGH`:
    Render only findings at or above this severity floor (default:
    `LOW`). The floor never affects the verdict, only what is shown.
    `ACCEPTED` findings are always rendered, since their visibility is
    their purpose.

`--scope`|`-c` `plan`|`suite`:
    Audit either the `PROOF` and `VERIFICATION` sections of the task
    plan together with the test cases they cite (`plan`, the default),
    or the project's test suite (`suite`).

##  ARGUMENTS

*id*:
    With `--scope plan`, the unique identifier of the task whose plan
    should be audited; if omitted, the *current* task id is used. With
    `--scope suite`, a free-text designation of the subset of the suite
    to audit; if omitted, the whole suite is audited.

##  EXAMPLES

Audit the evidence of the current task plan:

```text
❯ /ase-test-audit
```

Survey the whole test suite for blocking defects only:

```text
❯ /ase-test-audit --scope suite --severity HIGH
```

Audit a named part of the suite:

```text
❯ /ase-test-audit --scope suite the option parser tests
```

##  SEE ALSO

[`ase-test-prove`](../ase-test-prove/help.md), [`ase-test-obligate`](../ase-test-obligate/help.md),
[`ase-code-lint`](../ase-code-lint/help.md), [`ase-code-analyze`](../ase-code-analyze/help.md),
[`ase-meta-review`](../ase-meta-review/help.md).
