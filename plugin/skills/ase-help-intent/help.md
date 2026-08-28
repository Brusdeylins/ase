
##  NAME

`ase-help-intent` - Match an Intent to ASE Commands

##  SYNOPSIS

`ase-help-intent`
    [`--help`|`-h`]
    *intent*

##  DESCRIPTION

The `ase-help-intent` skill matches a free-text *intent* against the
*accumulated help* of all ASE skills -- the concatenation of every
skill's `help.md` file into `skills/ase-help-intent/data.md`, built by
`npm start build` in `plugin/` -- and generates *all* adequately fitting
`/ase:ase-xxx-xxx` commands that realize the intent, ranked best-fitting
first and limited to the eight best ones. The fit is judged primarily
against each skill's `SCENARIOS` ("You want ...") and `DESCRIPTION`
sections, and each command is complete with concrete option flags and
positional arguments derived from the skill's `SYNOPSIS`, `OPTIONS`,
and `ARGUMENTS`.

The generated commands are presented together with a brief per-command
rationale in an interactive dialog. The dialog lets the user *execute*
one of the commands `C1`...`C8` (which dispatches the target skill via
its generated arguments), *cancel* the operation, or *refine* the intent
by typing any free-text instruction -- the instruction is folded into
the intent and the fitting commands are re-matched and re-rendered. If
no skill confidently matches the intent, a warning is emitted and the
user is prompted to refine or clarify it.

The skill exposes *no* option flags beyond `--help`/`-h`; it is driven
entirely through the intent argument and the interactive dialog.

##  ARGUMENTS

-   *intent*:
    The free-text intent to be realized. It describes *what* the user
    wants to achieve; the skill determines *which* ASE skills and *which*
    options and arguments realize it.

##  SCENARIOS

-   You want to know which ASE skills realize what you have in mind
-   You want free text turned into concrete slash commands with options
-   You want all matching commands proposed, ranked best-fitting first
-   You want to refine an intent in a dialog until a command fits

##  EXAMPLES

Route an intent to the matching commands and pick one from the dialog:

```text
❯ /ase-help-intent lint the TypeScript sources for high-severity issues only
```

Route a planning intent to the matching commands:

```text
❯ /ase-help-intent explain how the authentication module works
```

##  SEE ALSO

[`ase-help-skill`](../ase-help-skill/help.md), [`ase-meta-proximity`](../ase-meta-proximity/help.md), [`ase-meta-search`](../ase-meta-search/help.md),
[`ase-code-craft`](../ase-code-craft/help.md).
