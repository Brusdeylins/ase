
##  NAME

`ase-sync-reconcile` - Reconcile Artifact Set to Artifact Set

##  SYNOPSIS

`ase-sync-reconcile`
    [`--help`|`-h`]
    [`--bidirectional`|`-b`]
    [`--target`|`-t` *target*[,...]]
    [`--source`|`-s` *source*[,...]]
    [*hint*]

##  DESCRIPTION

The `ase-sync-reconcile` skill reconciles one set of artifact kinds (the
*target*) to *reflect* the *current state* of another set of artifact
kinds (the *source*). It reads the source artifacts and then adjusts the
target artifacts *directly* and *surgically* to match the source state,
while optionally honoring a filtering *hint*.

Both *target* and *source* are comma-separated lists over the six
recognized artifact kinds `SPEC` (Specification, covering both
requirements and architecture), `CODE` (Source Code), `DOCS`
(Documentation), `TASK` (Task Plans), `INFR` (Infrastructure), and
`OTHR` (catch-all). When *source* is `auto`, it resolves to all six
kinds *minus* the kinds listed in *target*. Unless `--bidirectional` is
given, a kind present in *target* is never used as its own source.

The file lists for all involved kinds are resolved via the
`ase_artifact_list` MCP tool of the `ase` MCP server. While reconciling,
the skill honors the artifact-format conventions of `ase-format-meta.md`,
`ase-format-spec.md` (the *SpecBook* models and formats plus the
SpecBook schema configuration), and `ase-format-task.md`; the kinds
`CODE`, `DOCS`, `INFR`, and `OTHR` have no dedicated format contract and
are treated as free-form. Changed `SPEC` artifacts are validated via
the `ase_specbook_lint` MCP tool and the reported diagnostics are fixed
in at most three rounds; any remaining diagnostics are surfaced.

##  OPTIONS

-   `--bidirectional`|`-b`:
    Reconcile the *target* and *source* artifacts so that they
    faithfully reflect the current state of *each other*, instead of
    only updating the *target* from the *source*. With this flag, a kind
    present in *target* is *not* removed from *source*.

-   `--target`|`-t` *target*[,...]:
    The comma-separated list of artifact kinds to update. Required (the
    skill errors out on an empty target).

-   `--source`|`-s` *source*[,...]:
    The comma-separated list of artifact kinds to update *from*. The
    special value `auto` resolves to all recognized kinds except those
    in *target*.

##  ARGUMENTS

-   *hint*:
    An optional free-form filtering hint that narrows the source and/or
    target artifacts, or the aspects of those artifacts to take into
    account during reconciliation.

##  SCENARIOS

-   You want one artifact set updated to reflect another one
-   You want code and docs aligned with the specification
-   You want the specification recovered from the code base
-   You want spec and code bidirectionally synchronized

##  EXAMPLES

Reconcile the code and documentation
to reflect the current specification
in a "forward engineering" approach:

```text
❯ /ase-sync-reconcile -t CODE,DOCS -s SPEC
```

Reconcile the specification from everything else
in a "reverse engineering" approach:

```text
❯ /ase-sync-reconcile -t SPEC -s CODE,DOCS
```

Bidirectionally reconcile specification and code against
each other, limited to the authentication aspect:

```text
❯ /ase-sync-reconcile -b -t SPEC -s CODE authentication
```

##  SEE ALSO

[`ase-meta-changelog`](../ase-meta-changelog/help.md),
[`ase-task-implement`](../ase-task-implement/help.md).
