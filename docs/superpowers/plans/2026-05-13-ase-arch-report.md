# ase-arch-report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ase-arch-report` ASE skill plus matching `ase arch-report` CLI subcommand and `arch_report` MCP tool that generates a deterministic architecture report (Markdown and/or HTML) for a user-supplied code scope, language-agnostic via tree-sitter.

**Architecture:** A pure `renderArchReport(opts)` helper lives in `tool/src/ase-arch-report/` and is wrapped by both a Commander CLI subcommand (registered in `ase.ts`) and an MCP tool registration (added to `ase-service.ts`). Pipeline: discover → parse → extract → cluster → resolve → render → write. Symbol extraction uses `web-tree-sitter` (the WASM runtime) plus per-language `.wasm` grammar files committed under `plugin/skills/ase-arch-report/wasm/<lang>.wasm`, driven by S-expression queries shipped with the skill under `plugin/skills/ase-arch-report/queries/<lang>.scm`. Output renders to `docs/reports/<basename>-YYYY-MM-DD/` with sibling Markdown and HTML files plus a `_meta/api.json` for diffing.

**Tech Stack:** TypeScript (ESM), Commander, `web-tree-sitter` (WASM runtime — native `tree-sitter` was attempted first but fails to build on Node 24 because V8 now requires C++20 while the upstream `binding.gyp` does not request it; WASM avoids the entire native-build toolchain), per-grammar `.wasm` files committed under `plugin/skills/ase-arch-report/wasm/<lang>.wasm`, `glob`, `yaml`, `beautiful-mermaid` (already in the repo via `ase diagram`), Mermaid JS (CDN-loaded for HTML), `node:test` + `node:assert` for tests.

**Spec:** `docs/superpowers/specs/2026-05-13-ase-arch-report-design.md`

**Branch:** `add-arch-report-skill` (already created from `master`; do not push to fork, do not open a PR during this work).

---

## File Structure

Files to be created:

```
tool/src/ase-arch-report/
├── index.ts          Commander subcommand + exported renderArchReport(opts) helper
├── types.ts          shared types (Symbol, Cluster, Edge, ArchReportOpts, ApiJson)
├── discover.ts       glob expansion, file grouping by extension, basename resolution
├── parse.ts          web-tree-sitter WASM parser pool, file-content sha256 cache
├── extract.ts        AST-to-symbol extraction via per-language .scm queries
├── cluster.ts        directory-based clustering (full path depth) + config overrides
├── resolve.ts        inheritance + inter-cluster reference resolution
├── render-md.ts      Markdown index + per-cluster pages with ASCII classDiagrams
├── render-html.ts    HTML index + per-cluster pages with Mermaid SVG, B/W + #a01441
├── render-json.ts    api.json + unresolved.md writer
└── theme.ts          shared color tokens (#a01441 accent + monochrome palette)

tool/test/ase-arch-report/
├── discover.test.ts
├── extract.test.ts
├── cluster.test.ts
├── resolve.test.ts
├── render-json.test.ts
├── render-md.test.ts
├── render-html.test.ts
└── fixtures/
    ├── ts-mini/         minimal TypeScript scope with one class, one interface
    ├── java-mini/       minimal Java scope with one class extending one interface
    └── multi-cluster/   two sub-dirs with one symbol each + a cross-cluster import

plugin/skills/ase-arch-report/
├── SKILL.md          frontmatter, trigger phrases, allowed-tools, workflow
└── queries/
    ├── java.scm
    ├── typescript.scm
    ├── javascript.scm
    ├── python.scm
    ├── go.scm
    ├── rust.scm
    ├── kotlin.scm
    ├── csharp.scm
    ├── c.scm
    └── cpp.scm
```

Files to be modified:

```
tool/src/ase.ts          register ArchReportCommand (top-level command wiring)
tool/src/ase-service.ts  register MCP tool "arch_report"
tool/package.json        add runtime deps (web-tree-sitter, glob, yaml)
tool/etc/tsc.json        ensure tool/test/ is excluded from prod build
tool/.gitignore          add docs/reports/.arch-report-cache/ pattern (if present)
CHANGELOG.md             add 0.0.27 entry describing ase-arch-report
```

---

## Task 1: Scaffold + Dependencies

**Files:**
- Modify: `tool/package.json`
- Create: `tool/src/ase-arch-report/types.ts`
- Create: `tool/src/ase-arch-report/theme.ts`

- [ ] **Step 1: Pin runtime dependencies in `tool/package.json`**

Add the following entries under `"dependencies"` (alphabetically sorted within the existing block, matching the existing two-column key alignment style used throughout the file). If a newer stable pin is current at install time, prefer that.

```json
"glob":                              "11.0.3",
"web-tree-sitter":                   "0.25.10",
"yaml":                              "2.9.0"
```

Note: the original plan used native `tree-sitter` + per-grammar packages, but on Node 24 the native `binding.gyp` fails compilation because V8 now requires C++20 (`v8config.h: error: "C++20 or later required."`). `web-tree-sitter` is the WASM-based alternative from the same upstream and avoids the native toolchain entirely. Per-grammar `.wasm` files are not npm packages; they are committed to the repo under `plugin/skills/ase-arch-report/wasm/` and downloaded/built in later tasks (Task 3 for TypeScript, Task 13 for the rest).

- [ ] **Step 2: Run `npm install` and verify `web-tree-sitter` loads**

```bash
cd /Users/matthias/Documents/Projects/Programming/git/ase-project/ase/tool
npm install
node -e "import('web-tree-sitter').then(async (m) => { await m.Parser.init(); console.log('web-tree-sitter ok') })"
```

Expected: `web-tree-sitter ok`. If the install fails with a peer-dep or runtime error, stop and report exact output.

- [ ] **Step 3: Define shared types**

Create `tool/src/ase-arch-report/types.ts`:

```typescript
/*  shared types for the arch-report pipeline  */

export type Language =
    "java"  | "typescript" | "javascript" | "python" | "go"
    | "rust" | "kotlin"    | "csharp"     | "c"      | "cpp"

export type SymbolKind =
    "class" | "interface" | "record" | "enum" | "trait"
    | "struct" | "method" | "function" | "field"

export type Modifier = "public" | "protected" | "private" | "internal" | "sealed" | "abstract" | "final"

export interface Member {
    name:      string
    kind:      SymbolKind
    signature: string
    doc:       string | null
    line:      number
}

export interface Symbol {
    fqn:        string
    name:       string
    kind:       SymbolKind
    modifiers:  Modifier[]
    extends:    string[]
    implements: string[]
    file:       string
    line:       number
    doc:        string | null
    members:    Member[]
}

export interface Edge {
    from:  string
    to:    string
    count: number
}

export interface Cluster {
    name:     string
    language: Language
    symbols:  Symbol[]
}

export interface ArchReportOpts {
    pathOrGlob:    string
    lang:          Language | "auto"
    output:        string
    format:        "md" | "html" | "both"
    config?:       string
    queriesDir?:   string
}

export interface ApiJson {
    scope:       string
    generatedAt: string
    languages:   Language[]
    clusters:    Cluster[]
    edges:       Edge[]
    docDebt:     { fqn: string; file: string; line: number }[]
    unresolved:  { ref: string; from: string }[]
}
```

- [ ] **Step 4: Define theme tokens**

Create `tool/src/ase-arch-report/theme.ts`:

```typescript
/*  monochrome palette with single accent — used by both Markdown (link styling
    where MD allows it) and HTML (CSS + Mermaid themeVariables)  */

export const THEME = {
    bg:        "#ffffff",
    fg:        "#111111",
    fgMuted:   "#666666",
    border:    "#cccccc",
    subtle:    "#f5f5f5",
    accent:    "#a01441"
} as const

export const MERMAID_THEME_VARIABLES = {
    primaryColor:        THEME.bg,
    primaryTextColor:    THEME.fg,
    primaryBorderColor:  THEME.fgMuted,
    lineColor:           THEME.fgMuted,
    secondaryColor:      THEME.subtle,
    tertiaryColor:       THEME.bg,
    edgeLabelBackground: THEME.bg,
    classText:           THEME.fg
} as const
```

