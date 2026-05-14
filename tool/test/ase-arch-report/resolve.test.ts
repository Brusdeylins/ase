import { test } from "node:test"
import { strict as assert } from "node:assert"
import { resolveEdges } from "../../src/ase-arch-report/resolve.js"
import type { Cluster, ArchSymbol } from "../../src/ase-arch-report/types.js"

const sym = (name: string, file: string, impls: string[] = []): ArchSymbol => ({
    fqn: name, name, kind: "class", modifiers: ["public"],
    extends: [], implements: impls, file,
    line: 1, doc: null, members: []
})

test("resolveEdges: same-cluster implements produces no inter-cluster edge", () => {
    const clusters: Cluster[] = [{
        name: "a", language: "typescript",
        symbols: [sym("Foo", "/x/a/Foo.ts", ["IFoo"]), sym("IFoo", "/x/a/IFoo.ts")]
    }]
    const { edges, unresolved } = resolveEdges(clusters)
    assert.equal(edges.length, 0)
    assert.equal(unresolved.length, 0)
})

test("resolveEdges: cross-cluster implements produces one edge", () => {
    const clusters: Cluster[] = [
        { name: "a", language: "typescript", symbols: [sym("Foo", "/x/a/Foo.ts", ["IFoo"])] },
        { name: "b", language: "typescript", symbols: [sym("IFoo", "/x/b/IFoo.ts")] }
    ]
    const { edges } = resolveEdges(clusters)
    assert.deepEqual(edges, [{ from: "a", to: "b", count: 1 }])
})

test("resolveEdges: external reference goes to unresolved", () => {
    const clusters: Cluster[] = [
        { name: "a", language: "typescript", symbols: [sym("Foo", "/x/a/Foo.ts", ["ExternalThing"])] }
    ]
    const { edges, unresolved } = resolveEdges(clusters)
    assert.equal(edges.length, 0)
    assert.deepEqual(unresolved, [{ ref: "ExternalThing", from: "a/Foo" }])
})
