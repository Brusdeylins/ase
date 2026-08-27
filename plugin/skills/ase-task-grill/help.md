
##  NAME

`ase-task-grill` - Iteratively Grill a Task Plan

##  SYNOPSIS

`ase-task-grill`
    [`--help`|`-h`]
    [`--rounds`|`-r` *n*]
    [`--next`|`-n` *option*[,...]]
    [*id*]

##  DESCRIPTION

The `ase-task-grill` skill *relentlessly interviews* the user about
every *essential aspect* of an existing *task plan* until a *shared
understanding* is reached and no decisions or questions are left open.

The skill identifies the essential aspects of the plan and raises up to
10 questions per round which resolve its open points. Each question
carries a `FOCUS-AREA` -- `DOMAIN` (domain-specifics, must be
clarified), `INTERFACE` (externally observable behavior or UI/API
interfaces, must be clarified), `ARCHITECTURE` (structure, wiring,
placement, or dependencies, should be clarified), or `IMPLEMENTATION`
(inner technical details, can be clarified) -- and a 1-2 word `ASPECT`
hint. The questions are sorted primarily by descending focus area
importance (`DOMAIN`, `INTERFACE`, `ARCHITECTURE`, `IMPLEMENTATION`)
and secondarily by the decision tree of their dependencies, so each
decision is asked after the decisions it depends on. It honors checks
for *fuzzy language*, *conflicting terminology*, *conflicting code*,
*non-concrete scenarios*, *unspecified architecture patterns*, and
*unspecified dependencies*.

In contrast to the batch grilling of `ase-code-edit --grill`, the
questions are asked *sequentially*, one at a time: each question is
announced as an `ASPECT n/N ▶ FOCUS ▷ ASPECT, QUESTION` line and then
raised via an interactive dialog presenting two to four *grounded*
answer alternatives labeled `A1`-`A4` (the current plan, marked with
`⚑`, plus alternatives derived from the code base and world knowledge),
the fixed `SKIP GRILLING` option (skip the remaining questions and
rounds, keeping the answers gathered so far), and free-text input.
Cancelling the dialog stops the skill and leaves the plan untouched.
Once all aspects are resolved, the plan is updated and persisted, its
`Properties:` frontmatter key gains the value `grilled`, and the user is
offered a hand-off to editing, implementation, or preflight.

##  OPTIONS

`--rounds`|`-r` *n*:
    The number of grill rounds to apply (default: `1`). Each round
    starts from scratch from only the current plan, as updated by all
    previous rounds, and re-derives its questions from it, forgetting
    all questions and answers of previous rounds. With more than one
    round, each round is announced as `GRILLING ROUND K/L`.

`--next`|`-n` *option*[,...]:
    Automatically answer the user dialog for the next step (at the end
    of this skill). *option* is a single token or a *comma-separated
    chronological list* of tokens; the *first* token is consumed by
    this skill and any remaining tokens are *forwarded* (via `--next`)
    to the downstream skill on hand-off so an entire pipeline can be
    pre-scripted in one shot. Recognized tokens at this skill: `none`
    (default, interactive answer required), `DONE` (no next step),
    `EDIT` (hand-over to `ase-task-edit`), `IMPLEMENT` (hand-over to
    `ase-task-implement`), or `PREFLIGHT` (hand-over to
    `ase-task-preflight`).

##  ARGUMENTS

*id*:
    Grill the task with the unique identifier *id* (default: `default`).
    The skill accepts *only* an optional *id* argument and never a
    free-text instruction.

##  SCENARIOS

-   You want to be interviewed about your plan until it is watertight
-   You want the open decisions of a plan resolved question by question
-   You want fuzzy language and conflicts flushed out of a plan
-   You want shared understanding before the implementation starts

##  EXAMPLES

Grill the current task plan:

```text
❯ /ase-task-grill
```

Grill the task plan under id `hello`:

```text
❯ /ase-task-grill hello
```

Grill the current task plan in two rounds:

```text
❯ /ase-task-grill --rounds 2
```

Grill the current task plan and then hand off to editing:

```text
❯ /ase-task-grill --next EDIT
```

##  SEE ALSO

[`ase-task-edit`](../ase-task-edit/help.md), [`ase-task-reboot`](../ase-task-reboot/help.md), [`ase-task-preflight`](../ase-task-preflight/help.md),
[`ase-task-implement`](../ase-task-implement/help.md), [`ase-task-view`](../ase-task-view/help.md), [`ase-task-list`](../ase-task-list/help.md),
[`ase-task-rename`](../ase-task-rename/help.md), [`ase-task-delete`](../ase-task-delete/help.md), [`ase-code-edit`](../ase-code-edit/help.md).
