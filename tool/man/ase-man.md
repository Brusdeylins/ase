# ase-man(1) -- Show an internally shipped manual page

## SYNOPSIS

`ase man`
\[`-h`|`--help`\]
\[`-l`|`--list`\]
\[`-p`|`--path`\]
\[*page* \[...\]\]

## DESCRIPTION

**ase man** shows one of the Unix manual pages shipped internally with
the **ase** tool with `man`(1), independent of whether the manual pages
are installed into the `MANPATH` of the system (as npm does only for a
global installation of the `@rse/ase` package).

The manual pages are rendered at build-time from Markdown into the Unix
manual page format and shipped in the directory `dst/man/` of the tool
package. There is one manual page per command and command group, named
after the command path with dashes, e.g., `ase-task`(1) for `ase task`
and `ase-agent-fleet`(1) for `ase agent fleet`. The commands of the
third level (e.g. `ase task store start`) are covered by the manual
page of their group (e.g. `ase-task-store`(1)).

The manual page file is passed to `man`(1) by its path, so `man`(1)
formats and pages it as usual (honoring `MANPAGER`, `PAGER`, and
`MANWIDTH`).

## OPTIONS

- \[`-h`|`--help`\]:
  Show program usage information only.

- \[`-l`|`--list`\]:
  Instead of showing a manual page, list the names of all shipped
  manual pages, one per line, in natural order. Any *page* is ignored.

- \[`-p`|`--path`\]:
  Instead of showing the manual page, print the absolute path of its
  file, e.g., for passing it to another formatter.

## ARGUMENTS

- \[*page* \[...\]\]:
  The manual page to show (default: `ase`). It is given either by its
  name (e.g. `ase-agent-fleet`) or by the words of the command path
  (e.g. `agent fleet`), which are joined with dashes, where the leading
  `ase` is optional and the name is case-insensitive.

  A command path deeper than the shipped manual pages (e.g.
  `task store start`) falls back to the manual page of its nearest
  parent group (e.g. `ase-task-store`), but never to the top-level
  page `ase`(1). A *page* consisting of anything other than letters,
  digits, and dashes is refused.

## ENVIRONMENT

- `MANPAGER`, `PAGER`, `MANWIDTH`:
  Honored by `man`(1) for paging and formatting the manual page.

## FILES

- *package directory*`/dst/man/ase{,-`*command*`{,-`*sub-command*`}}.1`:
  The internally shipped manual pages.

## EXIT STATUS

The exit status of `man`(1), resp. `0` for `--list` and `--path`. The
command exits with status `1` if no manual page is found for *page*, or
if `man`(1) cannot be run at all (e.g. on a system without it, where
the error message names the manual page file).

## EXAMPLES

```sh
# show the manual page of the "ase" command itself
$ ase man

# show the manual page of "ase agent fleet" (all equivalent)
$ ase man ase-agent-fleet
$ ase man agent-fleet
$ ase man agent fleet

# show the manual page covering "ase task store start"
$ ase man task store start

# list all shipped manual pages
$ ase man --list
```

## SEE ALSO

`ase`(1), `man`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
