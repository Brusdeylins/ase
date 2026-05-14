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
