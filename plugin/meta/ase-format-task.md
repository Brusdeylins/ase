
Task
----

Every *task* uses a strict and fixed format:

<format>
---
Id:         <task-id/>
Created:    <timestamp-created/>
Modified:   <timestamp-modified/>
Status:     <task-status/>
Properties: <task-properties/>
Kind:       <task-kind/>
---

#   TASK: <title/>

##  CONTEXT

-   **WHAT**: <summary-what/>

-   **WHY**: <summary-why/>

##  CHANGES

-   [...]

-   [...]

##  VERIFICATION

-   [...]

-   [...]

</format>

You *MUST* honor the following hints on this *task* format:

-   The content *MUST* begin with the `---` opening delimiter of the
    *Markdown frontmatter* as its very *first* line -- there is *no*
    leading empty line, as any line before the `---` would degrade the
    frontmatter into ordinary Markdown. You *MUST* always keep the empty
    line between the closing `---` delimiter and the `#` heading, and
    always keep the last empty line. If one of them is missing, add it
    back.

-   The *frontmatter* carries the keys `Id`, `Created`, `Modified`,
    `Status`, `Properties`, and `Kind`, in exactly this order, with their
    values being *unquoted* plain scalars and vertically aligned one
    space after the longest key. Only `Id` is *mandatory* -- every other
    key is *optional* and, when absent, falls back to its default value.

-   In all descriptions, highlight *code* as
    <template>`<code/>`</template> and *key aspects* as
    <template>*<aspect/>*</template>.

-   For <summary-what/> and <summary-why/> use an *ultra brief* but
    *as precise as possible* description of the overall change. In
    <summary-what/> tell what is changed. In <summary-why/> tell why it
    is changed, what benefit results or what the rationale is behind the
    change.

-   The <task-id/> of the `Id:` frontmatter key has to be substituted
    with the current value of <ase-task-id/> in the current session
    context.

-   The `Status:` frontmatter key states the current *lifecycle state*
    of the task plan. The key is *optional* and defaults to `DRAFTED`:
    an *absent* key reads as `DRAFTED`, and a *newly created* plan
    carries `DRAFTED` explicitly. The <task-status/> value is *strictly*
    one of the following eight states:

    -   `DRAFTED`: plan exists but is still provisional and not yet
        cleared for implementation.
    -   `REJECTED`: plan was reviewed and refused, and has to be reworked
        before it can be approved.
    -   `APPROVED`: plan is accepted as authoritative and cleared for
        implementation, but no work has begun.
    -   `DEFERRED`: plan is approved and unobstructed, but its start was
        deliberately postponed.
    -   `STARTED`: implementation of the plan is actively underway.
    -   `BLOCKED`: implementation is halted by an impediment which
        someone has to remove before it can resume.
    -   `COMPLETED`: plan was implemented in full and reached its
        intended outcome.
    -   `CANCELLED`: plan was terminated before completion, because it
        failed, was called off, or became obsolete.

-   The eight states form a *state machine*. Whoever sets the `Status:`
    key *MUST* only move along one of the following transitions, whereby
    a *single* operation *MAY* traverse *several* transitions at once if
    it performs the corresponding stages in one go:

    ```text
    DRAFTED   ──reject───▶ REJECTED      STARTED   ──block────▶ BLOCKED
    REJECTED  ──redraft──▶ DRAFTED       BLOCKED   ──unblock──▶ STARTED
    DRAFTED   ──approve──▶ APPROVED      STARTED   ──complete─▶ COMPLETED
    APPROVED  ──defer────▶ DEFERRED
    DEFERRED  ──resume───▶ APPROVED      any non-terminal state
    APPROVED  ──start────▶ STARTED       ──cancel───▶ CANCELLED
    ```

    `COMPLETED` and `CANCELLED` are the two *terminal* states: a plan
    which reached one of them is *finished* and leaves the state machine.

-   The `Properties:` frontmatter key states which *stages* the task
    plan already passed through. The <task-properties/> value is
    *strictly* either `none` or a comma-separated list of the values
    `grilled`, `preflighted`, `implemented`, and `verified`, listed in
    exactly this order, each at most once. The key is *optional* and
    defaults to `none`: an *absent* key reads as `none`, and a *newly
    created* plan carries `none` explicitly. The list only ever
    *accumulates*: a skill *adds* its own value if still absent and
    *MUST NOT* drop any value already present, except when a plan is
    *recreated from scratch*, which resets it to `none`.

-   The `Kind:` frontmatter key states the *kind of change* the task plan
    describes, and hence which *operation-specific tenet set* of the
    **ASE Tenets** a subsequent preflight or implementation has to
    honor. The <task-kind/> value is *strictly* one of `CRAFTING`,
    `REFACTORING`, or `RESOLVING`.

-   The `Kind:` frontmatter key is *optional*: a skill *authoring* or
    *updating* a task plan *CAN* update an already present key or pass
    it through *verbatim* and *MAY* create a missing one by *inferring*
    the kind from the plan content (defaulting to `CRAFTING`). A
    `--dry` run *never* drops this key, as `--dry` only omits the
    `##  VERIFICATION` section.

-   A skill *writing* an optional key which is still *absent* inserts it
    at its position in the key order above and re-aligns the values of
    the whole frontmatter block.

-   The <timestamp-created/> of the `Created:` frontmatter key is the
    timestamp when this task plan was created. The <timestamp-modified/>
    of the `Modified:` frontmatter key is the timestamp when this
    task plan was last modified. Both use an ISO-style format
    value. The value of both can be determined by a call to the
    `ase_timestamp(format: "yyyy-LL-dd HH:mm")` tool of the `ase` MCP
    server and use the `text` field of its response.

-   The <title/> is a short summary of the <summary-what/>, no longer than
    50 characters.

-   The sections `##  CHANGES` and `##  VERIFICATION` are each just a short
    list of 1-5 bullet points. Each bullet point is formatted as
    `- **<aspect/>**: <specification/>` where <aspect/> indicates
    the aspect of the section and <specification/> is 1-3 sentences
    giving an *ultra precise* but also *ultra brief* and *ultra concise*
    description of the aspect.

-   In all sections, break all lines with a newline character
    after about 100 characters per line for better subsequent
    manual editing.

-   You *MUST* *NEVER* break a line *inside* an inline code span
    <template>`<code/>`</template>, as a code span split across two
    lines renders badly. Instead, break the line *before* its opening
    backtick or *after* its closing backtick, even if this means
    breaking the line noticeably earlier than after 100 characters.

