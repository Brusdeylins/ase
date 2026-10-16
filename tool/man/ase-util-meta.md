# ase-util-meta(1) -- Output Plugin Meta Files

## SYNOPSIS

`ase util meta`
\[`-h`|`--help`\]
*name* \[...\]

## DESCRIPTION

**ase util meta** writes the contents of one or more *meta files* of
the *ASE* plugin to standard output, concatenated in the given order
and without any separator.

The meta files are the shared instructions and format conventions of
the *ASE* skills, e.g., the constitution (`ase-constitution.md`), the
tenets (`ase-tenets.md`), the persona (`ase-persona.md`), the dialog
conventions (`ase-dialog.md`), the option parsing conventions
(`ase-getopt.md`), and the artifact format conventions
(`ase-format-*.md`, plus the standard *SpecBook* schema configuration
`ase-format-specbook.yaml`).

The meta files are read from the `plugin/meta/` directory bundled with
the tool package itself, independent of any environment variables. All
requested files are read before any output is written, so a failing
name produces no output at all.

This command is intended to be leveraged by the *ASE* skills, and not
typically invoked directly by end users.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *name* \[...\]:
  One or more meta file names. Each *name* is reduced to its base name
  (so no directory traversal or absolute path is possible), the
  extension `.md` is appended if it has no extension, and the prefix
  `ase-` is prepended if missing, so `tenets`, `ase-tenets`, and
  `tenets.md` all select `ase-tenets.md`, while `format-specbook.yaml`
  selects `ase-format-specbook.yaml`. An empty name, `.`, and `..` are
  invalid.

## EXIT STATUS

Exits with status `0` on success, and with status `1` if a name is
invalid or a meta file cannot be read.

## EXAMPLES

```sh
# output the ASE constitution
$ ase util meta constitution

# output the tenets and the persona definition
$ ase util meta tenets persona
```

## SEE ALSO

`ase`(1), `ase-util`(1), `ase-spec`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