- [ ] **Step 5: Commit**

```bash
git add tool/package.json tool/package-lock.json tool/src/ase-arch-report/types.ts tool/src/ase-arch-report/theme.ts
git commit -m "scaffold ase-arch-report: deps, shared types, theme tokens"
```

---

## Task 2: Discover Module

**Files:**
- Create: `tool/src/ase-arch-report/discover.ts`
- Create: `tool/test/ase-arch-report/discover.test.ts`
- Create: `tool/test/ase-arch-report/fixtures/ts-mini/src/Foo.ts`
- Create: `tool/test/ase-arch-report/fixtures/ts-mini/src/IFoo.ts`

- [ ] **Step 1: Create fixture files**

`tool/test/ase-arch-report/fixtures/ts-mini/src/IFoo.ts`:

```typescript
export interface IFoo {
    bar(): number
}
```

`tool/test/ase-arch-report/fixtures/ts-mini/src/Foo.ts`:

```typescript
import type { IFoo } from "./IFoo.js"

/** A foo implementation. */
export class Foo implements IFoo {
    /** Compute the bar. */
    bar(): number { return 42 }
}
```

- [ ] **Step 2: Write failing test**

Create `tool/test/ase-arch-report/discover.test.ts`:

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import path from "node:path"
import { discover, resolveBasename } from "../../src/ase-arch-report/discover.js"

const FIX = path.join(import.meta.dirname, "fixtures", "ts-mini")

test("discover finds .ts files under a directory", async () => {
    const result = await discover(path.join(FIX, "src"), "auto")
    assert.equal(result.files.typescript?.length, 2)
    assert.ok(result.files.typescript![0].endsWith(".ts"))
})

test("resolveBasename strips glob metacharacters", () => {
    assert.equal(resolveBasename("tool/src/**/*.ts"), "src")
    assert.equal(resolveBasename("itws/src/main/java/org/x/plugin/ibTws"), "ibTws")
    assert.equal(resolveBasename("./foo/bar"), "bar")
})
```

- [ ] **Step 3: Run test, expect failure**

```bash
cd tool && node --test --import tsx test/ase-arch-report/discover.test.ts
```

Expected: failure with `Cannot find module '../../src/ase-arch-report/discover.js'`.

- [ ] **Step 4: Implement `discover.ts`**

Create `tool/src/ase-arch-report/discover.ts`:

```typescript
import path                              from "node:path"
import { glob }                          from "glob"
import type { Language }                 from "./types.js"

const EXT_TO_LANG: Record<string, Language> = {
    ".java":  "java",
    ".ts":    "typescript",
    ".tsx":   "typescript",
    ".js":    "javascript",
    ".jsx":   "javascript",
    ".mjs":   "javascript",
    ".cjs":   "javascript",
    ".py":    "python",
    ".go":    "go",
    ".rs":    "rust",
    ".kt":    "kotlin",
    ".kts":   "kotlin",
    ".cs":    "csharp",
    ".c":     "c",
    ".h":     "c",
    ".cpp":   "cpp",
    ".cc":    "cpp",
    ".cxx":   "cpp",
    ".hpp":   "cpp",
    ".hh":    "cpp"
}

export interface DiscoverResult {
    basename: string
    files:    Partial<Record<Language, string[]>>
}

