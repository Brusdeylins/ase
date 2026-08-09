
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
*unified diff* format. The draft is appended to the task plan as
an `IMPLEMENTATION DRAFT` section (replacing any previous draft) and
the plan's `Properties:` frontmatter key gains the value `preflighted`.
No source files are modified. The draft is produced under the *same
tenets* and with the *same rigor* as a final implementation, because
`ase-task-implement` later takes it over *1:1* after user review --
only the actual artifact modification and the verification phase
are deferred.

The *kind of change* stated by the plan's `Kind:` frontmatter key
(`CRAFTING`, `REFACTORING`, or `RESOLVING`) selects which
*operation-specific tenet set* of the **ASE Tenets** is internalized
before the draft is produced, in addition to the always applying
**GENERIC TENETS**. If a plan carries no such key, the kind is
*inferred* from the plan content, defaulting to `CRAFTING`.

After the preflight, the user is asked whether to stop, hand
off to `ase-task-edit`, or hand off to `ase-task-implement`,
unless `--next` pre-selects this choice.

##  OPTIONS

`--next`|`-n` *option*[,...]:
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

*id*:
    The unique identifier of the task whose plan should be
    preflighted. If omitted, the *current* task id is used.

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
