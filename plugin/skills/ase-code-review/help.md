
##  NAME

`ase-code-review` - Review and Curate Uncommitted Changes

##  SYNOPSIS

`ase-code-review`
    [`--help`|`-h`]
    [*ref*]

##  DESCRIPTION

The `ase-code-review` skill *reviews* an accumulated pile of *uncommitted*
source code changes and *curates* them into clean, thematically-coherent,
build-verified Git commits on a *dedicated work branch*. Acting as an
experienced reviewer, it works *top-down*: it first enumerates every
change as a flat *hunk manifest*, then asks for a *curation strategy*,
proposes 3–5 *commit themes* that span the full surface, assigns each hunk
to exactly one theme, and plans a *staging order*.

Up front the skill asks how the changes should be curated:

-   *VERTICAL* — *compilable commits*: each theme is a build-safe vertical
    slice that compiles in isolation, so every commit builds green and the
    history stays *bisect-safe*. The per-theme build *gates* the commit.
-   *HORIZONTAL* — *theme-near reviews*: themes group hunks by topical and
    architectural proximity (one concern or one layer at a time) for the
    most coherent review, accepting that an individual commit may not
    compile standalone. The build runs for *information* only and does not
    gate the commit.

Throughout the per-theme loop a `*Progress*:` breadcrumb
(`Batch x/y · Layer l/L · File a/b · Section s/k`) always shows where the
user stands in the overall review.

Each theme is then processed one at a time on the work branch: its hunks
are staged in isolation, the working tree is isolated to the post-commit
state, the project's build is run to verify the theme *as it will land*,
its files are walked *layer by layer* and *file by file* interactively,
and only what the user *accepts* is committed. A theme is the *minimal
build-safe commit unit* — bisect-safe and atomic — even when it internally
spans several architectural layers.

During the file walk the user may, per file or per section, decide that
*something must be corrected*. A correction is either *queued as a task*
for a sub-agent or *solved immediately* by an isolated sub-agent, so the
editing work never burdens the review context. Corrections re-manifest and
re-build the theme; a theme is *never* committed with unapplied queued
corrections.

The skill *complements* its neighbours rather than duplicating them:
`ase-meta-diff` narrates *what changed*, `ase-meta-review` renders a
reviewer's *judgement*, `ase-code-lint` and `ase-code-analyze` flag
*quality* and *logic/semantics* problems, and `ase-meta-commit` crafts the
*commit message* — whereas `ase-code-review` *curates and commits*. It does
*not* judge code quality, and it never updates `CHANGELOG.md` (a release
concern owned by `ase-meta-changelog`).

##  ARGUMENTS

The `ase-code-review` skill takes one *optional* argument:

-   *ref*: the scope of changes to review. When omitted, the scope is the
    full set of uncommitted changes — working tree, index, and untracked
    files.

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
