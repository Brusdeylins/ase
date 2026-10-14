# ase-artifact-list(1) -- Resolve Artifact Kinds to Project-Relative File Paths

## SYNOPSIS

`ase artifact list`
\[`-h`|`--help`\]
\[`--kind` *kinds*\]

## DESCRIPTION

**ase artifact list** resolves one or more artifact kinds of the
project to the project-relative (POSIX-style) paths of their files,
driven by the configuration keys `project.artifact.`*kind*`.basedir`
and `project.artifact.`*kind*`.files` and honoring the Git exclude
rules, as described in `ase-artifact`(1).

The files of each kind are printed sorted, one per line, as a bullet
list (`- `*file*). When more than one kind is requested, the list of
each kind is preceded by a header line `# `*kind*`:`. The kinds are
printed in the requested order, while the partitioning of the files
among the kinds always follows the fixed precedence `spec`, `code`,
`docs`, `infr`, with `othr` as the implicit catch-all.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`--kind` *kinds*\]:
  A comma-separated list of the artifact kinds to resolve, out of
  `spec`, `code`, `docs`, `infr`, and `othr` (default:
  `spec,code,docs,infr,othr`, i.e., all kinds). Whitespace around the
  kinds is ignored. An unknown kind is an error.

## EXIT STATUS

Exits with status `0` on success, and with status `1` on an unknown
kind or an invalid configuration (e.g., a base directory escaping the
project root).

## EXAMPLES

```sh
# list the source code files of the project
$ ase artifact list --kind code

# list the specification and documentation files, each with a header
$ ase artifact list --kind spec,docs
```

## SEE ALSO

`ase`(1), `ase-artifact`(1), `ase-artifact-name`(1), `ase-config`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
