
##  NAME

`ase-spec-edit` - Edit Specification

##  SYNOPSIS

`ase-spec-edit`
    [`--help`|`-h`]
    [`--grill`|`-g`]
    [`--grill-rounds`|`-r` *n*]
    [`--verify`|`-v`]
    [`--worktree`|`-w`]
    [`--loop`|`-l`]
    [*query*]

##  DESCRIPTION

The `ase-spec-edit` skill edits the *SpecBook*-based specification
(`SPEC`) *directly* from a *query*, in one shot and without any task
plan ceremony. It is the specification-level counterpart of
`ase-code-edit` and a *plan-less* alternative to `ase-sync-import` and
`ase-sync-reconcile` whenever the specification has to be changed from a
plain description instead of from a foreign source or another artifact
kind.

Each single-shot run (or each `--loop` iteration) walks through five
states: *querying* (take the *query* argument or ask for a query via an
interactive `Edit Query` dialog, and split it into its domain-specific
WHAT and its implementation-detail HOW parts), *discovering* (resolve
the `SPEC` artifacts, read the *SpecBook* schema configuration of the
project, and read the specification artifacts related to the query),
*grilling* (optionally stress-test the query with rounds of questions),
*implementing* (apply the change set in place, honoring the GENERIC and
SPECIFYING tenets and the `SPEC` format contract), and *verifying*
(optionally validate the specification until it passes). The *querying*
state and every *grilling* round close with an `EDIT TODO` box showing
the established `WHAT` and `HOW` information.

The change set stays strictly restricted to the `SPEC` artifacts -- the
artifact kinds `CODE`, `DOCS`, `TASK`, `INFR`, and `OTHR` are never
touched. Every generated artifact carries the current `Created:` and
`Modified:` timestamps, and every changed artifact gets its `Modified:`
timestamp refreshed.

##  OPTIONS

-   `--grill`|`-g`:
    Grill the query before implementing, similar to `ase-task-grill`:
    raise 1-10 questions per round which resolve the open points of the
    query. Each question carries a `FOCUS-AREA` -- `DOMAIN`
    (domain-specifics, must be clarified), `INTERFACE` (externally
    observable behavior or UI/API interfaces, must be clarified),
    `ARCHITECTURE` (structure, wiring, placement, or dependencies,
    should be clarified), or `IMPLEMENTATION` (inner technical details,
    can be clarified) -- and a 1-3 word `TOPIC` hint. The questions of a
    round are sorted by descending focus area importance (`DOMAIN`,
    `INTERFACE`, `ARCHITECTURE`, `IMPLEMENTATION`) and are announced
    together below a `GRILLING ROUND K/L` line (the round numbering is
    omitted when only a single round is performed) as a
    `QUESTION`/`ANSWERS` table with one row per question, each row
    carrying two to three grounded answer alternatives (with the
    alternative reflecting the current understanding marked with `⚑`).
    They are then asked in *one* batch via a single interactive dialog,
    whose question asks for the combined answer to all (or a subset) of
    the listed questions and whose only answer options are the fixed
    `SKIP GRILLING` (skip the remaining grilling) and `STOP SKILL` (stop
    the skill) ones, plus free-text input. The answers are merged back
    into the WHAT and HOW parts of the query. Without `--grill`, no
    questions are asked at all.

-   `--grill-rounds`|`-r` *n*:
    The number of grill rounds to apply (default: `1`). Each round
    starts from scratch from only the current WHAT and HOW parts,
    forgetting all information of previous rounds, and closes with an
    `EDIT TODO` box. Only effective together with `--grill`.

-   `--verify`|`-v`:
    Verify the edited specification by validating it via *SpecBook*
    linting and fixing the reported diagnostics in the affected `SPEC`
    artifacts, for at most three rounds. Any diagnostics remaining after
    the last round are listed as `REMAINING DIAGNOSTICS`. Without
    `--verify`, strictly no validation is performed at all.

-   `--worktree`|`-w`:
    Apply the change sets inside a dedicated Git worktree (as
    `ase-task-implement --worktree`) instead of the current working
    copy. One single worktree, named by a two-word id derived from the
    first query, serves the whole skill run: all `--loop` iterations
    land in it and it is left uncommitted for review. Under `--verify`,
    the validation then runs as the `ase spec lint` command inside the
    worktree.

-   `--loop`|`-l`:
    Loop the whole state cycle: after each iteration, ask for the next
    edit query via the interactive `Edit Query` dialog and repeat, until
    the user answers with its fixed `STOP SKILL` option or cancels the
    dialog.

##  ARGUMENTS

-   *query*:
    Description of the specification edit to perform. When omitted, the
    skill asks for the query via an interactive `Edit Query` dialog,
    carrying the fixed `STOP SKILL` option plus free-text input.

##  SCENARIOS

-   You want the specification edited in one shot from a description
-   You want `SPEC` changes without the task plan ceremony
-   You want the query stress-tested by grilling before the spec is edited
-   You want specification edits validated by SpecBook linting

##  EXAMPLES

Edit in one shot, without any questions or validation:

```text
❯ /ase-spec-edit add a Reviewer persona to the persona model
```

Grill the query with two rounds first, then edit and validate:

```text
❯ /ase-spec-edit -g -r 2 -v split the Event entity into Event and EventSeries
```

Loop over multiple specification edits inside a dedicated Git worktree:

```text
❯ /ase-spec-edit -l -w
```

##  SEE ALSO

[`ase-code-edit`](../ase-code-edit/help.md), [`ase-sync-import`](../ase-sync-import/help.md), [`ase-sync-reconcile`](../ase-sync-reconcile/help.md),
[`ase-sync-export`](../ase-sync-export/help.md), [`ase-task-grill`](../ase-task-grill/help.md).
