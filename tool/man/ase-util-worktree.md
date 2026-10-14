# ase-util-worktree(1) -- Resolve the ASE Worktree Directories

## SYNOPSIS

`ase util worktree`
\[`-h`|`--help`\]

`ase util worktree base`
\[`-c`|`--create`\]
\[`-t`|`--temp`\]

`ase util worktree path`
\[`-c`|`--create`\]
\[`-t`|`--temp`\]
*id*

## DESCRIPTION

**ase util worktree** safely resolves the directories of the Git
worktrees managed by *ASE* (e.g., the worktrees of the
`--worktree` option of the skills and of the agents), which all reside
below the base directory `<repo-root>/.ase/worktree`, where
*repo-root* is the fully resolved top-level directory of the Git
working tree of the current working directory. The *temporary*
worktrees reside below `<repo-root>/.ase/worktree/.temp`, a namespace
disjoint from all regular worktree ids (as ids never contain a `.`).

The resolution is *validated*: as `git worktree add` silently follows
a symbolic link, every already existing path component below the
repository root (`.ase`, `worktree`, `.temp`, and the *id* leaf) has
to be a real directory, neither a symbolic link, nor any other file,
nor an aliased path, so a repository carrying a committed `.ase`
symbolic link can never make a worktree be written outside of it. Not
yet existing components are fine, as they are created later on.

The resolved directory is printed to standard output. Without a
sub-command, the usage information is shown and the command exits
with status `1`.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## COMMANDS

- `ase util worktree base` \[`-c`|`--create`\] \[`-t`|`--temp`\]:
  Print the validated base directory `<repo-root>/.ase/worktree` holding
  all *ASE* worktrees. The options are:

    - \[`-c`|`--create`\]:
      Create the base directory (with all its missing parents) if it
      does not exist yet, and validate it again afterwards.
    - \[`-t`|`--temp`\]:
      Print the base directory `<repo-root>/.ase/worktree/.temp` of the
      temporary worktrees instead.
    - \[`-h`|`--help`\]:
      Show usage information and exit.

- `ase util worktree path` \[`-c`|`--create`\] \[`-t`|`--temp`\] *id*:
  Print the validated worktree directory `<repo-root>/.ase/worktree/<id>`
  of a single worktree *id*, which has to be non-empty and match
  `[A-Za-z0-9_-]+`, so it is safe both as a single path component and
  as the Git branch name derived from it. The worktree directory
  itself is not created, as this is done by `git worktree add`. The
  options are:

    - \[`-c`|`--create`\]:
      Create the base directory (not the worktree directory itself) if
      it does not exist yet.
    - \[`-t`|`--temp`\]:
      Resolve the *id* below the base directory
      `<repo-root>/.ase/worktree/.temp` of the temporary worktrees.
    - \[`-h`|`--help`\]:
      Show usage information and exit.

## FILES

- `<repo-root>/.ase/worktree/`:
  The base directory of all *ASE* worktrees, ignored by Git via the
  self-ignoring `.ase/.gitignore`.

- `<repo-root>/.ase/worktree/.temp/`:
  The base directory of the temporary *ASE* worktrees.

## EXIT STATUS

Exits with status `0` on success, and with status `1` outside of a Git
working tree, on an invalid *id*, or if a path component is a symbolic
link, not a directory, or an aliased path. The group command without a
sub-command exits with status `1`.

## EXAMPLES

```sh
# print the base directory of all ASE worktrees, creating it if needed
$ ase util worktree base -c

# create a worktree for the id "FOO-42" at its validated location
$ git worktree add "$(ase util worktree path -c FOO-42)" -b FOO-42
```

## SEE ALSO

`ase`(1), `ase-util`(1), `git-worktree`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
