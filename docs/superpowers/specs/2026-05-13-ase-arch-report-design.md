# ase-arch-report — Design

Date: 2026-05-13
Status: Design — pending user review

## Goal

A new ASE skill plus CLI/MCP tool that generates a deterministic, high-quality
architecture report for a user-supplied code scope (directory or glob). The
report covers: visual structure (class/module diagrams), a complete listing of
public symbols with short per-symbol descriptions, cluster overview, and
cluster-to-cluster dependencies. Language-agnostic via tree-sitter.

## Motivation

For large modules, hand-maintained architecture documentation is not
sustainable. A deterministic, regenerable report from source enables:

- Onboarding new developers
- Reviewing the impact of refactors via diffing two reports
- Surfacing documentation debt (symbols without doc comments are made visible)
- Cross-language consistency: the same report format for Java, TypeScript,
  Python, Go, Rust, Kotlin, C#, C/C++, JavaScript modules

## Scope

In scope:

- Symbol extraction (classes, interfaces, records, methods, functions, public
  fields) via a tree-sitter grammar set covering nine MVP languages
- Cluster detection: default = sub-directory tree at full path depth; override
  via configuration file
- Diagram rendering via the existing `ase diagram` tool chain (Mermaid →
  beautiful-mermaid ASCII for Markdown; client-side Mermaid for HTML/SVG)
- Markdown output with embedded ASCII diagrams, tables, cross-references
- HTML output with embedded SVG diagrams, black/white/grey theme, accent
  color `#a01441`
- JSON output (`api.json`) capturing the structured symbol inventory, suitable
  for diffing between report runs

Out of scope (for this iteration):

- Dynamic analysis (runtime call graphs)
- Cross-repository reports
- Incremental updates (each run is a full rebuild; file-content hash cache
  speeds re-runs within a single invocation)
- PDF export

## Input

Command line:

```
ase arch-report <path-or-glob>
                [--lang=auto|java|ts|js|python|go|rust|kotlin|csharp|c|cpp]
                [--output=docs/reports/<basename>-YYYY-MM-DD/]
                [--format=md|html|both]
                [--config=<file>]
```

Skill invocation (`/ase-arch-report`):

The skill prompts the user for `<path>` (if not provided) and for the output
format via Claude Code's native `AskUserQuestion` UI, then invokes the CLI.

Arguments:

- `path-or-glob` — required, source scope
- `--lang` — optional, defaults to `auto` (detection by file extension)
- `--output` — optional, defaults to `docs/reports/<basename>-YYYY-MM-DD/`
  relative to the current working directory, where `<basename>` is the
  longest directory component of `<path-or-glob>` before any glob
  metacharacter (`*`, `?`, `[`). Example: `tool/src/**/*.ts` →
  `docs/reports/src-2026-05-13/`
- `--format` — optional, defaults to `both`
- `--config` — optional, YAML or JSON; the `yaml` library parses both

## Architecture surface

```
ase CLI binary
└── arch-report <path-glob> [flags]
        │
        ├─ uses → renderArchReport(opts) pure helper
        │
        └─ writes → docs/reports/<basename>-YYYY-MM-DD/
                    ├── index.md          TOC, L1 cluster-flowchart, doc-debt
                    ├── index.html        same content, Mermaid SVG, themed
                    ├── 01-<cluster>.md   classDiagram + API tables
                    ├── 01-<cluster>.html
                    ├── ...
                    └── _meta/
                        ├── api.json       structured symbol inventory
                        └── unresolved.md  references that point outside scope

ase MCP service
└── arch_report(args) → returns JSON { output_dir, files[], stats }
        └─ delegates to renderArchReport(opts) — same helper as the CLI
```

The pattern mirrors `ase diagram`: a pure helper exported from one module is
wrapped by both a CLI subcommand and an MCP tool registration. The CLI does
the file-system work; the MCP tool returns a JSON summary describing what was
written.

### Tool layout

```
tool/src/ase-arch-report/
├── index.ts        Commander subcommand + helper export
├── discover.ts     Glob + language detection by file extension
├── parse.ts        tree-sitter per language; file-hash content cache
├── extract.ts      Symbol extraction via queries/<lang>.scm S-expressions
├── cluster.ts      Sub-directory grouping at full depth; config override
├── resolve.ts      Inheritance + inter-cluster edges (all references kept)
├── render-md.ts    Markdown generator; calls `ase diagram` for ASCII
├── render-html.ts  HTML generator; B/W + #a01441 theme
└── render-json.ts  api.json + unresolved.md
```

