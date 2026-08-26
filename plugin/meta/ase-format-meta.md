
Artifact Meta Information
=========================

**ASE** knows about the following **Artifact Set**s of a project, each
identified by a unique <artifact-set-id/>:

-   `Specification` (`SPEC`), aka "Software Requirements Specification
    (SRS)", "Product Requirements Document (PRD)", "Requirements",
    "Software Architecture Specification (SAS)", "Architecture
    Description", or "Architecture Decision Record (ADR)". It covers
    both the *requirements* ("what") and the *architecture* ("how") of
    the project and is authored in the **SpecBook** format (see
    `ase-format-spec.md`).

-   `Source Code` (`CODE`), aka "Software Implementation Results (IMP)",
    "Code", or "Software".

-   `Documentation` (`DOCS`), aka "Software Documentation Results (DOC)".

-   `Tasks` (`TASK`), aka "Task Plans", "Issues", or "User Stories". It
    is authored in the task plan format (see `ase-format-task.md`).

-   `Infrastructure` (`INFR`), aka "Infrastructure as Code (IaC)",
    "Deployment", or "Operations".

-   `Other` (`OTHR`), the implicit catch-all for any artifacts not
    covered by the other **Artifact Set**s.

The <artifact-set-id/> is one of `SPEC`, `CODE`, `DOCS`, `TASK`, `INFR`,
or `OTHR`. The files of every **Artifact Set** except `TASK` are resolved
via the `ase_artifact_list(kind: [ ... ])` tool of the `ase` MCP server
(with the lower-cased <artifact-set-id/> as `kind`), while the `TASK`
files are managed by the `ase_task_*` tools.
