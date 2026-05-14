import { test } from "node:test"
import { strict as assert } from "node:assert"
import { renderClusterMd, renderIndexMd } from "../../src/ase-arch-report/render-md.js"
import { mermaidSafeSignature } from "../../src/ase-arch-report/mermaid.js"
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

test("mermaidSafeSignature strips visibility, generics, and trailing semicolon", () => {
    assert.equal(mermaidSafeSignature("public ArrayList<String> foo();"), "ArrayList~String~ foo()")
    assert.equal(mermaidSafeSignature("private static final String x;"), "String x")
    assert.equal(mermaidSafeSignature("protected void run(Map<K,V> m);"), "void run(Map~K,V~ m)")
    assert.equal(mermaidSafeSignature("  bar(): number  "), "bar(): number")
})

test("renderClusterMd: classDiagram member lines have no visibility prefix or <>", () => {
    const api: ApiJson = {
        scope: "/x", generatedAt: "X", languages: [ "java" ],
        clusters: [{
            name: "i", language: "java",
            symbols: [{
                fqn: "Account", name: "Account", kind: "interface",
                modifiers: [ "public" ], extends: [], implements: [],
                file: "/x/i/Account.java", line: 1, doc: null,
                members: [{
                    name: "getBrokerPlugin", kind: "method",
                    signature: "public BrokerPlugin getBrokerPlugin();",
                    doc: null, line: 2
                }, {
                    name: "getAccountCurrencyCodes", kind: "method",
                    signature: "public ArrayList<String> getAccountCurrencyCodes();",
                    doc: null, line: 3
                }]
            }]
        }],
        edges: [], docDebt: [], unresolved: []
    }
    const md = renderClusterMd(api.clusters[0], api)
    /*  pick the lines between the opening { and closing } of the class block  */
    const block = md.match(/class Account \{([\s\S]+?)\}/)
    assert.ok(block !== null)
    /*  the only `<<...>>` we tolerate is the Mermaid stereotype marker;
        examine just the member signature lines  */
    const memberLines = block![1].split("\n").filter((l) => !l.includes("<<") && l.trim() !== "")
    const memberBlock = memberLines.join("\n")
    assert.doesNotMatch(memberBlock, /public /)
    assert.doesNotMatch(memberBlock, /;/)
    assert.doesNotMatch(memberBlock, /</)
    assert.doesNotMatch(memberBlock, />/)
    assert.match(memberBlock, /BrokerPlugin getBrokerPlugin\(\)/)
    assert.match(memberBlock, /ArrayList~String~ getAccountCurrencyCodes\(\)/)
})

test("renderClusterMd: per-class table keeps the raw signature", () => {
    const api: ApiJson = {
        scope: "/x", generatedAt: "X", languages: [ "java" ],
        clusters: [{
            name: "i", language: "java",
            symbols: [{
                fqn: "Account", name: "Account", kind: "interface",
                modifiers: [ "public" ], extends: [], implements: [],
                file: "/x/i/Account.java", line: 1, doc: null,
                members: [{
                    name: "getX", kind: "method",
                    signature: "public ArrayList<String> getX();",
                    doc: null, line: 2
                }]
            }]
        }],
        edges: [], docDebt: [], unresolved: []
    }
    const md = renderClusterMd(api.clusters[0], api)
    assert.match(md, /\| `getX` \| `public ArrayList<String> getX\(\);` \|/)
})
