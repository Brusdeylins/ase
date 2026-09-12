
##  NAME

`ase-code-review` - Review and Curate Uncommitted Changes

##  SYNOPSIS

`ase-code-review`
    [`--help`|`-h`]
    [*ref*]

##  DESCRIPTION

The `ase-code-review` skill *reviews* an accumulated pile of
*uncommitted* source code changes and *curates* them into clean,
thematically-coherent Git commits on the *current* branch. It works
*top-down*: it enumerates every change internally, groups all hunks
into 3-5 *themes*, and presents the grouping as *one compact table*
(theme, file count, added/removed lines) so the user can accept the cut
or ask for a regroup. That table is the *only* dialog before the
per-group walk -- no mode questions are asked up front.

The curation modes are therefore *defaulted silently* and switched from
that one dialog whenever the presented cut calls for it:

-   *HORIZONTAL* (default) -- *theme-near groups*: hunks are grouped by
    topical and architectural proximity for the most coherent review,
    and *no* build is run at all during the review.
-   *VERTICAL* -- *build-verified slices*: each group is cut as a
    build-safe vertical slice, and the project build runs before each
    accept and *gates* it. The build runs on the full working tree,
    as nothing is stashed away.
-   *TESTS-LAST* (default) -- *test* changes are kept out of the code
    groups and staged at the end as one dedicated block, so the code
    groups stay free of test noise; *REVIEW-TESTS* instead lets them
    join the groups of the code they cover.

Each group is then processed one at a time, ordered so that every
group builds only on already-accepted concepts (foundations first, no
forward references): exactly the group's hunks are *staged* into the
plain Git index -- no work branch, no `git stash`, no working-tree
mutation -- so the user's editor (e.g. VSCode Source Control) always
shows the staged group and the remaining unstaged changes side by
side. The skill emits a compact *group card*: a short rationale, one
table with `Layer | File | ±Lines | Explanation` per staged file (full
repo-relative paths, ordered foundations-first, each explanation naming
the file's *changed symbols* and then describing the change in the
user's conversation language in simply understandable wording), and a
*Staged* line reporting the verified file count in the Git index and
pointing at the editor. Raw diff text is deliberately *not* dumped, as
the staged lines are reviewed in the editor. A single *accept* then
covers the whole group. On accept, the
commit message is crafted via
`ase-meta-commit` and the group is committed; *skip* unstages the
group and defers it; *regroup* recuts the remaining groups. Nothing
here ever discards working-tree content.

The skill *complements* its neighbours rather than duplicating them:
`ase-meta-diff` narrates *what changed*, `ase-meta-review` renders a
reviewer's *judgement*, `ase-code-lint` and `ase-code-analyze` flag
*quality* and *logic/semantics* problems, and `ase-meta-commit` crafts
the *commit message* -- whereas `ase-code-review` *curates and
commits*. It does *not* judge code quality, and it never updates
`CHANGELOG.md` (a release concern owned by `ase-meta-changelog`).

##  ARGUMENTS

The `ase-code-review` skill takes one *optional* argument:

-   *ref*: the scope of changes to review. When omitted, the scope is
    the full set of uncommitted changes -- working tree, index, and
    untracked files.

##  EXAMPLES

Review and curate all current uncommitted changes:

```text
❯ /ase-code-review
```

Review and curate the changes scoped to a reference:

```text
❯ /ase-code-review HEAD~3
```

##  SEE ALSO

`ase-meta-commit`, `ase-meta-diff`, `ase-meta-review`, `ase-code-lint`,
`ase-code-analyze`, `ase-code-refactor`, `ase-code-resolve`,
`ase-meta-changelog`.
