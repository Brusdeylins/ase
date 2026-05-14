/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

import { test }              from "node:test"
import { strict as assert } from "node:assert"
import path                 from "node:path"
import { Parser }           from "../../src/ase-arch-report/parse.js"
import { extractSymbols }   from "../../src/ase-arch-report/extract.js"

const FIX_DIR  = path.join(import.meta.dirname, "fixtures", "ts-mini", "src")
const PLUGIN   = path.join(import.meta.dirname, "..", "..", "..", "plugin", "skills", "ase-arch-report")
const QUERIES  = path.join(PLUGIN, "queries")
const WASM_DIR = path.join(PLUGIN, "wasm")

test("extract: pulls exported class with doc comment and one method", async () => {
    const parser  = new Parser(WASM_DIR)
    const tree    = await parser.parse(path.join(FIX_DIR, "Foo.ts"), "typescript")
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
    const parser  = new Parser(WASM_DIR)
    const tree    = await parser.parse(path.join(FIX_DIR, "IFoo.ts"), "typescript")
    const grammar = await parser.getGrammar("typescript")
    const symbols = await extractSymbols(tree, grammar, "typescript", path.join(FIX_DIR, "IFoo.ts"), QUERIES)
    const iface = symbols.find((s) => s.name === "IFoo")
    assert.ok(iface !== undefined)
    assert.equal(iface!.kind, "interface")
    assert.equal(iface!.members.length, 1)
    assert.equal(iface!.members[0].name, "bar")
})
