# ase-util-metric(1) -- Measure the Length Metrics of a Text

## SYNOPSIS

`ase util metric`
\[`-h`|`--help`\]
\[`-f`|`--file` *file*\]
\[*text* \[...\]\]

## DESCRIPTION

**ase util metric** measures the length metrics of a text, given either
as the content of a *file* or as the *text* formed by the remaining
arguments (joined by single spaces), which are mutually exclusive and
of which exactly one has to be given. The metrics are printed to
standard output as a single-line JSON object with the fields:

- `words`:
  The number of whitespace-separated tokens.

- `lines`:
  The number of newline-separated lines, where a trailing line without
  a final newline still counts as one line (and an empty text has `0`
  lines).

- `chars`:
  The number of Unicode characters, i.e., code points.

- `bytes`:
  The number of octets: the raw file size for a *file* (as its
  encoding is not necessarily UTF-8), resp. the UTF-8 length for a
  *text*.

A *file* is decoded as UTF-8 for the other metrics. This backs the
MCP tool `ase_text_metric`, which the skills use instead of estimating
a text length themselves.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-f`|`--file` *file*\]:
  Measure the content of *file* instead of the *text* arguments.

## ARGUMENTS

- \[*text* \[...\]\]:
  The text to measure, formed by all arguments joined by single spaces
  (mutually exclusive with `--file`).

## EXIT STATUS

Exits with status `0` on success, and with status `1` if both or none
of *file* and *text* are given, or *file* cannot be read.

## EXAMPLES

```sh
# measure a document
$ ase util metric -f README.md

# measure a text
$ ase util metric "Hello, World!"
{"words":2,"lines":1,"chars":13,"bytes":13}
```

## SEE ALSO

`ase`(1), `ase-util`(1), `wc`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
