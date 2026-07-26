
##  NAME

`ase-code-lint` - Lint Source Code

##  SYNOPSIS

`ase-code-lint`
    [`--help`|`-h`]
    [`--auto`|`-a`]
    [`--severity`|`-S`=(`LOW`|`MEDIUM`|`HIGH`)]
    [`--include`|`-i`=*aspect*[`,`...]]
    [`--exclude`|`-e`=*aspect*[`,`...]]
    *source-reference*

##  DESCRIPTION

The `ase-code-lint` skill lints the source code of the referenced
location for *potential code quality problems* related to a fixed set
of code quality aspects. The investigation is dispatched to a
sub-agent (`ase:ase-code-lint`) so that scanning details do not leak
into the user-visible transcript.

For each detected problem, the skill renders a unified-diff *SOLUTION*
preview and either asks the user to `ACCEPT` or `REJECT` the proposed
correction interactively (or refine it via a free-text hint, which
re-proposes the correction without limit) or - with `--auto` - applies
all corrections automatically.

By default all twenty code quality aspects are checked. The `--include`
and `--exclude` options narrow this to an *effective aspect set*: with
`--include` only, exactly the listed aspects are checked; with
`--exclude` only, all aspects except the listed ones; with both, the
included ones minus the excluded ones. An unknown aspect id, or a
combination which cancels out to an empty set, aborts the skill with an
error. The twenty aspect ids are:

```text
A01 FORMATTING     A06 REDUNDANCY       A11 TYPING          A16 SECURITY
A02 COMPREHENSION  A07 PATTERNS         A12 ERROR-HANDLING  A17 ARCHITECTURE
A03 CLEANLINESS    A08 COMPLICATEDNESS  A13 MEMORY-LEAK     A18 LOGIC
A04 SPELLING       A09 CONCISENESS      A14 CONCURRENCY     A19 FLOW
A05 COMPLEXITY     A10 SMELLS           A15 PERFORMANCE     A20 DEAD-CODE
```

##  OPTIONS

`--auto`|`-a`:
    Automatically apply every proposed correction without asking the
    user via the interactive dialog.

`--severity`|`-S`=(`LOW`|`MEDIUM`|`HIGH`):
    Set the *severity floor* (default `LOW`): findings below the chosen
    threshold are silently suppressed, ordered `LOW` < `MEDIUM` <
    `HIGH`. The default `LOW` keeps all findings; `ACCEPTED` findings are
    never suppressed.

`--include`|`-i`=*aspect*[`,`...]:
    Restrict the checked code quality aspects to the given
    comma-separated list of aspect ids (e.g. `A01,A04`). Without this
    option, all twenty aspects are checked.

`--exclude`|`-e`=*aspect*[`,`...]:
    Remove the given comma-separated list of aspect ids from the checked
    code quality aspects. Applied *after* `--include`, so `-i A01,A02 -e
    A02` checks `A01` only.

##  ARGUMENTS

*source-reference*:
    A file, directory, or other reference to the source code to lint.

##  EXAMPLES

Lint a source file interactively:

```text
❯ /ase-code-lint src/server.ts
```

Lint a directory and automatically apply all corrections:

```text
❯ /ase-code-lint --auto src/handlers/
```

Lint a directory, reporting only `MEDIUM` and `HIGH` findings:

```text
❯ /ase-code-lint -S MEDIUM src/handlers/
```

Lint a source file for the formatting and spelling aspects only:

```text
❯ /ase-code-lint -i A01,A04 src/server.ts
```

Lint a directory for all aspects except dead code:

```text
❯ /ase-code-lint --exclude A20 src/handlers/
```

##  SEE ALSO

[`ase-code-analyze`](../ase-code-analyze/help.md), [`ase-code-resolve`](../ase-code-resolve/help.md), [`ase-code-refactor`](../ase-code-refactor/help.md),
[`ase-docs-proofread`](../ase-docs-proofread/help.md).
