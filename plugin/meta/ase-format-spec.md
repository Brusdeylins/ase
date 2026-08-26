
@./ase-format-specbook.md

SpecBook Project Instantiation
==============================

-   The **SpecBook SCHEMA Model** of this project depends on
    the value of the <ase-spec-schema/> placeholder (holding the
    `project.artifact.spec.schema` configuration value):

    -   If <ase-spec-schema/> is *empty*:

        Then the **SpecBook SCHEMA Model** is the standard YAML
        schema configuration bundled with **ASE** in the file
        `meta/ase-format-specbook.yaml` (relative to the plugin root),
        which you *MUST* read via the `Read` tool before working on the
        specification of the **SpecBook SPEC Model**.

    -   If <ase-spec-schema/> is *not empty*:

        Then the **SpecBook SCHEMA Model** is the custom YAML schema
        configuration of the project in the file <ase-spec-schema/>
        (relative to the project root), which you *MUST* read via
        the `Read` tool before working on the specification of the
        **SpecBook SPEC Model**.

-   The **SpecBook SPEC Model** of this project is the set of specification
    Markdown files in the directory <ase-spec-basedir/> (relative
    to the project root), whose files are resolved via the
    `ase_artifact_list(kind: [ "spec" ])` tool of the `ase` MCP server.
