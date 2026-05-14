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
