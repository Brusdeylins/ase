# ase-spec-lint(1) -- Lint the Project Specification

## SYNOPSIS

`ase spec lint`
\[`-h`|`--help`\]
\[`-v`|`--verbose`\]

## DESCRIPTION

**ase spec lint** lints the *SpecBook*-based specification Markdown
files below `project.artifact.spec.basedir` against the *SpecBook*
schema configuration `project.artifact.spec.schema` (see `ase-spec`(1)).

Every diagnostic is printed to standard output as a single line
*file*`:`*line*`:`*column*`: `*message*, where *file* is relative to
the project root (a file outside the project, like the bundled
standard schema, is kept as-is), and *message* is prefixed with
`warning: ` for a diagnostic of `warning` severity. Without any
diagnostic, nothing is printed.

The MCP tool `ase_specbook_lint` provides the same to the skills.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-v`|`--verbose`\]:
  Print each diagnostic as a multi-line message with the affected
  source snippet (with an `ERROR` resp. `WARNING` type), colorized if
  standard output is a terminal. If the source file is unreadable or
  empty, the single-line message is printed instead.

## EXIT STATUS

Exits with status `0` if there is no diagnostic of `error` severity
(warnings alone do not fail), and with status `1` if there is any
diagnostic of `error` severity or the linting itself failed (e.g., an
unreadable schema configuration).

## EXAMPLES

```sh
# lint the specification
$ ase spec lint

# lint the specification, showing the affected source snippets
$ ase spec lint -v
```

## SEE ALSO

`ase`(1), `ase-spec`(1), `ase-spec-export`(1), `ase-spec-preview`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