export const resolveBasename = (pathOrGlob: string): string => {
    const cut = pathOrGlob.search(/[*?[]/)
    const prefix = cut < 0 ? pathOrGlob : pathOrGlob.slice(0, cut)
    const trimmed = prefix.replace(/\/+$/, "")
    return path.basename(trimmed) || "report"
}

export const discover = async (pathOrGlob: string, langFilter: Language | "auto"): Promise<DiscoverResult> => {
    const isGlob = /[*?[]/.test(pathOrGlob)
    const pattern = isGlob ? pathOrGlob : path.join(pathOrGlob, "**/*")
    const matches = await glob(pattern, { nodir: true, absolute: true })
    const files: Partial<Record<Language, string[]>> = {}
    for (const f of matches) {
        const ext = path.extname(f).toLowerCase()
        const lang = EXT_TO_LANG[ext]
        if (lang === undefined)
            continue
        if (langFilter !== "auto" && lang !== langFilter)
            continue
        files[lang] ??= []
        files[lang]!.push(f)
    }
    for (const lang of Object.keys(files) as Language[])
        files[lang]!.sort()
    return { basename: resolveBasename(pathOrGlob), files }
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
node --test --import tsx test/ase-arch-report/discover.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add tool/src/ase-arch-report/discover.ts tool/test/ase-arch-report/discover.test.ts tool/test/ase-arch-report/fixtures/ts-mini/
git commit -m "discover: glob expansion + basename resolution for ase-arch-report"
```

---

## Task 3: Parse Module (WASM)

**Files:**
- Create: `tool/src/ase-arch-report/parse.ts`
- Create: `tool/test/ase-arch-report/parse.test.ts`
- Create (binary): `plugin/skills/ase-arch-report/wasm/typescript.wasm`

- [ ] **Step 1: Acquire the TypeScript grammar WASM**

The grammar `.wasm` files are not shipped via the npm package `web-tree-sitter`; they must be obtained separately. Use whichever of these paths works on the implementation machine, in this order of preference:

1. **Pre-built bundle:** if the npm package `tree-sitter-wasms` (maintainer `joeguilfoyle`, ships ~50 pre-built grammar WASMs) is installable and includes `tree-sitter-typescript.wasm`, add it as a `devDependency` and copy `node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm` to `plugin/skills/ase-arch-report/wasm/typescript.wasm`.

2. **Build via `tree-sitter-cli` + Emscripten:** if path 1 is unavailable, install `tree-sitter-cli` as a `devDependency` and `tree-sitter-typescript` (source-only) as a `devDependency`, install Emscripten locally (`brew install emscripten` on macOS), then run:

    ```bash
    cd node_modules/tree-sitter-typescript/typescript
    npx tree-sitter build --wasm -o ../../../plugin/skills/ase-arch-report/wasm/typescript.wasm
    ```

3. **Manual download:** if a grammar's GitHub release page publishes a pre-built `.wasm`, download and commit it.

Commit the resulting `typescript.wasm` to the repo. It is a binary asset (~1–2 MB). Document the acquisition path used in `plugin/skills/ase-arch-report/wasm/README.md`.

- [ ] **Step 2: Write failing test**

Create `tool/test/ase-arch-report/parse.test.ts`:

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import path from "node:path"
import { Parser } from "../../src/ase-arch-report/parse.js"

const FIX = path.join(import.meta.dirname, "fixtures", "ts-mini", "src", "Foo.ts")
const WASM_DIR = path.join(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report", "wasm")

test("Parser parses a TypeScript file and returns a non-empty AST", async () => {
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(FIX, "typescript")
    assert.ok(tree.rootNode !== null)
    assert.equal(tree.rootNode.type, "program")
    assert.ok(tree.rootNode.childCount > 0)
})

test("Parser caches by content hash within a single Parser instance", async () => {
    const parser = new Parser(WASM_DIR)
    const t1 = await parser.parse(FIX, "typescript")
    const t2 = await parser.parse(FIX, "typescript")
    assert.equal(t1, t2)
})
```

- [ ] **Step 3: Run test, expect failure**

```bash
cd /Users/matthias/Documents/Projects/Programming/git/ase-project/ase/tool
node --test --import tsx test/ase-arch-report/parse.test.ts
```

Expected: failure (module missing).

- [ ] **Step 4: Implement `parse.ts`**

```typescript
import fs                          from "node:fs/promises"
import crypto                      from "node:crypto"
import path                        from "node:path"
import * as wts                    from "web-tree-sitter"
import type { Language }           from "./types.js"

let inited = false
const initOnce = async (): Promise<void> => {
    if (inited)
        return
    await wts.Parser.init()
    inited = true
}

export class Parser {
    private readonly cache    = new Map<string, wts.Tree>()
    private readonly grammars = new Map<Language, wts.Language>()
    private readonly wasmDir:   string

    constructor(wasmDir: string) {
        this.wasmDir = wasmDir
    }

    async getGrammar(lang: Language): Promise<wts.Language> {
        await initOnce()
        let g = this.grammars.get(lang)
        if (g === undefined) {
            const file = path.join(this.wasmDir, `${lang}.wasm`)
            g = await wts.Language.load(file)
            this.grammars.set(lang, g)
        }
        return g
    }

    async parse(file: string, lang: Language): Promise<wts.Tree> {
        await initOnce()
        const src = await fs.readFile(file, "utf8")
        const hash = crypto.createHash("sha256").update(src).digest("hex")
        const key = `${lang}:${hash}`
        let tree = this.cache.get(key)
        if (tree !== undefined)
            return tree
        const parser = new wts.Parser()
        parser.setLanguage(await this.getGrammar(lang))
        tree = parser.parse(src)
        this.cache.set(key, tree)
        return tree
    }
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
node --test --import tsx test/ase-arch-report/parse.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit (separate the binary asset from the source code)**

```bash
cd /Users/matthias/Documents/Projects/Programming/git/ase-project/ase
git add plugin/skills/ase-arch-report/wasm/typescript.wasm plugin/skills/ase-arch-report/wasm/README.md
git commit -m "wasm: add tree-sitter typescript.wasm grammar"
git add tool/src/ase-arch-report/parse.ts tool/test/ase-arch-report/parse.test.ts tool/package.json tool/package-lock.json
git commit -m "parse: web-tree-sitter parser with WASM grammar loader and content-hash cache"
```

---

## Task 4: Extract Module (TypeScript First)

**Files:**
- Create: `tool/src/ase-arch-report/extract.ts`
- Create: `tool/test/ase-arch-report/extract.test.ts`
- Create: `plugin/skills/ase-arch-report/queries/typescript.scm`

- [ ] **Step 1: Write the TypeScript query**

Create `plugin/skills/ase-arch-report/queries/typescript.scm`:

```scheme
;  TypeScript: capture exported classes, interfaces, and their members.
;  Note: tree-sitter-typescript distinguishes `class_declaration` and
;  `interface_declaration` at the top level.

(class_declaration
    name: (type_identifier) @class.name) @class.def

(interface_declaration
    name: (type_identifier) @interface.name) @interface.def

(method_definition
    name: (property_identifier) @method.name) @method.def

(method_signature
    name: (property_identifier) @method.sig.name) @method.sig.def
```

- [ ] **Step 2: Write failing test**

Create `tool/test/ase-arch-report/extract.test.ts`:

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import path from "node:path"
import { Parser } from "../../src/ase-arch-report/parse.js"
import { extractSymbols } from "../../src/ase-arch-report/extract.js"

const FIX_DIR  = path.join(import.meta.dirname, "fixtures", "ts-mini", "src")
const PLUGIN   = path.join(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report")
const QUERIES  = path.join(PLUGIN, "queries")
const WASM_DIR = path.join(PLUGIN, "wasm")

test("extract: pulls exported class with doc comment and one method", async () => {
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(path.join(FIX_DIR, "Foo.ts"), "typescript")
    const grammar = await parser.getGrammar("typescript")
    const symbols = await extractSymbols(tree, grammar, "typescript", path.join(FIX_DIR, "Foo.ts"), QUERIES)
    const cls = symbols.find((s) => s.name === "Foo")
    assert.ok(cls !== undefined)
    assert.equal(cls!.kind, "class")
    assert.equal(cls!.doc, "A foo implementation.")
    assert.equal(cls!.members.length, 1)
    assert.equal(cls!.members[0].name, "bar")
    assert.equal(cls!.members[0].doc, "Compute the bar.")
})

test("extract: pulls exported interface with one method signature", async () => {
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(path.join(FIX_DIR, "IFoo.ts"), "typescript")
    const grammar = await parser.getGrammar("typescript")
    const symbols = await extractSymbols(tree, grammar, "typescript", path.join(FIX_DIR, "IFoo.ts"), QUERIES)
    const iface = symbols.find((s) => s.name === "IFoo")
    assert.ok(iface !== undefined)
    assert.equal(iface!.kind, "interface")
    assert.equal(iface!.members.length, 1)
    assert.equal(iface!.members[0].name, "bar")
})
```

- [ ] **Step 3: Run test, expect failure**

```bash
node --test --import tsx test/ase-arch-report/extract.test.ts
```

Expected: failure (module missing).

- [ ] **Step 4: Implement `extract.ts`**

```typescript
import fs                              from "node:fs/promises"
import path                            from "node:path"
import * as wts                        from "web-tree-sitter"
import type { Language, Symbol, Member, Modifier, SymbolKind } from "./types.js"

/*  load and cache .scm query text per (language, queriesDir)  */
const QUERY_CACHE = new Map<string, string>()
const loadQuery = async (lang: Language, queriesDir: string): Promise<string> => {
    const key = `${queriesDir}::${lang}`
    let q = QUERY_CACHE.get(key)
    if (q === undefined) {
        const file = path.join(queriesDir, `${lang}.scm`)
        q = await fs.readFile(file, "utf8")
        QUERY_CACHE.set(key, q)
    }
    return q
}

/*  extract first sentence of a leading doc-comment for a node, if present  */
const firstSentence = (raw: string): string | null => {
    /*  strip /** ... *\/ envelope plus line-leading asterisks  */
    const stripped = raw
        .replace(/^\/\*\*?/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trimEnd())
        .join(" ")
        .trim()
    if (stripped.length === 0)
        return null
    const m = stripped.match(/^(.+?[.!?])(\s|$)/)
    return (m !== null ? m[1] : stripped).trim()
}

const docFor = (node: wts.Node): string | null => {
    const prev = node.previousNamedSibling
    if (prev === null)
        return null
    if (prev.type === "comment" || prev.type === "block_comment")
        return firstSentence(prev.text)
    return null
}

const modifiersOf = (node: wts.Node): Modifier[] => {
    const out: Modifier[] = []
    for (const c of node.children) {
        if (c === null)
            continue
        if (c.type === "public" || c.type === "private" || c.type === "protected")
            out.push(c.type as Modifier)
        if (c.text === "abstract" || c.text === "sealed" || c.text === "final")
            out.push(c.text as Modifier)
    }
    return out
}

const memberKind = (nodeType: string): SymbolKind => {
    if (nodeType.startsWith("method"))
        return "method"
    if (nodeType.startsWith("function"))
        return "function"
    if (nodeType.startsWith("field") || nodeType === "property_signature")
        return "field"
    return "method"
}

export const extractSymbols = async (
    tree: wts.Tree, grammar: wts.Language, lang: Language, file: string, queriesDir: string
): Promise<Symbol[]> => {
    const qSrc = await loadQuery(lang, queriesDir)
    const query = grammar.query(qSrc)
    const matches = query.matches(tree.rootNode)

    /*  group captures: every match has a class/interface def + members.
        For TS the class/interface defs come as their own matches; method
        defs come as separate matches inside the body.  We collect class
        nodes first, then attach methods by parent containment.  */
    const types: wts.Node[] = []
    const methods: wts.Node[] = []
    for (const m of matches) {
        for (const c of m.captures) {
            if (c.name === "class.def" || c.name === "interface.def")
                types.push(c.node)
            else if (c.name === "method.def" || c.name === "method.sig.def")
                methods.push(c.node)
        }
    }

    const symbols: Symbol[] = []
    for (const t of types) {
        const nameNode = t.childForFieldName("name")
        const name = nameNode?.text ?? "<anon>"
        const kind: SymbolKind = t.type === "interface_declaration" ? "interface" : "class"
        const members: Member[] = []
        for (const m of methods) {
            /*  attach method to type if it is nested inside the type's body  */
            let ancestor: wts.Node | null = m.parent
            while (ancestor !== null && ancestor !== t)
                ancestor = ancestor.parent
            if (ancestor !== t)
                continue
            const mName = m.childForFieldName("name")?.text ?? "<anon>"
            members.push({
                name:      mName,
                kind:      memberKind(m.type),
                signature: m.text.split("\n")[0],
                doc:       docFor(m),
                line:      m.startPosition.row + 1
            })
        }
        symbols.push({
            fqn:        name,
            name,
            kind,
            modifiers:  modifiersOf(t),
            extends:    [],
            implements: [],
            file,
            line:       t.startPosition.row + 1,
            doc:        docFor(t),
            members
        })
    }
    return symbols
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
node --test --import tsx test/ase-arch-report/extract.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add tool/src/ase-arch-report/extract.ts tool/test/ase-arch-report/extract.test.ts plugin/skills/ase-arch-report/queries/typescript.scm
git commit -m "extract: tree-sitter query-driven symbol extraction (TypeScript)"
```

---

## Task 5: Cluster Module

**Files:**
- Create: `tool/src/ase-arch-report/cluster.ts`
- Create: `tool/test/ase-arch-report/cluster.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { clusterize } from "../../src/ase-arch-report/cluster.js"
import type { Symbol } from "../../src/ase-arch-report/types.js"

const mk = (file: string, name: string): Symbol => ({
    fqn: name, name, kind: "class", modifiers: ["public"],
    extends: [], implements: [], file,
    line: 1, doc: null, members: []
})

test("clusterize: full-depth sub-directory mapping under scope root", () => {
    const scopeRoot = "/repo/src"
    const symbols = [
        mk("/repo/src/adapter/Foo.ts",       "Foo"),
        mk("/repo/src/adapter/sub/Bar.ts",   "Bar"),
        mk("/repo/src/interfaces/IFoo.ts",   "IFoo")
    ]
    const clusters = clusterize(symbols, scopeRoot, "typescript")
    const names = clusters.map((c) => c.name).sort()
    assert.deepEqual(names, ["adapter", "adapter/sub", "interfaces"])
})

test("clusterize: scope root files cluster under '.'", () => {
    const scopeRoot = "/repo/src"
    const symbols = [mk("/repo/src/Top.ts", "Top")]
    const clusters = clusterize(symbols, scopeRoot, "typescript")
    assert.deepEqual(clusters.map((c) => c.name), ["."])
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
node --test --import tsx test/ase-arch-report/cluster.test.ts
```

- [ ] **Step 3: Implement `cluster.ts`**

```typescript
import path                              from "node:path"
import type { Symbol, Cluster, Language } from "./types.js"

export const clusterize = (symbols: Symbol[], scopeRoot: string, lang: Language): Cluster[] => {
    const groups = new Map<string, Symbol[]>()
    for (const s of symbols) {
        const rel = path.relative(scopeRoot, path.dirname(s.file))
        const key = rel === "" ? "." : rel
        const arr = groups.get(key) ?? []
        arr.push(s)
        groups.set(key, arr)
    }
    const out: Cluster[] = []
    for (const [name, syms] of groups) {
        syms.sort((a, b) => a.fqn.localeCompare(b.fqn))
        out.push({ name, language: lang, symbols: syms })
    }
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
node --test --import tsx test/ase-arch-report/cluster.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/cluster.ts tool/test/ase-arch-report/cluster.test.ts
git commit -m "cluster: full-depth sub-directory grouping"
```

---

## Task 6: Resolve Module

**Files:**
- Create: `tool/src/ase-arch-report/resolve.ts`
- Create: `tool/test/ase-arch-report/resolve.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { resolveEdges } from "../../src/ase-arch-report/resolve.js"
import type { Cluster, Symbol } from "../../src/ase-arch-report/types.js"

const sym = (name: string, file: string, impls: string[] = []): Symbol => ({
    fqn: name, name, kind: "class", modifiers: ["public"],
    extends: [], implements: impls, file,
    line: 1, doc: null, members: []
})

test("resolveEdges: same-cluster implements produces no inter-cluster edge", () => {
    const clusters: Cluster[] = [{
        name: "a", language: "typescript",
        symbols: [sym("Foo", "/x/a/Foo.ts", ["IFoo"]), sym("IFoo", "/x/a/IFoo.ts")]
    }]
    const { edges, unresolved } = resolveEdges(clusters)
    assert.equal(edges.length, 0)
    assert.equal(unresolved.length, 0)
})

test("resolveEdges: cross-cluster implements produces one edge", () => {
    const clusters: Cluster[] = [
        { name: "a", language: "typescript", symbols: [sym("Foo", "/x/a/Foo.ts", ["IFoo"])] },
        { name: "b", language: "typescript", symbols: [sym("IFoo", "/x/b/IFoo.ts")] }
    ]
    const { edges } = resolveEdges(clusters)
    assert.deepEqual(edges, [{ from: "a", to: "b", count: 1 }])
})

test("resolveEdges: external reference goes to unresolved", () => {
    const clusters: Cluster[] = [
        { name: "a", language: "typescript", symbols: [sym("Foo", "/x/a/Foo.ts", ["ExternalThing"])] }
    ]
    const { edges, unresolved } = resolveEdges(clusters)
    assert.equal(edges.length, 0)
    assert.deepEqual(unresolved, [{ ref: "ExternalThing", from: "a/Foo" }])
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
node --test --import tsx test/ase-arch-report/resolve.test.ts
```

- [ ] **Step 3: Implement `resolve.ts`**

```typescript
import type { Cluster, Edge } from "./types.js"

export interface ResolveResult {
    edges:      Edge[]
    unresolved: { ref: string; from: string }[]
}

export const resolveEdges = (clusters: Cluster[]): ResolveResult => {
    /*  index by simple name → cluster.name (last writer wins on duplicate
        names across clusters; this is rare for an arch report scope)  */
    const symbolCluster = new Map<string, string>()
    for (const c of clusters)
        for (const s of c.symbols)
            symbolCluster.set(s.name, c.name)

    const edgeMap   = new Map<string, Edge>()
    const unresolved: { ref: string; from: string }[] = []

    const key = (from: string, to: string) => `${from}->${to}`
    const bump = (from: string, to: string) => {
        const k = key(from, to)
        const e = edgeMap.get(k)
        if (e === undefined)
            edgeMap.set(k, { from, to, count: 1 })
        else
            e.count++
    }

    for (const c of clusters)
        for (const s of c.symbols)
            for (const ref of [...s.extends, ...s.implements]) {
                const target = symbolCluster.get(ref)
                if (target === undefined)
                    unresolved.push({ ref, from: `${c.name}/${s.name}` })
                else if (target !== c.name)
                    bump(c.name, target)
            }

    const edges = [...edgeMap.values()].sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    return { edges, unresolved }
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
node --test --import tsx test/ase-arch-report/resolve.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/resolve.ts tool/test/ase-arch-report/resolve.test.ts
git commit -m "resolve: inheritance edges within and across clusters"
```

---

## Task 7: Render JSON

**Files:**
- Create: `tool/src/ase-arch-report/render-json.ts`
- Create: `tool/test/ase-arch-report/render-json.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { renderJson } from "../../src/ase-arch-report/render-json.js"
import type { Cluster } from "../../src/ase-arch-report/types.js"

test("renderJson: builds ApiJson with sorted clusters and stable timestamp shape", () => {
    const clusters: Cluster[] = [{
        name: "a", language: "typescript",
        symbols: [{
            fqn: "Foo", name: "Foo", kind: "class", modifiers: ["public"],
            extends: [], implements: [], file: "/x/a/Foo.ts",
            line: 1, doc: "A foo.", members: []
        }]
    }]
    const json = renderJson({
        scope: "/x", languages: ["typescript"], clusters,
        edges: [], docDebt: [], unresolved: []
    })
    assert.equal(json.scope, "/x")
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(json.generatedAt))
    assert.deepEqual(json.languages, ["typescript"])
})
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Implement `render-json.ts`**

```typescript
import type { ApiJson, Cluster, Edge, Language } from "./types.js"

export interface RenderJsonInput {
    scope:      string
    languages:  Language[]
    clusters:   Cluster[]
    edges:      Edge[]
    docDebt:    { fqn: string; file: string; line: number }[]
    unresolved: { ref: string; from: string }[]
}

const isoNow = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z")

export const renderJson = (input: RenderJsonInput): ApiJson => ({
    scope:       input.scope,
    generatedAt: isoNow(),
    languages:   [...input.languages].sort(),
    clusters:    [...input.clusters].sort((a, b) => a.name.localeCompare(b.name)),
    edges:       input.edges,
    docDebt:     input.docDebt,
    unresolved:  input.unresolved
})
```

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/render-json.ts tool/test/ase-arch-report/render-json.test.ts
git commit -m "render-json: ApiJson assembly with deterministic ordering"
```

---

## Task 8: Render Markdown

**Files:**
- Create: `tool/src/ase-arch-report/render-md.ts`
- Create: `tool/test/ase-arch-report/render-md.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { renderClusterMd, renderIndexMd } from "../../src/ase-arch-report/render-md.js"
import type { ApiJson } from "../../src/ase-arch-report/types.js"

const apiFixture: ApiJson = {
    scope:       "/x/src",
    generatedAt: "2026-05-13T12:00:00Z",
    languages:   ["typescript"],
    clusters: [{
        name: "a", language: "typescript",
        symbols: [{
            fqn: "Foo", name: "Foo", kind: "class", modifiers: ["public"],
            extends: [], implements: ["IFoo"], file: "/x/src/a/Foo.ts",
            line: 1, doc: "A foo.", members: [
                { name: "bar", kind: "method", signature: "bar(): number", doc: "Compute bar.", line: 2 }
            ]
        }]
    }],
    edges:      [],
    docDebt:    [],
    unresolved: []
}

test("renderClusterMd: includes a mermaid classDiagram fence and a method table", () => {
    const md = renderClusterMd(apiFixture.clusters[0], apiFixture)
    assert.match(md, /```mermaid\nclassDiagram/)
    assert.match(md, /\| Method \| Signature \| Description \|/)
    assert.match(md, /\| `bar` \| `bar\(\): number` \| Compute bar\. \|/)
})

