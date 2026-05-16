/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Feedback Arc Set extraction via DFS back-edge detection.  Given a
    strongly-connected component (subgraph) we run a DFS and record
    every edge that points to an already-on-stack ancestor: those are
    the "back-edges" that close cycles.  Cutting all back-edges
    guarantees the remaining subgraph is a DAG, which is the property
    a Feedback Arc Set must satisfy.

    The set found this way is a valid FAS but not necessarily minimal
    (the minimum-FAS problem is NP-hard).  For the architect-report
    use case the goal is *actionable* output — "to break this cycle,
    cut these N edges" — and a DFS-derived set typically picks the
    edges that close the longest paths first, which is a reasonable
    natural ranking for review.  */

import type { DirectedEdge } from "./scc.js"

export const feedbackArcSet = (
    nodes: string[], edges: DirectedEdge[]
): DirectedEdge[] => {
    /*  build adjacency restricted to the supplied node set  */
    const nodeSet = new Set(nodes)
    const out = new Map<string, string[]>()
    for (const n of nodes)
        out.set(n, [])
    for (const e of edges)
        if (nodeSet.has(e.from) && nodeSet.has(e.to))
            out.get(e.from)!.push(e.to)

    const colour   = new Map<string, "white" | "grey" | "black">()
    const back: DirectedEdge[] = []
    for (const n of nodes)
        colour.set(n, "white")

    /*  iterative DFS — frame holds (node, iter) where iter is the
        next out-neighbour index to consider  */
    const dfs = (root: string): void => {
        const stack: { node: string; iter: number }[] = [ { node: root, iter: 0 } ]
        colour.set(root, "grey")
        while (stack.length > 0) {
            const frame = stack[stack.length - 1]
            const neigh = out.get(frame.node) ?? []
            if (frame.iter < neigh.length) {
                const w = neigh[frame.iter]
                frame.iter++
                const wc = colour.get(w)
                if (wc === "white") {
                    colour.set(w, "grey")
                    stack.push({ node: w, iter: 0 })
                }
                else if (wc === "grey") {
                    /*  edge to an ancestor on the current DFS path → back-edge  */
                    back.push({ from: frame.node, to: w })
                }
            }
            else {
                colour.set(frame.node, "black")
                stack.pop()
            }
        }
    }
    for (const n of nodes)
        if (colour.get(n) === "white")
            dfs(n)
    return back
}
