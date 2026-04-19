
ChangeLog
=========

0.0.7 (2026-04-19)
------------------

- FEATURE: provide `ase config edit` command and update manual page
- FEATURE: add schema validation for configuration
- IMPROVEMENT: render `ase config list` as a nice table
- IMPROVEMENT: complain on non-leaf keys in configuration
- IMPROVEMENT: improve type safety and strictness
- REFACTOR: upgrade to Commander from Yargs and remove agent stuff for now
- REFACTOR: switch to separate arguments
- CLEANUP: cleanup `ase config` command and config handling

0.0.6 (2026-04-18)
------------------

- FEATURE: add `service` command to CLI tool
- FEATURE: add top-level configuration
- FEATURE: add new spec skills (preflight, edit, implement)
- IMPROVEMENT: improve diagramming skill with unicode character hints and if-construct support
- IMPROVEMENT: add diagram rendering rules and optional diagrams in elaborate skill
- IMPROVEMENT: clarify diagram vs. table distinction in skill output
- IMPROVEMENT: improve analyze/elaborate skills
- IMPROVEMENT: improve spec skills
- IMPROVEMENT: make code-lint skill language-agnostic
- IMPROVEMENT: do not enforce Opus model for now
- UPDATE: update dependencies
- CLEANUP: ignore `.ase` directory
- CLEANUP: various tool and main code cleanups
- CLEANUP: simplify and reformat skill information

0.0.5 (2026-04-13)
------------------

- IMPROVEMENT: add license in full text
- IMPROVEMENT: improve README with support hint and "see also" section
- IMPROVEMENT: improve quorum skill
- IMPROVEMENT: experiment with collapsed items in skills
- IMPROVEMENT: finalize commit skill
- BUGFIX: fix references in plugin skill and agent files
- BUGFIX: add missing entries to plugin configuration
- CLEANUP: cleanup and fix "npm start publish" step
- CLEANUP: align README and syntax of arguments in skill files
- CLEANUP: rename skill and agent from ase-meta-websearch to ase-meta-search

0.0.4 (2026-04-13)
------------------

- IMPROVEMENT: improved README with diagram, caution hint, and homepage URL
- IMPROVEMENT: added ase-code-commit skill
- IMPROVEMENT: added ASE logo
- IMPROVEMENT: provide Github release information on "npm start publish"
- BUGFIX: added missing building-blocks SVG file
- UPDATE: updated building-blocks and coding-assistance diagrams
- CLEANUP: various README and plugin skill cleanups

0.0.3 (2026-04-12)
------------------

- IMPROVEMENT: add ase-code-refactor skill

0.0.2 (2026-04-12)
------------------

- IMPROVEMENT: print version on loading

0.0.1 (2026-04-12)
------------------

- IMPROVEMENT: added Claude Code plugin infrastructure with marketplace support
- IMPROVEMENT: added CLI tool skeleton with yargs-based command structure
- IMPROVEMENT: imported lint, craft, insight, and other Claude Code skills
- IMPROVEMENT: added GitHub Pages site and static deployment workflow
- IMPROVEMENT: added top-level build infrastructure with stx integration
- IMPROVEMENT: added constitution (AGENTS.md) for agent instructions
- IMPROVEMENT: improved analysis and insight skills
- IMPROVEMENT: improved error handling and duplicate hook avoidance
- BUGFIX: fixed descriptions, references, typos, and comments
- UPDATE: inlined Andrew Karpathy coding guidelines
- UPDATE: switched from CLAUDE.md to AGENTS.md with hook-based delivery
- UPDATE: used "ase-" prefix for plugin parts consistently
- CLEANUP: various code and configuration cleanups

0.0.0 (2026-04-01)
------------------

(first rough cut of library)

