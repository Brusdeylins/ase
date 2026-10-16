# ase-util-mint(1) -- Mint Hash-Derived Identifiers

## SYNOPSIS

`ase util mint`
\[`-h`|`--help`\]
\[`-t`|`--type` `uuid`|`sha1`|`nanoid`\]
\[`-c`|`--count` *count*\]
\[*hint* \[...\]\]

## DESCRIPTION

**ase util mint** mints one or more hash-derived identifiers out of the
*hint* formed by the remaining arguments (joined by single spaces), and
prints them to standard output, one identifier per line:

- With type `uuid`, a non-empty *hint* yields a deterministic *UUID
  V5* over the *hint* within the fixed *ASE* namespace (itself the
  *UUID V5* of the URL `https://ase.tools` within the standard URL
  namespace), so the same *hint* always yields the same UUID, disjoint
  from those of other applications. An empty *hint* yields random
  *UUID V4* values instead.

- With type `sha1`, the *hint* yields its 40-character hexadecimal
  *SHA-1* digest. This requires a non-empty *hint*.

- With type `nanoid`, the *hint* yields its 10-character, *NanoId*-style
  *base62* hash (its *SHA-1* digest, *base62*-encoded and truncated),
  a short but still reproducible identifier, as used for the content
  binding of the `Effort` key of the task plans. This requires a
  non-empty *hint*, too.

This backs the `uuid`, `sha1`, and `nanoid` types of the `ase-meta-mint` skill
(and the MCP tool `ase_mint`), while the language-level identifier
types of that skill require the AI and hence exist in the skill only.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--type` `uuid`|`sha1`|`nanoid`\]:
  The identifier type (default: `uuid`).

- \[`-c`|`--count` *count*\]:
  The number of identifiers to mint, a positive integer (default:
  `1`). It is honored for an empty *hint* only, where random *UUID V4*
  values are minted. As hashing a non-empty *hint* always yields
  exactly one identifier, a larger *count* is then reduced to `1`, and a
  warning is printed on standard error.

## ARGUMENTS

- \[*hint* \[...\]\]:
  The hint the identifiers are derived from, formed by all remaining
  arguments joined by single spaces (default: empty).

## EXIT STATUS

Exits with status `0` on success, and with status `1` on an invalid
*count* or type `sha1` or `nanoid` with an empty *hint*.

## EXAMPLES

```sh
# mint the deterministic UUID of a hint
$ ase util mint the user account entity

# mint three random UUIDs
$ ase util mint -c 3

# mint the SHA-1 digest of a hint
$ ase util mint -t sha1 the user account entity

# mint the short NanoId-style hash of a hint
$ ase util mint -t nanoid the user account entity
```

## SEE ALSO

`ase`(1), `ase-util`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
