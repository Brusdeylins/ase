
##  NAME

`ase-task-estimate` - Estimate the Effort of a Task Plan

##  SYNOPSIS

`ase-task-estimate`
    [`--help`|`-h`]
    [`--force`|`-f`]
    [`--dry-run`|`-d`]
    [`--all`|`-a`]
    [*id* ...]

`ase-task-estimate`
    `--calibrate`|`-c`
    [`--save`|`-s`]

##  DESCRIPTION

The `ase-task-estimate` skill *estimates* the effort of task plans and
stores it in their `Effort:` frontmatter key. The effort is the expected
*human time* of the *entire* lifecycle of a task (including its
planning), matching the human time `time.hr` booked on the usage
attachment of the task (see `ase-task-assign`), expressed as one of the
T-shirt sizes `XS`, `S`, `M`, `L`, or `XL`. The sizes are bands on a
*logarithmic* scale with the upper bounds `15`, `60`, `240`, and `960`
human minutes for `XS` to `L` (configuration `project.task.effort.scale`),
while `XL` is open-ended. A task without an `Effort:` key is *not
estimated*.

The estimation of a plan combines:

-   an *attention score*: the weighted number of the distinct
    requirements, behaviors, or changes stated by its checklist items
    (`DOM` 5.0, `IFC` 4.0, `ARC` 3.0, `IMP` 1.0, `REG` 0.5, `CON` 1.0),
    converted via `project.task.effort.factor` (default: `1`) human
    minutes per point,

-   a *volume score*: the code impact of its `ARC` and `IMP` items,
    predicted read-only from the plan and the code base (never measured
    from an already existing change set), converted via
    `project.task.effort.file` (default: `1`) human review minutes per
    touched file and `project.task.effort.line` (default: `0.025`)
    human minutes per predicted changed line, which also cover the edge
    cases and polishing no plan describes, where a newly written line
    weighs three times a changed one,

-   a *risk surcharge*: 20% more per applying risk out of `dependency`,
    `ambiguity`, `untested`, `concurrency`, `security`, and
    `persistence`, but at most 40% in total, where risks applying to
    virtually every task of the project do not count,

-   an *iteration multiplier*: `project.task.effort.iteration`
    (default: `2.5`) times the minutes for a task whose main
    deliverable is an interactive or visual user interface, as such
    work needs many rounds of post-adjustment,

-   a *plausibility check*: a comparable realization already existing
    in the code base, whose deviating size lowers the reported
    *confidence*, and

-   *analogues*: finished tasks with an effort and a usage attachment,
    whose disagreement lowers the reported *confidence*.

Cancelled (`[-]`) and deferred (`[>]`) items never count. The skill
reports the size, the confidence, and the main drivers of each
estimation, and for `XL` additionally warns and suggests splitting the
task via `ase-task-dissect` -- an `XL` effort never blocks the
lifecycle.

The effort is *bound* to the plan content it was given for: once the
plan content changes, the effort becomes *invalid* and is dropped, while
mere checkbox state changes and whitespace-only edits keep it. Hence,
an estimation never needs to be cleaned up by hand. Writing the effort
neither changes the `Modified:` key nor the lifecycle status of a task.
Empty plans and explicit epic tasks (whose effort is the sum of their
member tasks) are skipped, and so are tasks already carrying a valid
effort, unless `--force` is given.

With `--calibrate`, the skill instead re-estimates the successfully
finished tasks with the *current* rates and compares the results with
their *actual* human time (only tasks with at least `5` human minutes
count, as agent-driven tasks book little human time), so a repeated
calibration converges, and reports the estimated vs. actual band matrix,
the hit rate, the bias, the best-fitting rates (factor, file, and line
minutes), and alternatively fitting scale bounds.

The `ase agent estimator` command estimates the tasks automatically in
the background, and with `--mode request` on request, in any unfinished
status, via `ase task request <id> estimate <prompt>` or key `R` of the
task boards.

##  OPTIONS

-   `--force`|`-f`:
    Re-estimate tasks which already carry a valid effort.

-   `--dry-run`|`-d`:
    Estimate and report only, but do not store the effort.

-   `--all`|`-a`:
    Estimate all unfinished tasks without a valid effort (with `--force`,
    all unfinished tasks), instead of the current or given ones.

-   `--calibrate`|`-c`:
    Report the calibration of the estimation against the finished tasks
    instead of estimating any task.

-   `--save`|`-s`:
    Together with `--calibrate`, store the fitted rates as
    `project.task.effort.factor`, `project.task.effort.file`, and
    `project.task.effort.line` on the `project` scope. The fitted scale
    bounds always stay a suggestion only.

##  ARGUMENTS

-   *id* ...:
    The unique identifiers of the tasks to estimate. If omitted (and
    without `--all`), the *current* task is estimated.

##  SCENARIOS

-   You want to know how much human time a planned task will need
-   You want to size all open tasks for planning a sprint or release
-   You want to check whether a task is too large and should be split
-   You want to tune the estimation to the actual pace of your team

##  EXAMPLES

Estimate the current task plan:

```text
❯ /ase-task-estimate
```

Estimate all unestimated tasks, without storing the results:

```text
❯ /ase-task-estimate --all --dry-run
```

Re-estimate two specific tasks:

```text
❯ /ase-task-estimate --force export-json import-csv
```

Calibrate the estimation and store the fitted rates:

```text
❯ /ase-task-estimate --calibrate --save
```

##  SEE ALSO

[`ase-task-view`](../ase-task-view/help.md), [`ase-task-list`](../ase-task-list/help.md), [`ase-task-dissect`](../ase-task-dissect/help.md),
[`ase-task-assign`](../ase-task-assign/help.md), [`ase-meta-config`](../ase-meta-config/help.md).
