
MIGRATION
=========

ASE 1.0 to ASE 1.1
------------------

-   **Node.js**: the `ase` tool now requires Node.js 22.18.0 or newer.

-   **Update**: run `ase setup update` once, as it now auto-detects the scope
    (`local`, `project`, or `user`) of your existing plugin installation.

-   **Renamed Skills**: `ase-meta-{review,diff,changelog,commit}` are now
    `ase-repo-{review,diff,changelog,commit}`, and `ase-code-dissect` is now
    `ase-repo-dissect`.

-   **Removed Skills**: `ase-code-{craft,refactor,resolve}` are gone: use
    `ase-task-edit [--mode craft|refactor|resolve] [--approach]` (planned) or
    `ase-code-edit [--approach]` (one-shot) instead.

-   **Removed Skill**: `ase-task-preflight` is gone: use `ase-task-implement
    --draft` instead, and deliver the draft via `ase-task-integrate --draft`.

-   **Renamed Option**: `ase-task-edit --dry`/`-d` is now `--unverified`/`-u`.

-   **New Task Ids**: `ase-task-edit` now allocates a new task id for a new
    plan instead of planning under the `default` task.

-   **Worktree Option**: `--worktree`/`-w` of `ase-task-implement`, `ase-code-edit`,
    and `ase-spec-edit` now requires a worktree *name* (`ase-{code,spec}-edit`
    additionally accept `name:branch`).

-   **Next-Step Token**: the `PREFLIGHT` token of `--next` is now `DRAFT`.

-   **Grilling Replies**: questions are now numbered `1`, `2`, ... and answers
    lettered `A`, `B`, ..., so reply with short responses like `1A 2c`
    (instead of `Q1:A1`).

-   **Grilling Rounds**: `--grill-rounds` resp. `--rounds` is now a *maximum*,
    as grilling stops early once all `MUST` points are clear (see `--grill-until`
    resp. `--until`).

-   **Review Severity**: an explicit `ase-repo-review --severity` now wins over
    the boxing, while the new default `AUTO` keeps `MEDIUM` under `grey` boxing.

-   **CLI Utility Commands**: `ase {meta,compat,diagram,worktree,mint,metric}`
    moved to `ase util {meta,compat,diagram,worktree,mint,metric}`: adjust your own
    skills, scripts, and `Bash(ase meta *)` permissions accordingly.

-   **Task Listing**: `ase task list` now excludes the finished tasks by default
    (use `--exclude none` to see them).

-   **Task Plans**: 1.0 task plans are migrated on load: `Properties:` becomes
    `Tags:`, and `Status:` values are mapped onto the lifecycle model
    (`project.task.lifecycle`, default `solo`), e.g. `COMPLETED` onto `CLOSED`.

-   **Task Configuration**: `project.artifact.task.{basedir,files}` were replaced
    by `project.task.store.url` (e.g. `ase:./.ase/task`), and are migrated in place.

-   **Legacy Task Files**: the automatic migration of pre-1.0 task files
    (`<basedir>/<id>/plan.md`) was dropped: migrate them with ASE 1.0 first.

-   **User State**: the per-user state moved from `~/.ase` to the per-OS state
    directory (e.g. `~/Library/Application Support/ase` on macOS), so a stale
    `~/.ase` can be removed, and no longer makes your home directory a project root.

-   **Tool Documentation**: `docs/usage-tool.md` was replaced by Unix manual pages,
    viewable via `man ase` or `ase man [<command> ...]`.

