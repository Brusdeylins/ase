# ase-util-compat(1) -- Output Expected Probe Values of the Compatibility Self-Test

## SYNOPSIS

`ase util compat`
\[`-h`|`--help`\]

## DESCRIPTION

**ase util compat** writes the canonical expected values of all probes
of the `ase-meta-compat` self-test skill to standard output, one probe
per line as *id*`: `*value*, where *id* is
*category*`/`*probe-name*. The probe categories are `xml-placeholders`,
`control-flow`, `regex`, and `arithmetic`, which check whether the
model of the agent tool correctly interprets the pseudo-code
constructs the *ASE* skills are written in.

This command is intended to be invoked by the skill only after it has
recorded all actual probe results (so the model cannot see the
expected values beforehand), and not directly by end users. The MCP
tool `ase_compat` provides the same.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## EXIT STATUS

Exits with status `0`.

## SEE ALSO

`ase`(1), `ase-util`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
