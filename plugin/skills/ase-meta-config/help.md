
##  NAME

`ase-meta-config` - Configuration Management

##  SYNOPSIS

`ase-meta-config`
    [`--help`|`-h`]
    [`--scope`|`-s` *scope*]
    *operation*
    [*args*]

##  DESCRIPTION

The `ase-meta-config` skill lists, reads, writes, and removes the values
of the *layered ASE configuration* from inside the assistant session. It
mirrors the non-interactive subcommands of the `ase config` CLI, but
performs *every* access through the `ase_config_list`, `ase_config_get`,
`ase_config_set`, and `ase_config_delete` tools of the `ase` MCP server -
it never shells out and never touches a file directly.

The configuration is organized as a chain of *scopes*, canonically
ordered `default` < `user` < `project` < `task` < `session`. Reads
cascade from the strongest (rightmost) scope down to the weakest and
return the first value that is defined; writes are always confined to
the strongest (target) scope of the chain.

The recognized keys are grouped under `project.*` (`project.id`,
`project.name`, `project.boxing`, and the
`project.artifact.`*kind*`.{basedir,files}` globs) and `agent.*`
(`agent.persona`, `agent.guidance`, `agent.task`, and `agent.skill`).
Some keys are writable on selected scopes only; in particular
`agent.task` and `agent.skill` are writable on a `session` scope only,
and the `project.artifact.*` globs are writable on the `user` and
`project` scopes only.

The three keys steering the behaviour of the agent itself accept fixed
value sets: `agent.persona` selects the *communication style* and is one
of the decorative, eloquent, and explaining `writer`, the concise,
factual, and accurate `engineer` (the default), the layered,
pyramid-structured `journalist`, the brief, factual, and abbreviating
`telegrapher`, or the terse, rough, and stuttering `caveman`;
`agent.guidance` selects the number of unsolicited hints and is one of
`none`, `minimal`, `normal` (the default), or `verbose`; and
`project.boxing` selects the artifact transparency and is one of `white`,
`grey`, or `black`. Setting `agent.persona`, `agent.guidance`, or
`project.boxing` takes effect immediately, i.e. still within the running
session.

The following *operations* exist:

- `list`: List all effective configuration entries of the scope chain as
  a table of key, value, and the scope that supplied the value. For
  overlapping keys only the value of the strongest scope is shown.

- `get` *key*: Report the effective value at the dotted *key*, or
  `(not set)` if no scope of the chain defines it.

- `set` *key* *value*: Write *value* at the dotted *key* on the target
  scope. The value is validated against the configuration schema before
  it is persisted.

- `delete` *key*: Remove the value at the dotted *key* from the target
  scope. A key that is not present is silently ignored.

The `init` and `edit` subcommands of the `ase config` CLI are
deliberately *not* mirrored: `edit` is bound to the interactive `$EDITOR`
and therefore has no meaning inside an assistant turn, and `init` is a
preset-bootstrapping operation that stays a shell concern next to
`ase setup`. Both remain available as `ase config init` and
`ase config edit` on the command line.

##  OPTIONS

-   `--scope`|`-s` *scope*:
    The scope chain to operate on, given as a comma-separated list of
    `user`, `project`, `task:`*id*, and/or `session:`*id* terms, in any
    order and at most one term per kind. The `user` term is always
    implicitly added at the bottom of the chain, and `project` is
    implicitly added whenever a project context exists, but never above
    the strongest explicitly requested term. If the option is
    omitted, the chain of the *current session* (`session:`*id*) is used,
    so that reads see the full `user` -> `project` -> `session` cascade
    and writes -- including those to the session-only keys `agent.task`
    and `agent.skill` -- land on the session layer.

##  ARGUMENTS

-   *operation*:
    The operation to perform; one of `list`, `get`, `set`, or `delete`.

-   *args*:
    The operands of the operation: none for `list`, a dotted *key* for
    `get` and `delete`, and a dotted *key* plus a *value* for `set`.

##  SCENARIOS

-   You want the ASE configuration inspected or changed
-   You want the persona, guidance, or boxing switched for a session
-   You want a configuration value persisted at user or project scope
-   You want to see which scope supplies each effective value

##  EXAMPLES

List all effective configuration entries:

```text
❯ /ase-meta-config list
```

Report the effective persona style:

```text
❯ /ase-meta-config get agent.persona
```

Switch the communication style for the current session only:

```text
❯ /ase-meta-config set agent.persona telegrapher
```

Switch the project boxing for the current session only:

```text
❯ /ase-meta-config set project.boxing grey
```

Persist the guidance level for the whole project instead:

```text
❯ /ase-meta-config --scope project set agent.guidance minimal
```

Remove a value from the user-level configuration:

```text
❯ /ase-meta-config --scope user delete project.name
```

##  SEE ALSO

[`ase-task-id`](../ase-task-id/help.md).