### Skill layout

```
plugin/skills/ase-arch-report/
├── SKILL.md        Frontmatter, trigger phrases, allowed-tools, workflow
└── queries/
    ├── java.scm
    ├── typescript.scm
    ├── javascript.scm
    ├── python.scm
    ├── go.scm
    ├── rust.scm
    ├── kotlin.scm
    ├── csharp.scm
    └── c.scm        (covers both C and C++ via tree-sitter-c / tree-sitter-cpp)
```

## Pipeline

The CLI helper executes seven sequential phases:

```
[1] DISCOVER     glob(<path>) → file list
                 group by extension → { java: [...], ts: [...], ... }

[2] PARSE        per file: tree-sitter parser → AST
                 cache by sha256(file content) in <output>/.arch-report-cache/

[3] EXTRACT      per AST: run queries/<lang>.scm
                 → symbols: { fqn, kind, modifiers, parents, methods[], doc }
                 doc = first sentence of preceding doc comment, or null

[4] CLUSTER      cluster = relative directory from <path-glob> root
                 full path depth, no aggregation
                 override: config.clusters[<regex>] → cluster name

[5] RESOLVE      within scope:
                 - inheritance: extends/implements → typed edges
                 - usage: import or reference → cluster→cluster edges (count ≥1)
                 external references → unresolved.md

[6] RENDER       per cluster page (.md and/or .html):
                 - Mermaid classDiagram with public symbols + inheritance
                 - Per-class table: method | signature | first-sentence-doc
                 index page:
                 - Mermaid flowchart of cluster boxes + inter-cluster arrows
                   (every edge with ≥1 reference is shown)
                 - TOC with stats per cluster
                 - Doc-debt section: symbols with null doc
                 - Language overview: cluster → language mapping

[7] WRITE        atomic: write to <output>.tmp/ then rename to <output>
                 final stdout line: "Report: <abs-output-path>/index.md"
```

Determinism: every list is sorted alphabetically by fully-qualified name or
path. Diffing two report runs yields a clean delta view.

Performance: no hard budget; tree-sitter parsing is fast and per-file
parallelizable. Diagram rendering is parallelized via `Promise.all` over
per-cluster render calls.

## Defaults

The following defaults reflect the user's correction that clusters group code
by *semantic content*, not by class count, and that the report should show
the *truth* of the codebase rather than smoothed-over approximations:

| Concern                            | Default                                          |
|------------------------------------|--------------------------------------------------|
| Cluster boundary                   | Sub-directory tree at full depth                 |
| Cluster splitting by class count   | Never                                            |
| Inter-cluster edge display         | Show every edge with at least one reference      |
| Missing doc comment policy         | Leave description blank; list under Doc Debt     |
| Output format                      | Both Markdown and HTML                           |
| Output directory                   | `docs/reports/<basename(path)>-YYYY-MM-DD/`        |
| Language detection                 | Auto by file extension                           |
| Diagram width budget               | None — wide diagrams scroll in viewer or browser |

## HTML theme

The HTML report uses a restrained, monochrome palette with a single accent
color, matching the user's preference:

- Background: `#ffffff`
- Foreground text: `#111111`
- Secondary text and borders: `#666666` and `#cccccc`
- Subtle backgrounds (table headers, code blocks): `#f5f5f5`
- Accent (links, active state, diagram edges of interest): `#a01441`

Mermaid is invoked client-side with a custom theme variables block that maps
the same tokens:

```js
mermaid.initialize({
  theme: "base",
  themeVariables: {
    primaryColor:        "#ffffff",
    primaryTextColor:    "#111111",
    primaryBorderColor:  "#666666",
    lineColor:           "#666666",
    secondaryColor:      "#f5f5f5",
    tertiaryColor:       "#ffffff",
    edgeLabelBackground: "#ffffff",
    classText:           "#111111"
  }
})
```

Where a class or edge participates in the cluster being highlighted on a
specific page, it is rendered in `#a01441` to draw the eye.

## `api.json` schema

A minimal, stable shape suitable for diffing:

