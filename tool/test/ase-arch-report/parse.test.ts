/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import { test }       from "node:test"
import { strict as assert } from "node:assert"
import path           from "node:path"
import { Parser }     from "../../src/ase-arch-report/parse.js"

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
