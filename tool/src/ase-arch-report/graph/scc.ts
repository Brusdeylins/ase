/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Tarjan's strongly-connected-components algorithm — pure function
    over a directed graph given as a node-id list plus an edge list.
    Returns the SCCs sorted so a topological condensation of the
    SCC-DAG is implied by the *reverse* order of the returned array
    (Tarjan emits SCCs in reverse topological order of the condensed
    DAG).  Single-node SCCs without a self-loop are included, so the
    caller can scan for `.length >= 2` to identify cycle groups.  */

export interface DirectedEdge {
    from: string
    to:   string
}

export const tarjanSCC = (
    nodes: string[], edges: DirectedEdge[],
    onSkippedEdge?: (e: DirectedEdge) => void
): string[][] => {
    /*  build adjacency: out-neighbours per node.  Edges whose `from`
        or `to` is not in the supplied node-set are skipped (callers
        that intentionally pass a sub-set of the wider graph rely on
        this).  An optional `onSkippedEdge` callback surfaces those
        drops so callers that did NOT mean to skip can warn the
        user — without it, the skips are silent for backwards
        compatibility.  */
    const out = new Map<string, string[]>()
    for (const n of nodes)
        out.set(n, [])
    for (const e of edges) {
        const list = out.get(e.from)
        if (list !== undefined && out.has(e.to))
            list.push(e.to)
        else if (onSkippedEdge !== undefined)
            onSkippedEdge(e)
    }

    let nextIndex = 0
    const index   = new Map<string, number>()
    const lowlink = new Map<string, number>()
    const onStack = new Set<string>()
    const stack:  string[]   = []
    const result: string[][] = []

    /*  iterative DFS to avoid blowing the call stack on large graphs;
        each stack frame is `{ node, iter }` where `iter` is the index
        of the next out-neighbour to visit  */
    const strongConnect = (root: string): void => {
        const callStack: { node: string; iter: number }[] = [ { node: root, iter: 0 } ]
        index.set(root, nextIndex)
        lowlink.set(root, nextIndex)
        nextIndex++
        stack.push(root)
        onStack.add(root)
        while (callStack.length > 0) {
            const frame = callStack[callStack.length - 1]
            const neigh = out.get(frame.node) ?? []
            if (frame.iter < neigh.length) {
                const w = neigh[frame.iter]
                frame.iter++
                if (!index.has(w)) {
                    index.set(w, nextIndex)
                    lowlink.set(w, nextIndex)
                    nextIndex++
                    stack.push(w)
                    onStack.add(w)
                    callStack.push({ node: w, iter: 0 })
                }
                else if (onStack.has(w))
                    lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, index.get(w)!))
            }
            else {
                if (lowlink.get(frame.node) === index.get(frame.node)) {
                    const scc: string[] = []
                    let w: string
                    do {
                        w = stack.pop()!
                        onStack.delete(w)
                        scc.push(w)
                    } while (w !== frame.node)
                    result.push(scc)
                }
                callStack.pop()
                if (callStack.length > 0) {
                    const parent = callStack[callStack.length - 1]
                    lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(frame.node)!))
                }
            }
        }
    }

    for (const n of nodes)
        if (!index.has(n))
            strongConnect(n)

    return result
}
