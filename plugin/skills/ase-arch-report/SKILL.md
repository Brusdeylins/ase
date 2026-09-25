---
name: ase-arch-report
argument-hint: "<path-glob-or-topical-hint>"
description: >
    Generate a deterministic *arc42* architecture documentation
    (Markdown and/or HTML, DE or EN) for a code scope. Trigger when
    the user asks for an "architecture report", "arch report", "arc42
    documentation", "arc42 report", "code structure overview",
    "Übersicht der Klassen", "Architektur-Report", invokes the slash
    command /ase-arch-report or /ase:arch-report, or references
    docs/reports/ as an output target.
user-invocable: true
disable-model-invocation: false
model: sonnet
effort: low
allowed-tools:
    - "Bash(ase arch-report:*)"
    - "Bash(ls:*)"
    - "Bash(realpath:*)"
    - "Bash(find:*)"
    - "Bash(wc:*)"
    - "AskUserQuestion"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Generate arc42 Architecture Documentation
=========================================

Your role is an experienced, *expert-level software architect*,
specialized in *generating deterministic arc42 architecture
documentation* for a given code scope.

<objective>
*Generate* a *deterministic arc42 architecture documentation* (Markdown
and/or HTML, DE or EN) for the code scope $ARGUMENTS. The report follows
the standard *arc42 12-chapter layout* (Introduction & Goals, Constraints,
Context & Scope, Solution Strategy, Building Block View, Runtime View,
Deployment View, Crosscutting Concepts, Architecture Decisions, Quality
Requirements, Risks & Technical Debt, Glossary) with the official arc42
help texts inline. Ten of twelve chapters are *auto-filled* from
project-metadata detection (manifest files, git authors, ADR folder
scan, deployment-artefact detection) and from the source-code analysis
pipeline (cluster diagrams, class diagrams, metrics, documentation
debt). Only chapters 4 (Solution Strategy) and 12 (Glossary) remain
help-text-only — they require genuine human synthesis. The report shows
the *public and protected API*. Private and package-private members are
intentionally excluded.
</objective>

<flow>
1.  <step id="STEP 1: Resolve Source Scope">
    -   *Validate* <request>$ARGUMENTS</request> as a *path or glob*:
        if it resolves to an *existing directory or file*, or matches
        *≥ 1 file* via `ls` glob expansion, use it as <scope/> directly.

    -   Else treat <request>$ARGUMENTS</request> as a *topical hint*
        (e.g. `tws plugin`, `core auth`) and run *repo discovery*.
        Tokenize the hint, then for each token run:

        ```
        find . -type d \( -iname "*<token>*" -o -name src -o -name main \) \
            -not -path "*/node_modules/*" -not -path "*/.git/*" \
            -not -path "*/build/*" -not -path "*/target/*" \
            -not -path "*/dst/*" -maxdepth 6
        ```

        For each candidate count source files inside (`*.java`,
        `*.ts`, `*.tsx`, `*.js`, `*.kt`, `*.go`, `*.rs`, `*.py`,
        `*.cs`, `*.cpp`, `*.c`) via `find ... | wc -l`. *Score*
        candidates by *name-match weight × file count* and present
        the *top 3-5* via `AskUserQuestion` so the user picks one.
        If exactly *one* candidate has *≥ 10* source files and the
        others have *0*, you *MAY* skip the question and use that
        candidate directly.

    -   If <request>$ARGUMENTS</request> is empty or no candidate
        has any source files, ask the user *exactly once* via
        `AskUserQuestion`:

        > "Welcher Code-Bereich soll analysiert werden? (Pfad oder Glob)"

        Use the answer as <scope/>.

    -   Display the resolved scope with just the following <template/>:

        <template>
        &#x1F535; **SCOPE**: `<scope/>`
        </template>
    </step>

2.  <step id="STEP 2: Ask for Report Language">
    -   You *MUST* invoke the `AskUserQuestion` tool *exactly* as
        follows and *MUST NOT* skip this step under any circumstances:

        ```
        AskUserQuestion({
          questions: [{
            question: "Berichtssprache?",
            header:   "Sprache",
            multiSelect: false,
            options: [
              { label: "Deutsch", description: "arc42-Vorlage und Auto-Fill-Texte auf Deutsch" },
              { label: "English", description: "arc42 template and auto-fill text in English" }
            ]
          }]
        })
        ```

    -   Map the user's answer to the CLI flag <report-lang/>:

        -   `Deutsch` → <report-lang>--report-lang=de</report-lang>
        -   `English` → <report-lang>--report-lang=en</report-lang>

    -   Display the chosen language with just the following <template/>:

        <template>
        &#x1F535; **SPRACHE**: <report-lang/>
        </template>
    </step>

3.  <step id="STEP 3: Ask for Output Format">
    -   You *MUST* invoke the `AskUserQuestion` tool *exactly* as
        follows and *MUST NOT* skip this step under any circumstances:

        ```
        AskUserQuestion({
          questions: [{
            question: "Output-Format?",
            header:   "Format",
            multiSelect: false,
            options: [
              { label: "Markdown only", description: "Markdown-Datei mit ASCII-Diagrammen" },
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

4.  <step id="STEP 4: Invoke CLI">
    -   Run the following shell command via the `Bash` tool:

        ```
        ase arch-report <scope/> <report-lang/> <format/>
        ```

    -   You *MUST* *NEVER* hand-draw the report yourself; the report is
        produced *exclusively* by the `ase arch-report` CLI.
    </step>

5.  <step id="STEP 5: Report Output Path">
    -   `ase arch-report` emits one or two `Report: <abs-path/>` lines
        on stdout depending on the chosen <format/>: `index.md` for
        `--format=md`, `index.html` for `--format=html`, or both lines
        for `--format=both`.

    -   Echo each such line *verbatim* to the user with just the
        following <template/>, *without* any further commentary:

        <template>
        &#x1F4D1; **REPORT**: <abs-path/>/<index-file/>
        </template>
    </step>
</flow>

