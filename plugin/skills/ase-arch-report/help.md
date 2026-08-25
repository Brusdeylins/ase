
##  NAME

`ase-arch-report` - Generate arc42 Architecture Documentation

##  SYNOPSIS

`ase-arch-report`
    [`--help`|`-h`]
    *path-glob-or-topical-hint*

##  DESCRIPTION

The `ase-arch-report` skill generates a *deterministic arc42
architecture documentation* (Markdown and/or HTML, in German or
English) for a given code scope, by delegating the heavy lifting to
the `ase arch-report` CLI command. The report follows the standard
*arc42 12-chapter layout* (Introduction & Goals, Constraints, Context
& Scope, Solution Strategy, Building Block View, Runtime View,
Deployment View, Crosscutting Concepts, Architecture Decisions,
Quality Requirements, Risks & Technical Debt, Glossary).

The code scope is selected either by a *path glob* (e.g.
`src/main/java/**`) or by a *topical hint* (e.g. "the trading
subsystem"), which the skill resolves against the project layout
before invoking the generator. The generated report is written below
`docs/reports/`.

##  OPTIONS

Only the standard `--help`|`-h` option exists.

##  ARGUMENTS

*path-glob-or-topical-hint*:
    The code scope to document: either a file path glob or a free-text
    topical hint which is resolved to a set of source directories.

##  EXAMPLES

Generate an architecture report for a source subtree:

```text
❯ /ase-arch-report src/main/java/org/example/**
```

Generate an architecture report from a topical hint:

```text
❯ /ase-arch-report the trading subsystem
```

##  SEE ALSO

[`ase-arch-analyze`](../ase-arch-analyze/help.md), [`ase-arch-discover`](../ase-arch-discover/help.md),
[`ase-code-insight`](../ase-code-insight/help.md).
