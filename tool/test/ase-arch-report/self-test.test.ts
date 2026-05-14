import { test }            from "node:test"
import { strict as assert } from "node:assert"
import fs                   from "node:fs/promises"
import path                 from "node:path"
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
    const norm = (s: string): string => s.replace(/"generatedAt":\s*"[^"]+"/, "\"generatedAt\":\"X\"")
    assert.equal(norm(a), norm(b))
    await fs.rm(out, { recursive: true, force: true })
})
