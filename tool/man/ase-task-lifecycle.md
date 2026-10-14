# ase-task-lifecycle(1) -- Get or Set the Task Lifecycle Model

## SYNOPSIS

`ase task lifecycle`
\[`-h`|`--help`\]
\[*name*\]

## DESCRIPTION

**ase task lifecycle** gets or sets the task lifecycle model of the
current project in the task store (see `ase-task`(1)), i.e., the state
machine the `Status` frontmatter keys of its task plans follow (see
**TASK LIFECYCLE MODELS** in `ase-task`(1)).

Without *name*, the effective model is printed: for a local task store
(`ase:`, `github:`, `gitlab:`, or `gitea+`*scheme*`:`), which always
follows the configuration, the `project.task.lifecycle` configuration
(default: `solo`); for a remote task store (`ase://` or `ases://`),
the model the project is registered under in the task store, which is
shared by all clients of the project and hence registered under
`project.task.lifecycle` on first use only. A configured
`project.task.lifecycle` deviating from the model of a remote task
store is warned about once per deviation only (tracked in the
*per-user state directory* as `task-lifecycle.json`).

With *name*, the project in the task store is explicitly switched to
this model: for a local task store by setting `project.task.lifecycle`
on the `project` scope (see `ase-config`(1)), for a remote task store
by re-registering the project there. On every switch of the model, the
`Status` of the existing task plans is mapped onto the new model: a
state also existing in the new model is kept, else the first
candidate state existing in the new model wins (for a finished state
only a finished one), else the initial state (resp. the first finished
state) of the new model is used. For instance, from `solo` to `team`,
`OPEN` becomes `PLANNING` and `CLOSED` becomes `IMPLEMENTED`, and from
`enterprise` to `solo`, `PLANNED` and `IMPLEMENTING` become `OPEN` and
`INTEGRATED` becomes `CLOSED`. Plans without a `Status` key are left
alone, as they read as the initial state of any model. The switch is
logged as `task: set lifecycle model of project from "`*from*`" to
"`*name*`"`.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- \[*name*\]:
  The name of the task lifecycle model to switch to: `solo` (the
  single-phase lifecycle for a local solo developer), `team` (the
  two-phase lifecycle for a distributed small team), or `enterprise`
  (the four-phase lifecycle for a gated enterprise pipeline).

## FILES

- `.ase/config.yaml`:
  The `project` scope configuration receiving `project.task.lifecycle`
  on a switch of a local task store.

- *per-user state directory*`/task-lifecycle.json`:
  The deviations of the configured lifecycle model (and task id
  scheme) from the ones of a remote task store already warned about.

## EXIT STATUS

`0` on success, `1` on an unknown model *name* or an unreachable task
store.

## EXAMPLES

```sh
# print the effective task lifecycle model
$ ase task lifecycle
solo

# switch the project to the enterprise lifecycle model
$ ase task lifecycle enterprise
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-status`(1), `ase-task-idscheme`(1),
`ase-task-board`(1), `ase-config`(1), `ase-agent`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