test("renderIndexMd: includes TOC, cluster flowchart, doc-debt sections", () => {
    const md = renderIndexMd(apiFixture)
    assert.match(md, /^# Architecture Report/m)
    assert.match(md, /## Clusters/)
    assert.match(md, /```mermaid\nflowchart/)
    assert.match(md, /## Documentation debt/)
})
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Implement `render-md.ts`**

```typescript
import type { ApiJson, Cluster, Symbol } from "./types.js"

const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")

const mermaidClassDiagram = (cluster: Cluster): string => {
    const lines: string[] = ["```mermaid", "classDiagram"]
    for (const s of cluster.symbols) {
        const kindTag = s.kind === "interface" ? "<<interface>>" : ""
        lines.push(`    class ${safeId(s.name)} {`)
        if (kindTag !== "")
            lines.push(`        ${kindTag}`)
        for (const m of s.members)
            lines.push(`        ${m.signature}`)
        lines.push("    }")
        for (const parent of s.extends)
            lines.push(`    ${safeId(parent)} <|-- ${safeId(s.name)}`)
        for (const iface of s.implements)
            lines.push(`    ${safeId(iface)} <|.. ${safeId(s.name)}`)
    }
    lines.push("```")
    return lines.join("\n")
}

const apiTable = (s: Symbol): string => {
    const head = `### \`${s.name}\` (${s.kind})\n\n${s.doc ?? "_(no description)_"}\n\n`
    if (s.members.length === 0)
        return head + "_no public members_\n"
    const rows = s.members.map((m) =>
        `| \`${m.name}\` | \`${m.signature}\` | ${m.doc ?? "_(no description)_"} |`).join("\n")
    return head + "| Method | Signature | Description |\n|---|---|---|\n" + rows + "\n"
}

export const renderClusterMd = (cluster: Cluster, _api: ApiJson): string => {
    const parts: string[] = []
    parts.push(`# Cluster: \`${cluster.name}\` (${cluster.language})\n`)
    parts.push(mermaidClassDiagram(cluster))
    parts.push("\n## Symbols\n")
    for (const s of cluster.symbols)
        parts.push(apiTable(s))
    return parts.join("\n")
}

export const renderIndexMd = (api: ApiJson): string => {
    const lines: string[] = []
    lines.push(`# Architecture Report\n`)
    lines.push(`Scope: \`${api.scope}\`  `)
    lines.push(`Generated: ${api.generatedAt}  `)
    lines.push(`Languages: ${api.languages.join(", ")}\n`)
    lines.push(`## Clusters\n`)
    lines.push("```mermaid")
    lines.push("flowchart LR")
    for (const c of api.clusters)
        lines.push(`    ${safeId(c.name)}["${c.name}<br/>${c.symbols.length} symbols"]`)
    for (const e of api.edges)
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
    lines.push("```\n")
    lines.push(`## Per-cluster pages\n`)
    for (const c of api.clusters)
        lines.push(`- [\`${c.name}\`](./${safeId(c.name)}.md) — ${c.symbols.length} symbols`)
    lines.push(`\n## Documentation debt\n`)
    if (api.docDebt.length === 0)
        lines.push("_none — every public symbol carries a doc comment_")
    else
        for (const d of api.docDebt)
            lines.push(`- \`${d.fqn}\` (${d.file}:${d.line})`)
    return lines.join("\n") + "\n"
}
```

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/render-md.ts tool/test/ase-arch-report/render-md.test.ts
git commit -m "render-md: cluster pages with mermaid classDiagram + API tables"
```

---

## Task 9: Render HTML

**Files:**
- Create: `tool/src/ase-arch-report/render-html.ts`
- Create: `tool/test/ase-arch-report/render-html.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { renderClusterHtml, renderIndexHtml } from "../../src/ase-arch-report/render-html.js"
import type { ApiJson } from "../../src/ase-arch-report/types.js"

const apiFixture: ApiJson = {
    scope: "/x/src", generatedAt: "2026-05-13T12:00:00Z",
    languages: ["typescript"],
    clusters: [{
        name: "a", language: "typescript",
        symbols: [{
            fqn: "Foo", name: "Foo", kind: "class", modifiers: ["public"],
            extends: [], implements: [], file: "/x/src/a/Foo.ts",
            line: 1, doc: "A foo.", members: []
        }]
    }],
    edges: [], docDebt: [], unresolved: []
}

test("renderClusterHtml: contains mermaid script tag and accent color CSS token", () => {
    const html = renderClusterHtml(apiFixture.clusters[0], apiFixture)
    assert.match(html, /<script[^>]*mermaid/)
    assert.match(html, /#a01441/)
    assert.match(html, /<div class="mermaid">/)
})

test("renderIndexHtml: contains <!doctype html> and cluster flowchart container", () => {
    const html = renderIndexHtml(apiFixture)
    assert.match(html, /^<!doctype html>/i)
    assert.match(html, /flowchart LR/)
})
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Implement `render-html.ts`**

```typescript
import type { ApiJson, Cluster, Symbol } from "./types.js"
import { THEME, MERMAID_THEME_VARIABLES } from "./theme.js"

const css = `
:root {
    --bg:       ${THEME.bg};
    --fg:       ${THEME.fg};
    --fg-muted: ${THEME.fgMuted};
    --border:   ${THEME.border};
    --subtle:   ${THEME.subtle};
    --accent:   ${THEME.accent};
}
body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; max-width: 1024px; margin: 2rem auto; padding: 0 1rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
th { background: var(--subtle); font-weight: 600; }
code { background: var(--subtle); padding: 0.1rem 0.3rem; border-radius: 3px; }
h1 { border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }
.mermaid { margin: 1.5rem 0; }
`

const mermaidBootstrap = `
<script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"
    mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: ${JSON.stringify(MERMAID_THEME_VARIABLES)} })
</script>
`

const wrap = (title: string, body: string): string =>
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${body}
${mermaidBootstrap}
</body>
</html>`

const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_]/g, "_")

const classDiagramSrc = (cluster: Cluster): string => {
    const lines: string[] = ["classDiagram"]
    for (const s of cluster.symbols) {
        lines.push(`    class ${safeId(s.name)} {`)
        if (s.kind === "interface")
            lines.push(`        <<interface>>`)
        for (const m of s.members)
            lines.push(`        ${m.signature}`)
        lines.push("    }")
    }
    return lines.join("\n")
}

const flowchartSrc = (api: ApiJson): string => {
    const lines: string[] = ["flowchart LR"]
    for (const c of api.clusters)
        lines.push(`    ${safeId(c.name)}["${c.name}<br/>${c.symbols.length} symbols"]`)
    for (const e of api.edges)
        lines.push(`    ${safeId(e.from)} -->|${e.count}| ${safeId(e.to)}`)
    return lines.join("\n")
}

const symTable = (s: Symbol): string => {
    if (s.members.length === 0)
        return `<h3><code>${s.name}</code> (${s.kind})</h3><p>${s.doc ?? "<em>no description</em>"}</p><p><em>no public members</em></p>`
    const rows = s.members.map((m) =>
        `<tr><td><code>${m.name}</code></td><td><code>${m.signature}</code></td><td>${m.doc ?? "<em>no description</em>"}</td></tr>`).join("\n")
    return `<h3><code>${s.name}</code> (${s.kind})</h3>
<p>${s.doc ?? "<em>no description</em>"}</p>
<table><thead><tr><th>Method</th><th>Signature</th><th>Description</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

export const renderClusterHtml = (cluster: Cluster, _api: ApiJson): string => {
    const body = `<h1>Cluster: <code>${cluster.name}</code> (${cluster.language})</h1>
<div class="mermaid">${classDiagramSrc(cluster)}</div>
<h2>Symbols</h2>
${cluster.symbols.map(symTable).join("\n")}`
    return wrap(`arch-report — ${cluster.name}`, body)
}

export const renderIndexHtml = (api: ApiJson): string => {
    const body = `<h1>Architecture Report</h1>
<p>Scope: <code>${api.scope}</code><br>
Generated: ${api.generatedAt}<br>
Languages: ${api.languages.join(", ")}</p>
<h2>Clusters</h2>
<div class="mermaid">${flowchartSrc(api)}</div>
<h2>Per-cluster pages</h2>
<ul>
${api.clusters.map((c) => `<li><a href="./${safeId(c.name)}.html"><code>${c.name}</code></a> — ${c.symbols.length} symbols</li>`).join("\n")}
</ul>
<h2>Documentation debt</h2>
${api.docDebt.length === 0
    ? "<p><em>none — every public symbol carries a doc comment</em></p>"
    : `<ul>${api.docDebt.map((d) => `<li><code>${d.fqn}</code> (${d.file}:${d.line})</li>`).join("")}</ul>`}`
    return wrap("arch-report — index", body)
}
```

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/render-html.ts tool/test/ase-arch-report/render-html.test.ts
git commit -m "render-html: themed HTML with Mermaid SVG + #a01441 accent"
```

---

## Task 10: CLI Subcommand Wiring

**Files:**
- Create: `tool/src/ase-arch-report/index.ts`
- Modify: `tool/src/ase.ts`

- [ ] **Step 1: Implement helper + Commander subcommand in `index.ts`**

```typescript
import fs                              from "node:fs/promises"
import path                            from "node:path"
import { Command }                     from "commander"
import { discover, resolveBasename }   from "./discover.js"
import { Parser }                      from "./parse.js"
import { extractSymbols }              from "./extract.js"
import { clusterize }                  from "./cluster.js"
import { resolveEdges }                from "./resolve.js"
import { renderJson }                  from "./render-json.js"
import { renderClusterMd, renderIndexMd }     from "./render-md.js"
import { renderClusterHtml, renderIndexHtml } from "./render-html.js"
import type { ArchReportOpts, Language, Symbol } from "./types.js"

const safeFile = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_")

export interface ArchReportResult {
    outputDir:  string
    files:      string[]
    stats:      { clusters: number; symbols: number; docDebt: number }
}

export const renderArchReport = async (opts: ArchReportOpts): Promise<ArchReportResult> => {
    const queriesDir = opts.queriesDir
        ?? path.resolve(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report", "queries")
    const today = new Date().toISOString().slice(0, 10)
    const basename = resolveBasename(opts.pathOrGlob)
    const outputDir = path.resolve(opts.output || path.join("docs", "reports", `${basename}-${today}`))
    const tmpDir = `${outputDir}.tmp`
    await fs.rm(tmpDir,  { recursive: true, force: true })
    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(path.join(tmpDir, "_meta"), { recursive: true })

    const { files } = await discover(opts.pathOrGlob, opts.lang)
    const parser    = new Parser()
    const allSyms: { lang: Language; syms: Symbol[] }[] = []
    for (const lang of Object.keys(files) as Language[]) {
        const grammar = await parser.getGrammar(lang)
        const fileList = files[lang] ?? []
        for (const f of fileList) {
            const tree = await parser.parse(f, lang)
            const syms = await extractSymbols(tree, grammar, lang, f, queriesDir)
            allSyms.push({ lang, syms })
        }
    }

    const scopeRoot = path.resolve(resolveScopeRoot(opts.pathOrGlob))
    const byLang = new Map<Language, Symbol[]>()
    for (const { lang, syms } of allSyms) {
        const arr = byLang.get(lang) ?? []
        arr.push(...syms)
        byLang.set(lang, arr)
    }
    const clusters = [...byLang]
        .flatMap(([lang, syms]) => clusterize(syms, scopeRoot, lang))
        .sort((a, b) => a.name.localeCompare(b.name))

    const { edges, unresolved } = resolveEdges(clusters)
    const docDebt = clusters.flatMap((c) => c.symbols
        .filter((s) => s.doc === null)
        .map((s) => ({ fqn: s.fqn, file: s.file, line: s.line })))

    const api = renderJson({
        scope:     opts.pathOrGlob,
        languages: [...byLang.keys()].sort(),
        clusters,
        edges,
        docDebt,
        unresolved
    })

    const written: string[] = []
    await fs.writeFile(path.join(tmpDir, "_meta", "api.json"), JSON.stringify(api, null, 2))
    written.push(path.join(outputDir, "_meta", "api.json"))
    await fs.writeFile(path.join(tmpDir, "_meta", "unresolved.md"),
        unresolved.length === 0
            ? "_no unresolved external references_\n"
            : unresolved.map((u) => `- \`${u.ref}\` referenced from \`${u.from}\``).join("\n") + "\n")
    written.push(path.join(outputDir, "_meta", "unresolved.md"))

    const wantMd   = opts.format === "md"   || opts.format === "both"
    const wantHtml = opts.format === "html" || opts.format === "both"
    if (wantMd) {
        await fs.writeFile(path.join(tmpDir, "index.md"), renderIndexMd(api))
        written.push(path.join(outputDir, "index.md"))
        for (const c of clusters) {
            const file = `${safeFile(c.name)}.md`
            await fs.writeFile(path.join(tmpDir, file), renderClusterMd(c, api))
            written.push(path.join(outputDir, file))
        }
    }
    if (wantHtml) {
        await fs.writeFile(path.join(tmpDir, "index.html"), renderIndexHtml(api))
        written.push(path.join(outputDir, "index.html"))
        for (const c of clusters) {
            const file = `${safeFile(c.name)}.html`
            await fs.writeFile(path.join(tmpDir, file), renderClusterHtml(c, api))
            written.push(path.join(outputDir, file))
        }
    }
    await fs.rename(tmpDir, outputDir)
    return {
        outputDir,
        files: written,
        stats: {
            clusters: clusters.length,
            symbols:  clusters.reduce((n, c) => n + c.symbols.length, 0),
            docDebt:  docDebt.length
        }
    }
}

const resolveScopeRoot = (pathOrGlob: string): string => {
    const cut = pathOrGlob.search(/[*?[]/)
    const prefix = cut < 0 ? pathOrGlob : pathOrGlob.slice(0, cut)
    return prefix.replace(/\/+$/, "")
}

export default class ArchReportCommand {
    register(program: Command): void {
        program
            .command("arch-report")
            .description("generate a deterministic architecture report for a code scope")
            .argument("<path-or-glob>", "source scope")
            .option("--lang <lang>",     "language filter or 'auto'", "auto")
            .option("--output <dir>",    "output directory")
            .option("--format <fmt>",    "md | html | both", "both")
            .option("--config <file>",   "cluster overrides (YAML or JSON)")
            .action(async (pathOrGlob: string, flags: { lang: Language | "auto"; output?: string; format: "md" | "html" | "both"; config?: string }) => {
                const result = await renderArchReport({
                    pathOrGlob,
                    lang:   flags.lang,
                    output: flags.output ?? "",
                    format: flags.format,
                    config: flags.config
                })
                const indexFile = flags.format === "html"
                    ? path.join(result.outputDir, "index.html")
                    : path.join(result.outputDir, "index.md")
                process.stdout.write(`Report: ${indexFile}\n`)
            })
    }
}
```

- [ ] **Step 2: Wire the command into `tool/src/ase.ts`**

Open `tool/src/ase.ts` and add:

```typescript
import ArchReportCommand from "./ase-arch-report/index.js"
```

In the section that instantiates and registers commands (look for the existing `new DiagramCommand().register(program)` line and add a sibling call directly below it):

```typescript
new ArchReportCommand().register(program)
```

Match the exact whitespace and ordering style of the surrounding code (no semicolons, K&R braces, alphabetical ordering of command names — `arch-report` sorts before `config`).

- [ ] **Step 3: Run build, expect success**

```bash
cd tool && npm start build
```

Expected: lint clean, tsc clean.

- [ ] **Step 4: Smoke-test the CLI on the fixture**

```bash
node dst/ase.js arch-report test/ase-arch-report/fixtures/ts-mini/src --format=md
```

Expected: stdout `Report: <abs-path>/index.md`, output directory `docs/reports/src-<date>/` exists with `index.md`.

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-arch-report/index.ts tool/src/ase.ts
git commit -m "cli: wire ase arch-report subcommand + renderArchReport helper"
```

---

## Task 11: MCP Tool Registration

**Files:**
- Modify: `tool/src/ase-service.ts`

- [ ] **Step 1: Add MCP tool registration**

Open `tool/src/ase-service.ts`. Locate the `mcp.registerTool("diagram", ...)` block. Add a new sibling block immediately below it that registers `arch_report` and delegates to the same `renderArchReport` helper used by the CLI:

```typescript
mcp.registerTool("arch_report", {
    title:       "ASE arch report",
    description:
        "Generate a deterministic architecture report (Markdown and/or HTML) " +
        "for a code scope. Pass `pathOrGlob`, optional `lang`, `output`, " +
        "`format` ('md' | 'html' | 'both'), and `config`. " +
        "Returns the absolute output directory, the list of written files, " +
        "and basic stats. The report uses cluster boundaries derived from " +
        "the sub-directory tree at full path depth, surfaces every " +
        "inter-cluster reference, and lists symbols without doc comments " +
        "under a Documentation Debt section.",
    inputSchema: {
        pathOrGlob: z.string()
            .describe("source scope: directory or glob pattern"),
        lang: z.enum([
            "auto", "java", "typescript", "javascript", "python",
            "go", "rust", "kotlin", "csharp", "c", "cpp"
        ]).default("auto")
            .describe("language filter; 'auto' detects by file extension"),
        output: z.string().default("")
            .describe("output directory; empty string applies the default docs/reports/<basename>-<date>/"),
        format: z.enum([ "md", "html", "both" ]).default("both")
            .describe("which renderers to run"),
        config: z.string().optional()
            .describe("path to a YAML or JSON file with cluster overrides")
    }
}, async (args) => {
    try {
        const { renderArchReport } = await import("./ase-arch-report/index.js")
        const result = await renderArchReport({
            pathOrGlob: args.pathOrGlob,
            lang:       args.lang,
            output:     args.output,
            format:     args.format,
            config:     args.config
        })
        return {
            content: [ { type: "text", text: JSON.stringify(result, null, 2) } ]
        }
    }
    catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
            isError: true,
            content: [ { type: "text", text: `arch_report: FAILED: ${message}` } ]
        }
    }
})
```

Match the existing two-space-after-colon column alignment style. The dynamic `import("./ase-arch-report/index.js")` keeps service startup lean — tree-sitter grammars only load when the tool is actually invoked.

- [ ] **Step 2: Run build**

```bash
npm start build
```

Expected: lint + tsc clean.

- [ ] **Step 3: Restart the service to load the new tool**

```bash
ase service stop ; ase service start
```

- [ ] **Step 4: Smoke-test via MCP (manual)**

Inside Claude Code, invoke the MCP tool `arch_report` with `pathOrGlob=tool/src` and `format=md`. Verify the JSON return contains `outputDir`, `files[]`, `stats`.

- [ ] **Step 5: Commit**

```bash
git add tool/src/ase-service.ts
git commit -m "mcp: register arch_report tool delegating to renderArchReport"
```

---

## Task 12: Skill SKILL.md

**Files:**
- Create: `plugin/skills/ase-arch-report/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

```markdown
---
name: ase-arch-report
argument-hint: "<path-or-glob>"
description: Generate a deterministic architecture report (Markdown and/or HTML) for a code scope. Trigger when the user asks for an "architecture report", "arch report", "code structure overview", "public API listing", "Übersicht der Klassen", "Architektur-Report", invokes the slash command /ase-arch-report or /ase:arch-report, or references docs/reports/ as an output target.
user-invocable: true
disable-model-invocation: false
model: sonnet
effort: low
allowed-tools:
  - "Bash(ase arch-report:*)"
  - "Bash(ls:*)"
  - "Bash(realpath:*)"
---

# ase-arch-report

Generate a deterministic architecture report for a user-supplied code scope.
The report covers a cluster overview (sub-directory tree at full depth),
per-cluster classDiagrams plus method tables, inter-cluster reference edges,
and a documentation-debt section listing symbols without doc comments.

## Workflow

You *MUST* execute the following steps in order. *MUST NOT* skip the
`AskUserQuestion` step — the user always picks the output format
interactively.

### STEP 1 — Resolve the source scope

If the user provided a path or glob in the invocation, use it. Otherwise,
ask once:

> "Welcher Code-Bereich soll analysiert werden? (Pfad oder Glob)"

### STEP 2 — Ask for the output format

Use the `AskUserQuestion` tool exactly as follows:

`AskUserQuestion({
  questions: [{
    question: "Output-Format?",
    header:   "Format",
    multiSelect: false,
    options: [
      { label: "Markdown only", description: "Markdown-Dateien mit ASCII-Diagrammen" },
      { label: "HTML only",     description: "HTML mit Mermaid-SVG, B/W + Akzent #a01441" },
      { label: "Both",          description: "Beides parallel im selben Output-Verzeichnis" }
    ]
  }]
})`

Map the answer to the CLI flag: `Markdown only` → `--format=md`,
`HTML only` → `--format=html`, `Both` → `--format=both`.

### STEP 3 — Invoke the CLI

Run via the Bash tool:

`ase arch-report <path-or-glob> --format=<chosen>`

### STEP 4 — Report the output path

The last stdout line is `Report: <abs-path>/index.md` (or `.html` for
HTML-only). Repeat that line to the user verbatim as your final message,
without further commentary.
```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/ase-arch-report/SKILL.md
git commit -m "skill: ase-arch-report SKILL.md with interactive format choice"
```

---

## Task 13: Remaining Language Queries

For each of the nine remaining grammars (`java`, `javascript`, `python`,
`go`, `rust`, `kotlin`, `csharp`, `c`, `cpp`), write a minimal `.scm`
file that captures the same node families covered by `typescript.scm`:
type declarations (class / interface / record / struct / trait /
protocol where applicable) and their member methods or functions.

**Files:**
- Create: `plugin/skills/ase-arch-report/queries/java.scm`
- Create: `plugin/skills/ase-arch-report/queries/javascript.scm`
- Create: `plugin/skills/ase-arch-report/queries/python.scm`
- Create: `plugin/skills/ase-arch-report/queries/go.scm`
- Create: `plugin/skills/ase-arch-report/queries/rust.scm`
- Create: `plugin/skills/ase-arch-report/queries/kotlin.scm`
- Create: `plugin/skills/ase-arch-report/queries/csharp.scm`
- Create: `plugin/skills/ase-arch-report/queries/c.scm`
- Create: `plugin/skills/ase-arch-report/queries/cpp.scm`
- Create: `tool/test/ase-arch-report/fixtures/java-mini/Foo.java`

- [ ] **Step 1: Java query + fixture**

`plugin/skills/ase-arch-report/queries/java.scm`:

```scheme
(class_declaration
    name: (identifier) @class.name) @class.def

(interface_declaration
    name: (identifier) @interface.name) @interface.def

(record_declaration
    name: (identifier) @record.name) @record.def

(method_declaration
    name: (identifier) @method.name) @method.def
```

`tool/test/ase-arch-report/fixtures/java-mini/Foo.java`:

```java
package x;

/** A foo. */
public class Foo implements IFoo {
    /** Compute bar. */
    public int bar() { return 42; }
}
```

Add a `Foo extracts as expected` test in `extract.test.ts` mirroring the TypeScript test. Run and commit when green.

- [ ] **Step 2: JavaScript query**

```scheme
(class_declaration
    name: (identifier) @class.name) @class.def

(method_definition
    name: (property_identifier) @method.name) @method.def

(function_declaration
    name: (identifier) @function.name) @function.def
```

- [ ] **Step 3: Python query**

```scheme
(class_definition
    name: (identifier) @class.name) @class.def

(function_definition
    name: (identifier) @function.name) @function.def
```

- [ ] **Step 4: Go query**

```scheme
(type_spec
    name: (type_identifier) @type.name
    type: (struct_type)) @struct.def

(type_spec
    name: (type_identifier) @type.name
    type: (interface_type)) @interface.def

(method_declaration
    name: (field_identifier) @method.name) @method.def

(function_declaration
    name: (identifier) @function.name) @function.def
```

- [ ] **Step 5: Rust query**

```scheme
(struct_item
    name: (type_identifier) @struct.name) @struct.def

(trait_item
    name: (type_identifier) @trait.name) @trait.def

(impl_item
    type: (type_identifier) @impl.type) @impl.def

(function_item
    name: (identifier) @function.name) @function.def
```

- [ ] **Step 6: Kotlin query**

```scheme
(class_declaration
    (type_identifier) @class.name) @class.def

(function_declaration
    (simple_identifier) @function.name) @function.def
```

- [ ] **Step 7: C# query**

```scheme
(class_declaration
    name: (identifier) @class.name) @class.def

(interface_declaration
    name: (identifier) @interface.name) @interface.def

(record_declaration
    name: (identifier) @record.name) @record.def

(method_declaration
    name: (identifier) @method.name) @method.def
```

- [ ] **Step 8: C query**

```scheme
(struct_specifier
    name: (type_identifier) @struct.name) @struct.def

(function_definition
    declarator: (function_declarator
        declarator: (identifier) @function.name)) @function.def
```

- [ ] **Step 9: C++ query**

```scheme
(class_specifier
    name: (type_identifier) @class.name) @class.def

(struct_specifier
    name: (type_identifier) @struct.name) @struct.def

(function_definition
    declarator: (function_declarator
        declarator: (qualified_identifier) @function.name)) @function.def
```

- [ ] **Step 10: Commit each query in its own commit (one commit per language)**

```bash
git add plugin/skills/ase-arch-report/queries/<lang>.scm
git commit -m "queries: add <lang>.scm grammar query"
```

The grammars vary in node naming; if `extract.ts` cannot place members
under their parent type for a given language because the AST shape
differs, extend `extract.ts` with a per-language member-attachment hook
rather than burying language-specific logic in the query file.

---

## Task 14: Self-Test on ASE Sources

**Files:**
- Create: `tool/test/ase-arch-report/self-test.test.ts`

- [ ] **Step 1: Write the self-test**

```typescript
import { test } from "node:test"
import { strict as assert } from "node:assert"
import fs from "node:fs/promises"
import path from "node:path"
import { renderArchReport } from "../../src/ase-arch-report/index.js"

test("self-test: arch-report on tool/src produces a valid Markdown index", async () => {
    const out = path.join(import.meta.dirname, "..", "..", "..", ".self-test-output")
    await fs.rm(out, { recursive: true, force: true })
    const result = await renderArchReport({
        pathOrGlob: path.resolve(import.meta.dirname, "..", "..", "src"),
        lang:       "typescript",
        output:     out,
        format:     "both"
    })
    assert.ok(result.stats.symbols > 5, "should find at least 5 symbols in tool/src")
    const index = await fs.readFile(path.join(out, "index.md"), "utf8")
    assert.match(index, /^# Architecture Report/m)
    assert.match(index, /Per-cluster pages/)
    const api = JSON.parse(await fs.readFile(path.join(out, "_meta", "api.json"), "utf8"))
    assert.deepEqual(api.languages, ["typescript"])
    await fs.rm(out, { recursive: true, force: true })
})

test("self-test: two consecutive runs produce byte-identical api.json", async () => {
    const out = path.join(import.meta.dirname, "..", "..", "..", ".self-test-output-deterministic")
    await fs.rm(out, { recursive: true, force: true })
    const opts = {
        pathOrGlob: path.resolve(import.meta.dirname, "..", "..", "src"),
        lang:       "typescript" as const,
        output:     out,
        format:     "md" as const
    }
    await renderArchReport(opts)
    const a = await fs.readFile(path.join(out, "_meta", "api.json"), "utf8")
    await fs.rm(out, { recursive: true, force: true })
    await renderArchReport(opts)
    const b = await fs.readFile(path.join(out, "_meta", "api.json"), "utf8")
    /*  generatedAt differs across runs by design; normalize before compare  */
    const norm = (s: string): string => s.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt":"X"')
    assert.equal(norm(a), norm(b))
    await fs.rm(out, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run all tests**

```bash
cd tool && node --test --import tsx test/ase-arch-report/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add tool/test/ase-arch-report/self-test.test.ts
git commit -m "test: self-test arch-report on tool/src TypeScript sources"
```

---

## Task 15: CHANGELOG + Local Integration

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

At the top of `CHANGELOG.md`, add a new section above the previous version
(read the existing top entry first to match its style and bump pattern):

```markdown
## 0.0.27 (unreleased)

- NEW FEATURE: `ase-arch-report` skill plus `ase arch-report` CLI
  subcommand and `arch_report` MCP tool. Generates a deterministic
  architecture report (Markdown and/or HTML) for a user-supplied code
  scope. Language-agnostic via tree-sitter (Java, TypeScript,
  JavaScript, Python, Go, Rust, Kotlin, C#, C, C++). Clusters are
  derived from the sub-directory tree at full path depth; every
  inter-cluster reference is shown; symbols without doc comments are
  surfaced under a Documentation Debt section.
```

- [ ] **Step 2: Final build and full test run**

```bash
cd tool && npm start build && node --test --import tsx test/ase-arch-report/
```

Expected: build clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "changelog: add ase-arch-report entry under 0.0.27"
```

- [ ] **Step 4: Merge into `local-integration` for hands-on testing (do not push to fork, do not open a PR)**

```bash
git checkout local-integration
git merge --no-ff -m "Merge branch 'add-arch-report-skill' into local-integration" add-arch-report-skill
git checkout add-arch-report-skill
```

- [ ] **Step 5: Print final status to the user**

Tell the user:
- Branch `add-arch-report-skill` ready, merged into `local-integration` for testing
- Suggested smoke test: `ase arch-report tool/src --format=both`
- Output path printed by the tool as `Report: <abs-path>/index.md`

---

## Definition of Done

- All 15 tasks committed individually on `add-arch-report-skill`
- `npm start build` passes (lint + tsc, no warnings)
- `node --test --import tsx test/ase-arch-report/` passes all suites
- `ase arch-report tool/src --format=both` produces a non-empty
  `docs/reports/src-YYYY-MM-DD/` directory with `index.md`, `index.html`,
  per-cluster pages, `_meta/api.json`, and `_meta/unresolved.md`
- Final stdout line of every CLI invocation matches `^Report: .+/index\.(md|html)$`
- HTML output uses `#a01441` exactly once per emitted page (in the CSS
  token block) and renders Mermaid via the bundled themeVariables
- `local-integration` contains the merge of `add-arch-report-skill`
- Branch has not been pushed to `fork` and no PR has been opened
