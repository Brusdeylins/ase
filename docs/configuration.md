
Configuration Variables
=======================

In **ASE**, the following classification system can be configured on
the following scopes (and in this order, with later scopes overriding
earlier scopes):

-   `default`: (id: *none*,            storage: *built-in*)
-   `user`:    (id: `$USER`,           storage: `~/.ase/config.yaml`)
-   `project`: (id: `$ASE_PROJECT_ID`, storage: `.ase/config.yaml`)
-   `task`:    (id: `$ASE_TASK_ID`,    storage: `.ase/task/<task-id>/config.yaml`)
-   `session`: (id: `$ASE_SESSION_ID`, storage: `~/.ase/session/<session-id>/config.yaml`)

### Project Classification

-   **project.source.ambition**: the project *source code* has to meet the ambition of a...

    -   `artist`:    ...artist: finest code quality, individual, love for details.
    -   `craftsman`: ...craftsman: good code quality, individual, pragmatism.
    -   `engineer`:  ...engineer: medium code quality, standardized, pre-fabricated.

-   **project.source.boxing**: the project *source code* is treated as a...

    -   `white`:     ...white box, i.e., the code is intentially fully transparent and understood.
    -   `grey`:      ...grey  box, i.e., the code is intentially partially intransparent or not understood.
    -   `black`:     ...black box, i.e., the code is intentially fully intransparent and not understood.

-   **project.source.size**: the project *source code* is...

    -   `small`:     ...for a small-size tool (smaller than 10K LoC).
    -   `medium`:    ...for a medium-size application (larger than 10K LoC).
    -   `large`:     ...for a large-size system (larger than 100K LoC).

-   **project.source.structure**: the project *source code* is based on...

    -   `bare`:      ...bare code (no reusable components).
    -   `library`:   ...the use of libraries (reusable components).
    -   `framework`: ...the use of frameworks (standard structure).

-   **project.process.actors**: the project *process* is driven by a...

    -   `person`:    ...single person is acting.
    -   `team`:      ...team of persons (with or without their personal supporting asssitants
                     and agents) is collaboratively acting.
    -   `crew`:      ...mixed crew of both persons and robots/agents is collaboratively acting.

-   **project.process.drive**: the project *process* progress is mainly driven by...

    -   `spec`:      ...specification (spec-driven development).
    -   `code`:      ...code (code-driven development).
    -   `test`:      ...tests (test-driven development).

-   **project.result.target**: the project *result* target is a...

    -   `prototype`: ...prototype (not in target technology, short life-time, 5% solution).
    -   `mvp`:       ...Minimum Viable Product (in target technology, short life-time, 10-90% solution)
    -   `product`:   ...product (in target technology, long life-time, 100% solution)

### Project Artifacts

Each artifact key is a [Minimatch](https://github.com/isaacs/minimatch)
glob pattern, evaluated relative to the project base directory:

-   **project.artifact.build**: glob pattern matching the project *build-time artifact* files.
-   **project.artifact.code**: glob pattern matching the project *source code* files.
-   **project.artifact.docs**: glob pattern matching the project *documentation* files.
-   **project.artifact.spec**: glob pattern matching the project *specification* files.
-   **project.artifact.arch**: glob pattern matching the project *architecture* files.

### Agent Classification

-   **agent.persona.style**: the Agentic AI *persona* has the communication style of a...
    -    `writer`:      ...writer: decorative, eloquent, and explaining.
    -    `engineer`:    ...engineer: brief, factual and accurate.
    -    `telegrapher`: ...telegrapher: very brief, factual, and abbreviating.
    -    `caveman`:     ...caveman: ultra brief, rough and stuttering.

-   **agent.persona.creativity**: the Agentic AI *persona* shows...
    -    `none`:        ...none creativity and is just fact-based.
    -    `lite`:        ...lite creativity and is combining existing facts.
    -    `full`:        ...full creativity and is discovering new facts.

-   **agent.process.autonomy**: the Agentic AI *process* is characterized by the AI acting as...
    -    `assistant`:   ...an assistant: goal given, plan given, short-running, Human-in-the-Loop (HitL).
    -    `hotl`:        ...an semi-autonomous agent: goal given, plan found, short-running, Human-over-the-Loop (HotL)
    -    `agent`:       ...an autonomous agent: goal given, plan found, long-running, no human interaction

