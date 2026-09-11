
@./ase-format-specbook.md

SpecBook Project Instantiation
==============================

-   The **SpecBook SCHEMA Model** of this project depends on the value
    of the <ase-spec-schema/> placeholder (holding the
    `project.artifact.spec.schema` configuration value), which is a
    *whitespace-separated list* of schema entries, merged in the given
    order into *one* **SpecBook SCHEMA Model**:

    -   If <ase-spec-schema/> is *empty*:

        Then the list is treated as the single entry `std`.

    -   For each entry `std` in the list:

        The entry names the standard YAML schema configuration bundled
        with **ASE** in the file `meta/ase-format-specbook.yaml`
        (relative to the plugin root).

    -   For each *other* entry in the list:

        The entry names a custom YAML schema configuration file of the
        project (relative to the project root).

    You *MUST* read all resulting schema configuration files via the
    `Read` tool before working on the specification of the **SpecBook
    SPEC Model**.

-   The **SpecBook SPEC Model** of this project is the set of specification
    Markdown files in the directory <ase-spec-basedir/> (relative
    to the project root), whose files are resolved via the
    `ase_artifact_list(kind: [ "spec" ])` tool of the `ase` MCP server.
