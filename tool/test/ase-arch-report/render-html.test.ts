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

test("renderClusterHtml: wraps mermaid in pan/zoom frame", () => {
    const html = renderClusterHtml(apiFixture.clusters[0], apiFixture)
    assert.match(html, /<div class="diagram-frame">/)
    assert.match(html, /class="diagram-hint"/)
    assert.match(html, /panzoom/)
})

test("renderIndexHtml: cluster flowchart sits inside diagram-frame", () => {
    const html = renderIndexHtml(apiFixture)
    assert.match(html, /<div class="diagram-frame">[\s\S]*flowchart LR/)
})

test("renderClusterHtml: bootstrap raises mermaid maxTextSize and maxEdges", () => {
    const html = renderClusterHtml(apiFixture.clusters[0], apiFixture)
    assert.match(html, /maxTextSize:\s*\d{6,}/)
    assert.match(html, /maxEdges:\s*\d{4,}/)
})

test("renderClusterHtml: loads panzoom UMD before module script, registers non-passive wheel listener", () => {
    const html = renderClusterHtml(apiFixture.clusters[0], apiFixture)
    /*  UMD script tag exists  */
    assert.match(html, /<script src="https:\/\/unpkg\.com\/panzoom@9\.4\.3\/dist\/panzoom\.min\.js"><\/script>/)
    /*  UMD <script> precedes the module <script>  */
    const umdIdx = html.indexOf("panzoom.min.js")
    const modIdx = html.indexOf("type=\"module\"")
    assert.ok(umdIdx > 0 && modIdx > umdIdx, "UMD must come before the module script")
    /*  module uses window.panzoom and non-passive wheel listener  */
    assert.match(html, /window\.panzoom/)
    assert.match(html, /\{\s*passive:\s*false\s*\}/)
})
