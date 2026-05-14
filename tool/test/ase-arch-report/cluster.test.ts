import { test } from "node:test"
import { strict as assert } from "node:assert"
import { clusterize } from "../../src/ase-arch-report/cluster.js"
import type { ArchSymbol } from "../../src/ase-arch-report/types.js"

const mk = (file: string, name: string): ArchSymbol => ({
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
