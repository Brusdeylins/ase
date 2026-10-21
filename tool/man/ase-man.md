# ase-man(1) -- Browse the internally shipped manual pages

## SYNOPSIS

`ase man`
\[`-h`|`--help`\]
\[`-l`|`--list`\]
\[*page* \[...\]\]

## DESCRIPTION

**ase man** shows the manual pages shipped internally with the **ase**
tool: the manual pages of all **ase** commands *and* the manual pages
of all **ASE** skills of the bundled agent tool plugin.

The manual pages of the commands are shipped as Markdown in the
directory `dst/man/` of the tool package. There is one manual page per
command and command group, named after the command path with dashes,
e.g., `ase-task`(1) for `ase task` and `ase-agent-fleet`(1) for `ase
agent fleet`. The commands of the third level (e.g. `ase task store
start`) are covered by the manual page of their group (e.g.
`ase-task-store`(1)).

On a terminal (and without `--list`), **ase man** opens the
interactive, full-screen *manual page browser*. If standard input or
standard output is not a terminal, it instead prints the manual page
*page* (or `ase`(1)) as plain text, wrapped to 80 columns, onto
standard output. The browser consists of two pages:

- The *start page* shows a search field on top of a catalog of all AI
  skills and all CLI commands, grouped like the catalog of the website
  and laid out in up to five columns, depending on the terminal width
  (reduced to the matching manual pages while a search is active).
  Selecting a manual page or submitting a search opens the browser page.
  The browser starts on the start page if no *page* is given.

- The *browser page* shows the master on the left, with the search
  field on top of the grouped list of all manual pages (reduced to the
  matching manual pages while a search is active), and the detail on
  the right, with the selected manual page as rendered and
  syntax-highlighted Markdown (with the matches of an active search
  highlighted). References to other manual pages within the detail,
  like `ase-task`(1) or `ase-task-edit`, can be followed. The browser
  starts on the browser page if a *page* is given: with the manual page
  fitting exactly onto *page* selected, else with *page* as the search.

A search consists of whitespace-separated keywords, which *all* have to
occur (case-insensitively) in a manual page. Only if no manual page
matches the keywords literally, they are matched fuzzily against the
words of the manual pages, so a misspelled keyword still finds its
manual pages. On both pages, the catalog resp. the master is filtered
live while typing, and the header shows the counts of the matching
manual pages.

## OPTIONS

- \[`-h`|`--help`\]:
  Show program usage information only.

- \[`-l`|`--list`\]:
  Instead of showing a manual page, list the names of all shipped
  manual pages of the commands, one per line, in natural order. Any
  *page* is ignored.

## ARGUMENTS

- \[*page* \[...\]\]:
  The manual page to show (default: the start page of the interactive
  manual page browser on a terminal, else `ase`). It is given either by
  its name (e.g. `ase-agent-fleet` or `ase-task-edit`) or by the words
  of the command path (e.g. `agent fleet`), which are joined with
  dashes, where the leading `ase` is optional and the name is
  case-insensitive.

  In the manual page browser, the manual page fitting exactly onto
  *page* is selected. Of a skill and a command of the same name (e.g.
  `ase-task-edit` and `ase-task-edit`(1)), a single name with dashes
  (e.g. `task-edit`) selects the skill, while the words of a command
  path (e.g. `task edit`) select the command. If no manual page fits
  exactly, the words of *page* are
  placed into the search field instead, so the master shows only the
  matching manual pages, with the first of them selected.

  When printed as plain text, the manual page fitting exactly onto
  *page* is printed likewise. If no manual page fits exactly, a command
  path deeper than the shipped manual pages (e.g. `task store start`)
  falls back to the manual page of its nearest parent group (e.g.
  `ase-task-store`), but never to the top-level page `ase`(1), and a
  *page* consisting of anything other than letters, digits, and dashes
  is refused.

## KEYS

The following keys and mouse actions are supported by the interactive
manual page browser.

### Start Page

- `Up`, `Down`, `Left`, `Right`: Select the manual page above, below,
  left, or right of the selected one in the catalog (at the end of a
  column, `Up` and `Down` continue in the nearest other column).
- `Home`, `End`: Select the first or last manual page of the catalog
  (not within the search field).
- `Return`: Open the selected manual page on the browser page (keeping
  an active search).
- `/`: Enter the search field, whose search filters the catalog live.
  Within it, `Return` submits the search (opening the browser page
  with the selected, i.e. initially the first, matching manual page),
  `Left`, `Right`, `Home`, and `End` move the cursor, `Backspace` and
  `Delete` delete the character before resp. at the cursor, and
  `Escape` leaves the search field again.
- `Escape`: Clear a non-empty search (not within the search field).
- `q`, `Ctrl`+`C`: Quit (`q` not within the search field).
- Left-Click: Open the clicked manual page (keeping an active search),
  resp. enter the clicked search field (clearing the search on its
  trailing `✕` symbol).
- Wheel: Select the manual page above or below the selected one.

### Browser Page

- `Up`, `Down`: Select the previous or next manual page of the master,
  resp. the previous or next reference within the detail (while a
  reference is selected).
- `Right`, `Left`: Enter the references of the detail (selecting the
  first shown reference), resp. leave them again towards the master.
- `Page Up`, `Page Down`, `Space`: Scroll the detail by a page
  (`Space` not within the search field).
- `Home`, `End`: Scroll the detail to its top or bottom (not within
  the search field).
- `Tab`, `Shift`+`Tab`: Select the next or previous reference to
  another manual page within the detail.
- `Return`: Follow the selected reference (leaving a search the
  referenced manual page does not match), resp. leave the search
  field.
- `/`: Enter the search field, whose search filters the master live.
  Within it, `Left`, `Right`, `Home`, and `End` move the cursor, and
  `Backspace` and `Delete` delete the character before resp. at the
  cursor.
- `Escape`: Step back: first clear a non-empty search, then leave the
  search field, and finally return to the start page.
- `q`, `Ctrl`+`C`: Quit (`q` not within the search field).
- Left-Click: Select the clicked manual page of the master, follow the
  clicked reference of the detail, resp. enter the clicked search field
  (clearing the search on its trailing `✕` symbol).
- Wheel: Select the previous or next manual page (over the master),
  resp. scroll the detail (over the detail).

## FILES

- *package directory*`/dst/man/ase{,-`*command*`{,-`*sub-command*`}}.md`:
  The internally shipped manual pages of the commands.

- *package directory*`/plugin/skills/`*skill*`/help.md`:
  The manual pages of the skills of the bundled agent tool plugin.

## EXIT STATUS

The command exits with status `0` on success, and with status `1` if
no manual page is found for *page* when printing it as plain text.

## EXAMPLES

```sh
# browse all manual pages of the commands and skills interactively
$ ase man

# show the manual page of the "ase" command itself
$ ase man ase

# show the manual page of "ase agent fleet" (all equivalent, as no skill has this name)
$ ase man ase-agent-fleet
$ ase man agent-fleet
$ ase man agent fleet

# show the manual page of the skill "ase-task-edit" resp. of "ase task edit"
$ ase man task-edit
$ ase man task edit

# browse the manual pages matching the keywords "worktree" and "merge"
$ ase man worktree merge

# print the manual page covering "ase task store start" as plain text
$ ase man task store start | less

# list all shipped manual pages of the commands
$ ase man --list
```

## SEE ALSO

`ase`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