```jsonc
{
  "scope": "<path-or-glob>",
  "generatedAt": "2026-05-13T12:00:00Z",
  "languages": ["java", "typescript"],
  "clusters": [
    {
      "name": "ibTws/adapter",
      "language": "java",
      "symbols": [
        {
          "fqn": "org.brusdeylins.itws.plugin.ibTws.adapter.FooAdapter",
          "kind": "class",
          "modifiers": ["public"],
          "extends": ["AbstractAdapter"],
          "implements": ["IAdapter"],
          "file": "src/main/java/org/.../FooAdapter.java",
          "doc": "Adapter for the Foo subsystem.",
          "members": [
            {
              "name": "request",
              "kind": "method",
              "signature": "public void request(int reqId, String symbol)",
              "doc": "Submit a request for the given symbol."
            }
          ]
        }
      ]
    }
  ],
  "edges": [
    { "from": "ibTws/adapter", "to": "interfaces/contract", "count": 7 }
  ],
  "docDebt": [
    { "fqn": "...FooAdapter#request", "file": "...", "line": 42 }
  ],
  "unresolved": [
    { "ref": "com.ib.client.EClient", "from": "ibTws/adapter/FooAdapter" }
  ]
}
```

## Skill `SKILL.md` outline

Frontmatter:

```yaml
---
name: ase-arch-report
argument-hint: "<path-or-glob>"
description: Generate a deterministic architecture report (Markdown and/or HTML) for a code scope
user-invocable: true
disable-model-invocation: false
model: sonnet
effort: low
allowed-tools:
  - "Bash(ase arch-report:*)"
  - "Bash(ls:*)"
  - "Bash(realpath:*)"
---
```

Trigger phrases (in description body):

- "architecture report", "arch report", "Architektur-Report"
- "code structure overview", "Übersicht der Klassen"
- "public API listing", "API-Übersicht"
- explicit slash command `/ase-arch-report` or `/ase:arch-report`
- references to `docs/reports/` as an output target

Workflow steps in `SKILL.md`:

1. Identify or ask for `<path-or-glob>`.
2. Use `AskUserQuestion` to let the user pick the output format (Markdown,
   HTML, or Both).
3. Invoke `ase arch-report <path> --format=<choice>` via Bash.
4. Read the final `"Report: <abs-path>"` line from the tool's stdout.
5. Confirm to the user with that path.

## Testing strategy

Self-test on the ASE codebase itself (TypeScript sources under `tool/src/`):

- `ase arch-report tool/src/ --format=both`
- expected: at least one cluster (`tool/src` or per-sub-dir); every exported
  symbol from each `ase-*.ts` file listed; index page renders a cluster
  flowchart; HTML report opens without error in a browser

Validation on a Java codebase (provided by the user when ready): clusters
match sub-directory structure at full depth, sealed-interface and record
hierarchies are recognized, Javadoc first sentences extracted.

Determinism check: two consecutive runs over the same scope produce byte-
identical `api.json` and identical Markdown files.

## Workflow and delivery

- All implementation lives on the local branch `add-arch-report-skill`,
  branched from `master`.
- No fork push, no pull request during initial development.
- Once functional, the branch is merged into `local-integration` for hands-on
  testing. The `local-integration` branch is rebuilt on every upstream
  rebase, so this merge is transient; the source of truth stays
  `add-arch-report-skill` until it is later promoted to a PR.
- The tool prints `Report: <abs-path>/index.md` as its last stdout line so
  the user always knows where to look after a run.

## Open implementation choices

Items the implementer is empowered to decide unless flagged here:

- WASM tree-sitter via `web-tree-sitter` is used. Native bindings (`tree-sitter`
  + `tree-sitter-<lang>` packages) were attempted first but fail to build on
  Node 24.x: `tree-sitter@0.25.0`'s `binding.gyp` does not request C++20 while
  V8 in Node 24 requires it (`v8config.h: error: "C++20 or later required."`).
  WASM avoids the native toolchain entirely and is portable. Per-grammar
  `.wasm` files are committed to the repo under
  `plugin/skills/ase-arch-report/wasm/<lang>.wasm` (pre-built from each
  grammar's GitHub release or via `tree-sitter build --wasm` in a separate
  setup pass). The `parse` module loads them on demand from that directory.
- Doc-comment heuristic when none exists: leave blank, do not auto-generate
  from method name.
- Cache directory `<output>/.arch-report-cache/` is gitignored by the tool
  (the tool emits a `.gitignore` inside that directory on first write).

## Non-goals

- No custom Mermaid renderer — reuse `ase diagram` for ASCII; rely on the
  Mermaid JS library bundled into HTML for SVG.
- No LLM-driven cluster suggestion — clustering is deterministic from
  filesystem plus optional config.
- No built-in lint or quality check — orthogonal to `ase-code-lint`.
