
## About

**Agentic Software Engineering (ASE)** is the opinionated companion
tooling of *Dr. Ralf S. Engelschall* for combining Agentic AI Coding
with Software Engineering in tools like *Claude Code*. **ASE** consists
of a *Claude Code* plugin and a Command-Line Interface (CLI) tool.

## Repository Layout

**ASE (Agentic Software Engineering)** ships two deliverables from one repo:

- `tool/` — the `@rse/ase` npm CLI (TypeScript, ESM, commander-based).
  Entry point `tool/src/ase.ts` wires the top-level commands `config`,
  `service`, `mcp`, `hook`, `diagram`, `setup`, and `task`, each
  registered by a corresponding `ase-<name>.ts` module. `ase config`
  manages layered YAML configuration across `user`/`project`/`task`/
  `session` scopes; `ase service` runs a per-project background HTTP
  service bridged to *Claude Code* via `ase mcp`; `ase hook` handles
  *Claude Code* hook events; `ase setup` installs/updates/uninstalls
  the tool and its companion plugin; `ase task` manages persisted task
  plans under `~/.ase/task/<id>/plan.md`; `ase diagram` renders Mermaid
  diagrams as Unicode/ASCII art.

- `plugin/` — the Claude Code plugin published via the marketplace
  defined at `.claude-plugin/marketplace.json`. Plugin metadata
  in `plugin/.claude-plugin/plugin.json`; skills live under
  `plugin/skills/<name>/SKILL.md`.

The root `README.md` is user-facing install docs;
`pages/` is the GitHub Pages site (`.github/workflows/static.yml`).

## Tool Build System

Build orchestration uses `@rse/stx`, not plain npm scripts. The only npm
script is `npm start`, which invokes stx with `etc/stx.conf`. Common
targets:

```
cd tool
npm start build         # lint + tsc (etc/tsc.json)
npm start lint          # eslint --config etc/eslint.mjs src/*.ts
npm start build-watch   # nodemon rebuild on src/**/*.ts
npm start lint-watch    # nodemon relint on src/**/*.ts
npm start clean         # rm -rf dst
npm start clean-dist    # also removes node_modules and package-lock.json
```

No test target is defined. The published `bin/ase` shim loads compiled output from `dst/`.

## Plugin Install (Local Development)

`plugin/Makefile` wraps the `claude plugin` CLI for local iteration:

```
cd plugin
make install     # marketplace add ./ + plugin install ase@ase
make reinstall   # uninstall + install
make update      # plugin update ase@ase (default target)
make uninstall
```

## Code Style

Strict TypeScript conventions are enforced in `tool/src/`: no semicolons
(except inside `for`), double quotes, K&R braces, no braces around
single-statement `if`/`while` blocks, vertically-aligned operators
on similar consecutive lines, `/* ... */` block comments with two
leading/trailing spaces, parens around all arrow parameters, and line
breaks before `else`/`catch`/`finally`. Match existing formatting
exactly when editing.

