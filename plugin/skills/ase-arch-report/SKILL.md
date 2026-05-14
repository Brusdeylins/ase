---
name: ase-arch-report
argument-hint: "<path-or-glob>"
description: >
    Generate a deterministic architecture report (Markdown and/or HTML)
    for a code scope. Trigger when the user asks for an "architecture
    report", "arch report", "code structure overview", "public API
    listing", "Übersicht der Klassen", "Architektur-Report", invokes
    the slash command /ase-arch-report or /ase:arch-report, or
    references docs/reports/ as an output target.
user-invocable: true
disable-model-invocation: false
model: sonnet
effort: low
allowed-tools:
    - "Bash(ase arch-report:*)"
    - "Bash(ls:*)"
    - "Bash(realpath:*)"
    - "AskUserQuestion"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Generate Architecture Report
============================

Your role is an experienced, *expert-level software architect*,
specialized in *generating deterministic architecture reports* for a
given code scope.

<objective>
*Generate* a *deterministic architecture report* (Markdown and/or HTML)
for the code scope $ARGUMENTS. The report covers a *cluster overview*
(sub-directory tree at full depth), per-cluster *classDiagrams* plus
*method tables*, *inter-cluster reference edges*, and a *documentation
debt* section listing symbols without doc comments.
</objective>

<flow>
1.  <step id="STEP 1: Resolve Source Scope">
    -   If the user provided a *path or glob* in <request>$ARGUMENTS</request>,
        use it as <scope/> directly.

    -   Else, you *MUST* ask the user *exactly once* with the
        `AskUserQuestion` tool:

        > "Welcher Code-Bereich soll analysiert werden? (Pfad oder Glob)"

        Use the answer as <scope/>.

    -   Display the resolved scope with just the following <template/>:

        <template>
        &#x1F535; **SCOPE**: `<scope/>`
        </template>
    </step>

2.  <step id="STEP 2: Ask for Output Format">
    -   You *MUST* invoke the `AskUserQuestion` tool *exactly* as
        follows and *MUST NOT* skip this step under any circumstances:

        ```
        AskUserQuestion({
          questions: [{
            question: "Output-Format?",
            header:   "Format",
            multiSelect: false,
            options: [
              { label: "Markdown only", description: "Markdown-Dateien mit ASCII-Diagrammen" },
              { label: "HTML only",     description: "HTML mit Mermaid-SVG, B/W + Akzent #a01441" },
              { label: "Both",          description: "Beides parallel im selben Output-Verzeichnis" }
            ]
          }]
        })
        ```

    -   Map the user's answer to the CLI flag <format/>:

        -   `Markdown only` → <format>--format=md</format>
        -   `HTML only`     → <format>--format=html</format>
        -   `Both`          → <format>--format=both</format>

    -   Display the chosen format with just the following <template/>:

        <template>
        &#x1F535; **FORMAT**: <format/>
        </template>
    </step>

3.  <step id="STEP 3: Invoke CLI">
    -   Run the following shell command via the `Bash` tool:

        ```
        ase arch-report <scope/> <format/>
        ```

    -   You *MUST* *NEVER* hand-draw the report yourself; the report is
        produced *exclusively* by the `ase arch-report` CLI.
    </step>

4.  <step id="STEP 4: Report Output Path">
    -   The last stdout line of `ase arch-report` is of the form
        `Report: <abs-path/>/index.md` (or `index.html` for HTML-only).

    -   Output that line *verbatim* to the user with just the following
        <template/>, *without* any further commentary:

        <template>
        &#x1F4D1; **REPORT**: <abs-path/>/<index-file/>
        </template>
    </step>
</flow>

