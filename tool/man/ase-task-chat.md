# ase-task-chat(1) -- Chat with the Agent Tool about a Task

## SYNOPSIS

`ase task chat`
\[`-h`|`--help`\]
\[*id*\]

## DESCRIPTION

**ase task chat** attaches the terminal to the *task chat* of the task
*id*: the interactive session of the agent tool (`claude`) about the
task, as it is also shown by the web board (see `ase-task-board`(1),
section **Task Chat**). The chat process is not a child of the command
but is run, and kept running, by the ASE service of the project
(started on demand, see `ase-service`(1)), which is why

- the chat survives detaching, closing the terminal, and quitting the
  command, so a later `ase task chat` shows the entire output of the
  chat again and continues it,

- the chat is shared with the web board, and with any other terminal
  attached to the same task, where the chat has the size of the
  smallest of the attached terminals, and

- several chats of different tasks run in parallel.

If the chat process does not run yet, it is started with the model and
effort kept for the task (and resuming its session, if it exists); a
chat process which ended is started again.

The bytes of the terminal are passed through to the chat process and
back unchanged (the terminal itself renders them, so images and the
mouse work like in the agent tool directly), and the size of the
terminal is passed on at the start and whenever it changes.

The chat is detached from with `Ctrl`+`Q` (which the agent tool does
not bind), or by closing the terminal. On detaching, the terminal is
restored, and the line `detached from the chat of task` *id* `(still
running)` is printed. When the chat process ends (e.g., through `/exit`
of the agent tool), the command ends with the exit code of the chat
process.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- \[*id*\]:
  The id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`
  (default: `$ASE_TASK_ID`, else `default`).

## ENVIRONMENT

- `ASE_TASK_ID`:
  The default of *id*.

## EXIT STATUS

`0` on detaching or the end of the chat process with exit code `0`, the
exit code of the chat process otherwise, and `1` on a failure (like the
missing terminal on standard input or output, an ASE service of older
ASE code, or a lost connection to the service).

## EXAMPLES

```sh
# chat about a task, detach with Ctrl+Q, and later continue
$ ase task chat json-export
$ ase task chat json-export
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-board`(1), `ase-service`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
