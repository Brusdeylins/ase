# tree-sitter grammar WASM files

Each `<lang>.wasm` here is loaded by `web-tree-sitter` at runtime to
parse source files of the corresponding language. They are binary
assets committed to the repo so users do not need a native toolchain
(no Emscripten, no `tree-sitter-cli`, no Docker).

## Provenance

| Grammar    | Version | Source |
|------------|---------|--------|
| typescript | 0.20.5  | `tree-sitter-wasms@0.1.13` npm package (`node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm`) |

## How to add a new grammar

The preferred path (used for the bundled `typescript.wasm` above) is the
`tree-sitter-wasms` npm package, which ships pre-built `.wasm` binaries
for many tree-sitter grammars:

```bash
cd tool
npm install --save-dev tree-sitter-wasms
cp node_modules/tree-sitter-wasms/out/tree-sitter-<lang>.wasm \
   ../plugin/skills/ase-arch-report/wasm/<lang>.wasm
```

If the grammar is not bundled by `tree-sitter-wasms`, build it locally
via the `tree-sitter` CLI (requires Emscripten or Docker):

```bash
cd tool
npm install --save-dev tree-sitter-cli tree-sitter-<lang>
cd node_modules/tree-sitter-<lang>
npx tree-sitter build --wasm -o \
    ../../../plugin/skills/ase-arch-report/wasm/<lang>.wasm
```

As a last resort, download a pre-built `.wasm` from the upstream
grammar's GitHub releases page and commit it directly.

Record the new grammar's version and source in the table above.
