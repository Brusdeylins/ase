import { test } from "node:test"
import { strict as assert } from "node:assert"
import { renderClusterHtml, renderIndexHtml } from "../../src/ase-arch-report/render-html.js"
import type { ApiJson } from "../../src/ase-arch-report/types.js"

const apiFixture: ApiJson = {
    scope:       "/x/src",
    generatedAt: "2026-05-13T12:00:00Z",
    languages:   ["typescript"],
    clusters: [{
        name: "a", language: "typescript",
        symbols: [{
            fqn: "Foo", name: "Foo", kind: "class", modifiers: ["public"],
            extends: [], implements: [], file: "/x/src/a/Foo.ts",
            line: 1, doc: "A foo.", members: []
        }]
    }],
    edges:      [],
    docDebt:    [],
    unresolved: []
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
