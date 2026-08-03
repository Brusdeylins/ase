
##  NAME

`ase-task-implement` - Implement a Task Plan

##  SYNOPSIS

`ase-task-implement`
    [`--help`|`-h`]
    [`--next`|`-n` *option*[,...]]
    [`--worktree`|`-w`]
    [*id*]

##  DESCRIPTION

The `ase-task-implement` skill performs the *final implementation* of
a task plan by modifying the corresponding *artifacts* with a complete
*change set*. The plan is loaded and any optional `IMPLEMENTATION DRAFT`
section produced by `ase-task-preflight` is used as a hint - the plain
plan content always overrules the draft. Afterwards the plan's
`Properties:` frontmatter key gains the value `implemented` (plus
`verified`, if the verification phase actually ran and succeeded), and
its `Status:` key becomes `COMPLETED` if the change set was applied
completely and successfully.

The *kind of change* stated by the plan's `Kind:` frontmatter key
(`CRAFTING`, `REFACTORING`, or `RESOLVING`) selects which
*operation-specific tenet set* of the **ASE Tenets** is internalized
before any artifact is touched, in addition to the always applying
**GENERIC TENETS**. If a plan carries no such key, the kind is
*inferred* from the plan content, defaulting to `CRAFTING`.

If the task plan deliberately *omits* the `##  VERIFICATION` section
(as produced by `ase-code-craft`, `ase-code-refactor`,
`ase-code-resolve`, or `ase-task-edit` when invoked with `--dry`),
the entire verification phase is strictly skipped: no build, tests,
linter, type-checker, or program execution is performed once the
source files have been modified.

With `--worktree`|`-w`, the change set is *not* applied to the current
working copy: a *fresh Git WorkTree* `.ase/worktree/<id>` and its
equally named branch are created from `HEAD` *before* any artifact is
touched, and the entire implementation -- including all verification
runs -- then happens *inside* that worktree, which is left
*uncommitted*. The worktree is *not* named by an option value: it
always carries the unique *task id*, so worktree and branch stay tied
to the very task plan implemented in them. As the worktree branches off
`HEAD`, *uncommitted* changes of the current working copy are *not*
carried over into it.

After implementation, the user is asked whether to preserve or
delete the task plan, unless `--next` pre-selects this choice.

##  OPTIONS

`--next`|`-n` *option*[,...]:
    Automatically answer the user dialog for the next step. *option*
    is a single token or a *comma-separated chronological list* of
    tokens; the *first* token is consumed by this skill, and any
    remaining tokens are intentionally *discarded*, because the
    downstream `ase-task-delete` skill accepts no `--next` option.
    Recognized tokens at this skill: `none` (default, interactive
    answer required), `DONE` (preserve task plan and stop), or
    `DELETE` (hand off to `ase-task-delete`).

`--worktree`|`-w`:
    Apply the change set inside a dedicated *Git WorkTree* instead of
    the current working copy. The worktree directory `.ase/worktree/<id>`
    and its equally named branch are derived from the *task id* and
    created from `HEAD`. If either the directory or the branch already
    exists, the skill stops and touches nothing. By default, the change
    set is applied to the current working copy.

##  ARGUMENTS

*id*:
    The unique identifier of the task whose plan should be
    implemented. If omitted, the *current* task id is used.

##  EXAMPLES

Implement the current task plan:

```text
❯ /ase-task-implement
```

Implement a specific task and delete the plan when done:

```text
❯ /ase-task-implement --next DELETE hello
```

Implement the task `hello` inside the isolated Git WorkTree
`.ase/worktree/hello`:

```text
❯ /ase-task-implement --worktree hello
```

##  SEE ALSO

[`ase-task-edit`](../ase-task-edit/help.md), [`ase-task-preflight`](../ase-task-preflight/help.md), [`ase-task-reboot`](../ase-task-reboot/help.md),
[`ase-task-view`](../ase-task-view/help.md), [`ase-task-delete`](../ase-task-delete/help.md).

