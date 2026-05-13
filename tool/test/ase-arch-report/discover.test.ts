import { test }                          from "node:test"
import { strict as assert }               from "node:assert"
import path                               from "node:path"
import { discover, resolveBasename }      from "../../src/ase-arch-report/discover.js"

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
