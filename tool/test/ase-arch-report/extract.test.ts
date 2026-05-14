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

test("extract: class without a doc comment yields doc:null", async () => {
    const tmpFile = path.join(import.meta.dirname, "fixtures", "ts-nodoc", "Bare.ts")
    const parser  = new Parser(WASM_DIR)
    const tree    = await parser.parse(tmpFile, "typescript")
    const grammar = await parser.getGrammar("typescript")
    const symbols = await extractSymbols(tree, grammar, "typescript", tmpFile, QUERIES)
    const cls = symbols.find((s) => s.name === "Bare")
    assert.ok(cls !== undefined)
    assert.equal(cls!.doc, null)
})

test("extract: abstract class with public/protected/private methods captures modifiers and kind", async () => {
    const tmpFile = path.join(import.meta.dirname, "fixtures", "ts-abstract", "Service.ts")
    const parser  = new Parser(WASM_DIR)
    const tree    = await parser.parse(tmpFile, "typescript")
    const grammar = await parser.getGrammar("typescript")
    const symbols = await extractSymbols(tree, grammar, "typescript", tmpFile, QUERIES)
    const cls = symbols.find((s) => s.name === "Service")
    assert.ok(cls !== undefined, "abstract class must be captured")
    assert.equal(cls!.kind, "class")
    assert.ok(cls!.modifiers.includes("abstract"), `expected 'abstract' in ${cls!.modifiers}`)
    const run = cls!.members.find((m) => m.name === "run")
    assert.ok(run !== undefined && run.kind === "method", "run method missing")
})

test("extract: Java class with javadoc and method", async () => {
    const javaFix = path.join(import.meta.dirname, "fixtures", "java-mini", "Foo.java")
    const parser  = new Parser(WASM_DIR)
    const tree    = await parser.parse(javaFix, "java")
    const grammar = await parser.getGrammar("java")
    const symbols = await extractSymbols(tree, grammar, "java", javaFix, QUERIES)
    const cls = symbols.find((s) => s.name === "Foo")
    assert.ok(cls !== undefined, "Java class Foo must be captured")
    assert.equal(cls!.kind, "class")
    assert.equal(cls!.doc, "A foo.")
    const bar = cls!.members.find((m) => m.name === "bar")
    assert.ok(bar !== undefined, "method bar must be captured")
})

test("extract: multi-line Java method signature collapses to one line", async () => {
    const tmpDir = path.join(import.meta.dirname, "fixtures", "java-multiline")
    /*  static fixture — see file in same dir  */
    const file = path.join(tmpDir, "Svc.java")
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(file, "java")
    const grammar = await parser.getGrammar("java")
    const symbols = await extractSymbols(tree, grammar, "java", file, QUERIES)
    const cls = symbols.find((s) => s.name === "Svc")
    assert.ok(cls !== undefined)
    const m = cls!.members.find((mm) => mm.name === "accountSummary")
    assert.ok(m !== undefined, "accountSummary method missing")
    assert.doesNotMatch(m!.signature, /\n/, "signature must be single-line")
    assert.match(m!.signature, /accountSummary\(int reqId, String account, String tag\)/)
})

test("extract: Java method with multi-line Javadoc separated by blank line yields description", async () => {
    const file = path.join(import.meta.dirname, "fixtures", "java-docfind", "Book.java")
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(file, "java")
    const grammar = await parser.getGrammar("java")
    const symbols = await extractSymbols(tree, grammar, "java", file, QUERIES)
    const cls = symbols.find((s) => s.name === "Book")
    assert.ok(cls !== undefined)
    const clear = cls!.members.find((m) => m.name === "clear")
    assert.ok(clear !== undefined, "clear method missing")
    assert.equal(clear!.doc, "Clears all levels.")
})

test("extract: Java method WITHOUT a doc comment yields doc=null", async () => {
    const file = path.join(import.meta.dirname, "fixtures", "java-docfind", "Book.java")
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(file, "java")
    const grammar = await parser.getGrammar("java")
    const symbols = await extractSymbols(tree, grammar, "java", file, QUERIES)
    const cls = symbols.find((s) => s.name === "Book")
    const tostring = cls!.members.find((m) => m.name === "toString")
    /*  `toString` has @Override but no Javadoc — doc must stay null  */
    assert.equal(tostring!.doc, null)
})

test("extract: @Override-annotated method drops the annotation from signature", async () => {
    const tmpDir = path.join(import.meta.dirname, "fixtures", "java-multiline")
    const file = path.join(tmpDir, "Svc.java")
    const parser = new Parser(WASM_DIR)
    const tree = await parser.parse(file, "java")
    const grammar = await parser.getGrammar("java")
    const symbols = await extractSymbols(tree, grammar, "java", file, QUERIES)
    const cls = symbols.find((s) => s.name === "Svc")
    const m = cls!.members.find((mm) => mm.name === "clear")
    assert.ok(m !== undefined, "clear method missing")
    assert.doesNotMatch(m!.signature, /@Override/)
    assert.match(m!.signature, /^public void clear\(\)$/)
})
