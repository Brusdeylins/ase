
##  NAME

`ase-task-preflight` - Preflight a Task Plan

##  SYNOPSIS

`ase-task-preflight`
    [`--help`|`-h`]
    [`--next`|`-n` *option*[,...]]
    [*id*]

##  DESCRIPTION

The `ase-task-preflight` skill performs a *preflight* (dry-run,
test-drive) of the *implementation* of a task plan by creating a
draft for a corresponding, complete *artifact change set* in
*unified diff* format. The draft is attached to the task plan as an
attachment block of type `text/x-diff; charset=utf-8; kind="preflight"` in the plan's
backmatter (replacing any previous draft). The attachment carries the
timestamps `Created:` (kept from a replaced draft) and `Modified:`
(the current time), while the `Modified:` key of the plan frontmatter
stays untouched, as it tracks body changes only; a draft whose
`Modified:` later falls behind the frontmatter counts as *stale*. No
source files are
modified. The draft is produced under the *same
tenets* and with the *same rigor* as a final implementation, because
`ase-task-implement` later takes it over *1:1* after user review --
only the actual artifact modification and the verification phase
are deferred. Bullet-points in state `[-]` (cancelled) or `[>]`
(deferred) are *skipped* by the draft, exactly as by the final
implementation.

The draft is based on the artifact state the final implementation
will find, mirroring the `Branch:` handling of `ase-task-implement`:
if the plan's `Branch:` key is absent, is the literal `current`, or
equals the checked-out branch, the *working copy* content is used;
if it names an *existing* other branch, the content of that branch is
used; otherwise the content of `HEAD` is used, as the branch will be
created from there.

The *kind of change* stated by the plan's `Kind:` frontmatter key
(`SPECIFYING`, `CRAFTING`, `REFACTORING`, or `RESOLVING`) selects which
*operation-specific tenet set* of the **ASE Tenets** is internalized
before the draft is produced, in addition to the always applying
**GENERIC TENETS**. If a plan carries no such key, the kind is
*inferred* from the plan content, defaulting to `CRAFTING`.

After the preflight, the user is asked whether to stop, hand
off to `ase-task-edit`, or hand off to `ase-task-implement`,
unless `--next` pre-selects this choice.

##  OPTIONS

-   `--next`|`-n` *option*[,...]:
    Automatically answer the user dialog for the next step. *option*
    is a single token or a *comma-separated chronological list* of
    tokens; the *first* token is consumed by this skill, and any
    remaining tokens are *forwarded* (via `--next`) to the downstream
    skill so an entire pipeline can be pre-scripted in one shot.
    Recognized tokens at this skill: `none` (default, interactive
    answer required), `DONE` (stop), `EDIT` (hand off to
    `ase-task-edit`), or `IMPLEMENT` (hand off to
    `ase-task-implement`). Example: `--next IMPLEMENT,DONE` runs the
    preflight, hands off to implementation, then exits without asking.

##  ARGUMENTS

-   *id*:
    The unique identifier of the task whose plan should be
    preflighted. If omitted, the *current* task id is used.

##  SCENARIOS

-   You want a dry-run of a plan's implementation
-   You want the change set previewed as a unified diff before applying
-   You want an implementation draft to review before committing to it
-   You want a plan test-driven without touching any source files

##  EXAMPLES

Preflight the current task plan:

```text
❯ /ase-task-preflight
```

Preflight a specific task and hand off to implementation when done:

```text
❯ /ase-task-preflight --next IMPLEMENT hello
```

##  SEE ALSO

[`ase-task-edit`](../ase-task-edit/help.md), [`ase-task-implement`](../ase-task-implement/help.md), [`ase-task-reboot`](../ase-task-reboot/help.md),
[`ase-task-view`](../ase-task-view/help.md).
