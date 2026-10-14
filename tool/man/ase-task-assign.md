# ase-task-assign(1) -- Assign a Task

## SYNOPSIS

`ase task assign`
\[`-h`|`--help`\]
\[`-s`|`--session` *id*\]
\[*id*\[`:`\]\]
*assignee*

## DESCRIPTION

**ase task assign** assigns the task plan with the given *id* in the
task store (see `ase-task`(1)) by setting its `Assignee` frontmatter
key to *assignee*, where `me` stands for the current user and `none`
removes the key. The change is done in a conditional save of the task
plan (retried on a concurrent change of the task), leaving the
`Modified` key alone, as it tracks the changes of the plan body only.
The change is logged as `task: assigned "`*id*`" from "`*from*`" to
"`*to*`"`.

With `--session`, the assignment is instead done on behalf of an agent
tool session through the running `ase service` of the project (see
`ase-service`(1)), which handles the *AI usage window* of the task, too
(only if the AI usage accounting is enabled via `telemetry.enabled`,
else a notice is reported):

- Assigning the task to oneself opens its usage window (or attaches
  the session to an already open one).

- Assigning the task to anybody else closes its usage window and,
  after a grace period of 10 seconds for late telemetry, atomically
  adds the usage accumulated from the OTLP records of its sessions
  (see `ase-setup-telemetry`(1)) to the YAML data of the usage
  attachment of the task (`Type: application/yaml; kind="usage"`,
  created on the first booking): `time.ai` (the AI request time in
  minutes), `time.hr` (the human time in minutes, i.e., the whole real
  time of the window), `time.real` (the wall-clock time of the window
  in minutes), `token.cread`, `token.cwrite`, `token.input`, and
  `token.output` (the disjoint token counts of the cache reads, cache
  writes, uncached input, and output), `cost.ai` (the AI costs in USD,
  as reported by the agent tool, else derived from
  `telemetry.prices.ai`), and `cost.hr` (the human costs in USD, at the
  hourly rate of the assignee in `telemetry.prices.hr`).

A usage window also closes when its last session ends, and when the
`Assignee` of its task is changed elsewhere while the task is the
active task of an attached session. Conversely, once the `Assignee` of
a task is changed to oneself elsewhere (e.g., on the task board), the
service opens its window (starting *paused*) and attaches every session
of the project whose active task it is. Open windows additionally book
every `telemetry.service.interval` minutes, pause after
`telemetry.service.idle` minutes without any AI request of an attached
session (resumed silently by the next one, without accounting the
paused gap), and are closed and booked after 7 days without any
activity. The result is logged together with the action on the usage
window and the booked usage. This is what the `ase_task_assign` MCP
tool of the `ase-task-assign` skill does for the current session.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-s`|`--session` *id*\]:
  Assign the task on behalf of the agent tool session *id* through the
  running `ase service` of the project (whose port is read from
  `.ase/service.yaml`), which additionally handles the AI usage window
  of the task (see **DESCRIPTION**). The service is not started on
  demand, so it has to run already.

## ARGUMENTS

- \[*id*\[`:`\]\]:
  The id of the task (default: `$ASE_TASK_ID`, else `default`). A
  trailing colon is stripped. If only a single argument is given, it is
  taken as *assignee*, unless it has a trailing colon (then it is the
  *id*, and the missing *assignee* is an error).

- *assignee*:
  The new assignee of the task: `me` for the current user (the value
  of `$USER`, else `$LOGNAME`, else `unknown`), `none` to remove the
  `Assignee` key, or any other non-empty single-line name without
  commas.

## ENVIRONMENT

- `ASE_TASK_ID`:
  The default task id (default: `default`).

- `USER`, `LOGNAME`:
  The current user, as substituted for `me`.

## EXIT STATUS

`0` on success, `1` if the *assignee* is missing or invalid, no such
task exists, or (with `--session`) the service is not reachable.

## EXAMPLES

```sh
# take the task "json-export"
$ ase task assign json-export me

# give the task back
$ ase task assign json-export none

# hand the task of $ASE_TASK_ID over to the implementer agent
$ ase task assign implementer
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-service`(1), `ase-setup-telemetry`(1),
`ase-config`(1), `ase-agent`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
