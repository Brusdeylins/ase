
##  NAME

`ase-meta-intent` - Match an Intent to an ASE Command

##  SYNOPSIS

`ase-meta-intent`
    [`--help`|`-h`]
    *intent*

##  DESCRIPTION

The `ase-meta-intent` skill matches a free-text *intent* against the
*accumulated help* of all ASE skills -- the concatenation of every
skill's `help.md` file into `skills/ase-meta-intent/data.md`, built by
`npm start build` in `plugin/` -- and generates the *single* best-fitting
`/ase:ase-xxx-xxx` command that realizes the intent, complete with
concrete option flags and positional arguments derived from the selected
skill's `SYNOPSIS`, `OPTIONS`, and `ARGUMENTS`.

The generated command is presented together with a brief rationale in an
interactive dialog. The dialog lets the user *execute* the command (which
dispatches the target skill via its generated arguments), *cancel* the
operation, or *refine* the intent by typing any free-text instruction --
the instruction is folded into the intent and the best-fitting command is
re-matched and re-rendered. If no skill confidently matches the intent, a
warning is emitted and the user is prompted to refine or clarify it.

The skill exposes *no* option flags beyond `--help`/`-h`; it is driven
entirely through the intent argument and the interactive dialog.

##  ARGUMENTS

*intent*:
    The free-text intent to be realized. It describes *what* the user
    wants to achieve; the skill determines *which* ASE skill and *which*
    options and arguments realize it.

##  EXAMPLES

Route an intent to the matching command and pick from the dialog:

```text
❯ /ase-meta-intent lint the TypeScript sources for high-severity issues only
```

Route a planning intent to the matching command:

```text
❯ /ase-meta-intent explain how the authentication module works
```

##  SEE ALSO

[`ase-help-skill`](../ase-help-skill/help.md), [`ase-meta-proximity`](../ase-meta-proximity/help.md), [`ase-meta-search`](../ase-meta-search/help.md),
[`ase-code-craft`](../ase-code-craft/help.md).
