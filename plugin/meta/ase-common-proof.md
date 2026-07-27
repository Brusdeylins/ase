
Proof Skill Common Steps
========================

<define name="proof-locate-section">

Determine whether <task-content/> carries a `##  PROOF` section:

-   If <task-content/> contains a line exactly matching `##  PROOF`
    (and *not* `##  PROOF LEDGER`), set <proof-section/> to the text
    from that heading up to (but excluding) the next `##  ` heading
    or the end of <task-content/>, whichever comes first. Set
    <proof-present>true</proof-present>. Count the obligation bullets
    (lines matching `^-   \*\*PO\d+\*\*`) into <obligation-count/>.

-   Otherwise set <proof-section></proof-section> (empty),
    <proof-present>false</proof-present>, and <obligation-count/> to `0`.

Do not output anything.

</define>

<define name="proof-discover-runner">

Determine *how tests are executed in this project*. You *MUST* derive
this from the project itself and *MUST* *NOT* assume a runner.

1.  Read the project's AI guidance files (`AGENTS.md`, `CLAUDE.md`,
    `GEMINI.md`, `.github/copilot-instructions.md`, or similar) and any
    build configuration they reference. A documented test command
    *always* wins over an inferred one.

2.  If no command is documented, inspect the build manifest of the
    affected package (`package.json`, `pyproject.toml`, `Cargo.toml`,
    `go.mod`, `pom.xml`, `build.gradle`, `Makefile`, or the project's
    equivalent) for a test target, and inspect the test directory
    layout to determine how a *single* test case is selected.

3.  Set <runner-all/> to the command that runs the *entire* suite, and
    set <runner-one/> to the command *template* that runs a *single*
    named test case, with the selector written as `<case/>`.

4.  <if condition="no test command can be determined at all">
    Set <runner-all></runner-all> and <runner-one></runner-one> (both
    empty). This is *not* an error here -- the calling skill decides how
    to react, and the *absence* of any way to execute a witness is
    itself a reportable finding.
    </if>

Do not output anything.

</define>

<define name="proof-capture-baseline">

Capture the *exact* pre-run state of the working tree so that every
falsifier can be undone and the undo can be *verified*.

1.  Determine whether the project is a Git working tree by running:

    `git rev-parse --is-inside-work-tree`

2.  <if condition="the command succeeded and printed `true`">
    Set <baseline-mode>git</baseline-mode>.

    Capture the *content fingerprint* of the tree by running the
    following two commands and concatenating their captured output into
    <baseline-fingerprint/>:

    `git status --porcelain=v1`
    `git stash create`

    The `git stash create` command produces a *dangling commit* holding
    the current uncommitted state *without* touching the working tree,
    the index, or the stash list. Set <baseline-commit/> to the captured
    commit id, or to the empty string when the tree is clean and the
    command printed nothing. This commit is the *restore anchor*.

    Additionally record the *identity* of each file a falsifier will
    touch: for every such file, run `git hash-object <file/>` and record
    the pair `<file/>=<hash/>` into <baseline-hashes/>.
    </if>
    <else>
    Set <baseline-mode>copy</baseline-mode>.

    For every file a falsifier will touch, create a verbatim byte copy
    under `.ase/proof/baseline/<file/>` (creating parent directories as
    needed) and record the pair `<file/>=<size/>` into
    <baseline-hashes/>. These copies are the *restore anchor*.
    </else>

3.  Write a *restore journal* to `.ase/proof/journal.json` containing
    <baseline-mode/>, <baseline-commit/>, <baseline-hashes/>, and the
    list of files a falsifier will touch, so that a manual recovery is
    possible even if this skill is interrupted mid-run. Do not output
    anything about this file.

</define>

<define name="proof-restore-baseline">

Undo the currently applied falsifier and *verify* the undo. You *MUST*
expand this definition after *every* falsified run, including when the
falsified run errored, timed out, or produced unexpected output, and
including when the skill is stopping early.

1.  Undo the falsifier by the *inverse* of how it was applied:

    -   For a `REVERT` falsifier applied via a reverse patch: re-apply
        the *forward* patch from the same saved patch text.
    -   For a `MUTATE` or `PERTURB` falsifier applied via a textual
        edit: restore the affected files from the *restore anchor* --
        `git checkout-index`-style restoration from <baseline-commit/>
        for <baseline-mode/> `git` (restoring *only* the touched files,
        never the whole tree), or a byte copy back from
        `.ase/proof/baseline/<file/>` for <baseline-mode/> `copy`.

2.  *Verify* the restoration -- never assume it:

    -   For <baseline-mode/> `git`: re-run `git hash-object <file/>` for
        every touched file and compare each against <baseline-hashes/>.
    -   For <baseline-mode/> `copy`: compare each touched file against
        its baseline copy byte for byte.

3.  <if condition="any comparison in sub-step 2 does not match">
    Set <baseline>DIRTY: <detail/></baseline> where <detail/> names the
    files that differ and the restore anchor that can recover them.
    Immediately output the following <template/>, *STOP* all further
    falsifier execution, and continue directly to the reporting step of
    the calling skill with the verdict forced to `NOT PROVEN`:

    <template>
    ⧉ **ASE**: ◉ task: **<ase-task-id/>**, ▶ ERROR: working tree *NOT* restored: **<detail/>** -- recover via `.ase/proof/journal.json`
    </template>
    </if>
    <else>
    Set <baseline>restored</baseline>. Do not output anything.
    </else>

</define>

<define name="proof-run-capture">

Execute *one* command and capture its outcome as *evidence*. You *MUST*
*NOT* record any outcome you did not observe.

1.  Run the command <cmd/> exactly as given, capturing both its combined
    output and its *exit code*.

2.  Set <observed-exit/> to the captured exit code -- the *actual* one,
    never the expected one.

3.  Set <observed-signal/> to the *decisive* line of the captured
    output: the assertion message, the summary count, or the error. When
    the output is long, elide the middle with `[...]`, keeping the
    command line, the decisive lines, and the tail.

4.  Set <transcript/> to the verbatim capture, formatted as the command
    line prefixed with `$ `, the retained output lines, and a final line
    `exit=<observed-exit/>`.

5.  <if condition="the command could not be executed at all (runner absent, selector unknown, timeout)">
    Set <observed-exit>n/a</observed-exit> and set <observed-signal/> to
    the reason it could not be executed. The calling skill *MUST* treat
    this obligation as `BLOCKED`.
    </if>

Do not output anything.

</define>
