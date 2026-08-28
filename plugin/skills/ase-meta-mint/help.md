
##  NAME

`ase-meta-mint` - Mint an Identifier or Name

##  SYNOPSIS

`ase-meta-mint`
    [`--help`|`-h`]
    [`--type`|`-t` `uuid`|`sha1`|`const`|`var`|`class`|`func`|`path`|`name`]
    [`--count`|`-c` *count*]
    [*hint*]

##  DESCRIPTION

The `ase-meta-mint` skill *mints* an identifier or a name of a requested
type out of the free-text *hint* formed by the positional arguments. It
dispatches on `--type` and emits the generated strings as its result.

The two *hash-derived* types are delegated to the `ase_mint` tool of the
`ase` MCP server, which derives them reproducibly instead of guessing
them:

-   `uuid`:
    a deterministic *UUID V5* over the *hint*, within the fixed *ASE*
    namespace (itself a *UUID V5* over `https://ase.tools` in the
    standard URL namespace), or a random *UUID V4* if no *hint* is
    given.

-   `sha1`:
    the 40-character hexadecimal *SHA-1* digest of the *hint*.

The six *linguistic* types are derived by the skill itself: the *hint*
is distilled into its essential words, which are then assembled
according to the conventions of the type:

-   `const`:
    an `UPPER_SNAKE_CASE` constant identifier, such as `FOO_BAR_QUUX`.

-   `var`:
    a `lowerCamelCase` variable identifier, such as `fooBarQuux`, whose
    *last* part is a substantive naming what the value *is*, never a
    verb.

-   `func`:
    a `lowerCamelCase` function identifier, such as `fooBarQuux`, whose
    *first* part is a verb naming what the function *does*.

-   `class`:
    an `UpperCamelCase` class identifier, such as `FooBarQuux`, as a
    singular substantive phrase naming the modeled entity.

-   `path`:
    a `kebab-case` path component, such as `foo-bar-quux`.

-   `name`:
    an `UpperCamelCase` *product name*, such as `FooBarQuux`, optimized
    for a brand rather than for a description: short, pronounceable,
    memorable, and distinctive.

A *hint* is mandatory for every type except `uuid`, which falls back to
a random *UUID V4* without one.

##  OPTIONS

`--type`|`-t` `uuid`|`sha1`|`const`|`var`|`class`|`func`|`path`|`name`:
    Select the type of the minted identifier or name (default: `uuid`).

`--count`|`-c` *count*:
    Mint *count* identifiers instead of just one (default: `1`, maximum:
    `100`). For the hash-derived types it is honored only for an empty
    *hint*, where *count* random *UUID V4* values are emitted; with a
    non-empty *hint*, hashing is a pure function of that *hint* and
    hence always yields exactly one identifier, so *count* is clamped to
    `1` and a warning is emitted. For the linguistic types, *count*
    distinct candidates are emitted, ordered best-first.

##  ARGUMENTS

*hint*:
    The free-text hint the identifier or name is derived from. It may be
    a short description, a phrase, or a few keywords. It is mandatory
    for all types except `uuid`.

##  SCENARIOS

-   You need a stable, reproducible UUID or SHA-1 digest for a concept
-   You need a well-formed constant, variable, function, or class identifier
-   You need a path component or slug derived from a description
-   You need a catchy product name for a new component or tool

##  EXAMPLES

Mint a deterministic UUID for a concept:

```text
❯ /ase-meta-mint --type uuid the ASE artifact kind resolution cache
```

Mint a function identifier from a description:

```text
❯ /ase-meta-mint -t func compute the checksum of an artifact file
```

Mint three product name candidates:

```text
❯ /ase-meta-mint -t name -c 3 a background service bridging a project into the agent tool
```

##  SEE ALSO

[`ase-task-id`](../ase-task-id/help.md), [`ase-meta-brainstorm`](../ase-meta-brainstorm/help.md), [`ase-code-craft`](../ase-code-craft/help.md), [`ase-arch-discover`](../ase-arch-discover/help.md).
