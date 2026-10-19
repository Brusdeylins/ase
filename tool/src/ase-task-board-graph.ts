/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api.js"

import { toneOf, byCreation, cardLabel, groupLabel, clampLines, glueId, glueTitle, glueGroup } from "./ase-task-board-core.js"
import type { Board, Badge }                                                                     from "./ase-task-board-core.js"

/*  a laid out node box (or group container box, with the group name as its id),
    a laid out (optionally dashed) edge, and the whole layout  */
export type GraphBox    = { id: string, x: number, y: number, w: number, h: number }
export type GraphPoint  = { x: number, y: number }
export type GraphEdge   = { from: string, to: string, points: GraphPoint[], dashed?: boolean }
export type GraphLayout = { width: number, height: number, nodes: Map<string, GraphBox>, groups: GraphBox[], edges: GraphEdge[] }

/*  a node to be laid out (with its size and the group it is nested into, if any)
    and an edge to be laid out (between the ids of two nodes)  */
export type LayoutNode  = { id: string, w: number, h: number, group?: string }
export type LayoutEdge  = { from: string, to: string, dashed?: boolean }

/*  the spacing between the ports of a node with a port per edge (see "layoutBoxes" with rows)  */
export const portSpacing = { cell: 2, px: 14 }

/*  the unit systems a layout is computed in: terminal character cells
    (width in columns, height in rows) or browser pixels, with the height of
    a single-line node, the height of each additional label line, (in
    pixel units) the estimated characters per label line of the fixed-width node,
    and the padding and the minimum width (by its name) of a group container;
    in pixel units, a single-line node is its card with a border of 1px, a padding of
    24px in total (with room for the badges on its top border), and a line of 20.8px  */
export const units = {
    cell: { w: (label: string) => label.length + 4, h: 3,  line: 1,    chars: 0,  nodeNode: 1,  layers: 8,  edgeEdge: 1,  edgeNode: 1,  pad: "[top=2,left=2,bottom=1,right=2]",     gw: (name: string) => name.length + 4 },
    px:   { w: () => 260,                            h: 47, line: 20.8, chars: 32, nodeNode: 18, layers: 64, edgeEdge: 10, edgeNode: 14, pad: "[top=30,left=14,bottom=14,right=14]", gw: (name: string) => Math.ceil(name.length * 7.5) + 28 }
}

/*  the id prefix of the compound node of a group (task ids never contain a colon)  */
const GROUP = "group:"

/*  the label lines of a node (in cell units only) of a given box width: the
    task id (behind "≡", and of an epic also behind "♛") and title, cut onto a
    single line, or with titles shown, wrapped onto at most three lines, with a
    placeholder column glued in front of the task id to reserve the extra column
    of its inverse rendering (plus two for the "≡", and two more for the "♛" of
    an epic), and the arrow in front of the title replaced by a placeholder
    column glued to the title  */
export const nodeLines = (board: Board, id: string, titles: boolean, width: number): string[] => {
    const card = board.cards.get(id)!
    const pre  = glueGroup.repeat(groupLabel(card) === id ? 4 : 2)
    return clampLines(glueId + pre + cardLabel(card).replace(`${id} ▶ `, `${id} ${glueTitle}`), width - 4, titles ? 3 : 1)
}

/*  lay out nodes with ELK Layered: left to right, orthogonal edge routing, every
    edge leaving its source on the east side and entering its target on the west side
    (at the first label line of a node), and the nodes of each group nested into a
    compound node of the group (in the order of their first node, padded for its border
    and label, and at least as wide as its label, and laid out across the hierarchy,
    in root coordinates), or, with given rows of the top-level nodes and groups (by their
    ids resp. names), top to bottom in these rows, with the top-level nodes of a row
    in their given order, and every edge leaving its source on its bottom side and entering
    its target on its top side at a port of its own (distributed along the side, so that
    no edges overlap, where a node is widened for its ports if needed); "elkjs" is loaded
    on demand only, as it is large and needed by the graph views alone  */
export const layoutBoxes = async (unit: "cell" | "px", list: LayoutNode[], labels: Map<string, string>,
    links: LayoutEdge[], rows?: Map<string, number>): Promise<GraphLayout> => {
    const u    = units[unit]
    const port = { width: 0, height: 0 }
    const options = {
        "elk.algorithm":                                    "layered",
        "elk.direction":                                    rows !== undefined ? "DOWN" : "RIGHT",
        "elk.edgeRouting":                                  "ORTHOGONAL",
        "elk.spacing.nodeNode":                             String(u.nodeNode),
        "elk.spacing.edgeEdge":                             String(u.edgeEdge),
        "elk.spacing.edgeNode":                             String(u.edgeNode),
        "elk.spacing.componentComponent":                   String(u.nodeNode),
        "elk.spacing.portPort":                             String(portSpacing[unit]),
        "elk.layered.spacing.nodeNodeBetweenLayers":        String(rows !== undefined && unit === "cell" ? u.layers / 4 : u.layers),
        "elk.layered.spacing.edgeNodeBetweenLayers":        String(rows !== undefined && unit === "cell" ? 3 : u.edgeNode),
        "elk.layered.spacing.edgeEdgeBetweenLayers":        String(u.edgeEdge),
        "elk.layered.mergeEdges":                           "false",
        "elk.layered.considerModelOrder.components":        "MODEL_ORDER",
        "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
        "elk.layered.nodePlacement.strategy":               "NETWORK_SIMPLEX"
    }

    /*  the rows are partitions of the top-level nodes only (as the nodes nested into
        a group carry no partition, which would else fail the layout of the group)  */
    const partitioning: Record<string, string> = rows === undefined ? {} : {
        "elk.partitioning.activate":                        "true",
        "elk.layered.considerModelOrder.strategy":          "NODES_AND_EDGES",
        "elk.layered.crossingMinimization.forceNodeModelOrder": "true"
    }
    const row = (id: string): Record<string, string> =>
        rows?.has(id) === true ? { "elk.partitioning.partition": String(rows.get(id)) } : {}
    const edgeId = (e: LayoutEdge) => `${e.from}->${e.to}`
    const node = (n: LayoutNode): ElkNode => {
        /*  with rows, a port of its own per edge on the bottom (outgoing) resp. top (incoming) side  */
        if (rows !== undefined)
            return {
                id: n.id, width: n.w, height: n.h,
                layoutOptions: {
                    "elk.portConstraints":      "FIXED_SIDE",
                    "elk.nodeSize.constraints": "PORTS MINIMUM_SIZE",
                    "elk.nodeSize.minimum":     `(${n.w}, ${n.h})`,
                    ...row(n.id)
                },
                ports: [
                    ...links.filter((e) => e.from === n.id).map((e) =>
                        ({ id: `${edgeId(e)}:src`, ...port, layoutOptions: { "elk.port.side": "SOUTH" } })),
                    ...links.filter((e) => e.to === n.id).map((e) =>
                        ({ id: `${edgeId(e)}:dst`, ...port, layoutOptions: { "elk.port.side": "NORTH" } }))
                ]
            }

        /*  else the ports stay at the first label line (the middle of a single-line node)  */
        const y = Math.floor(u.h / 2)
        return {
            id: n.id, width: n.w, height: n.h,
            layoutOptions: { "elk.portConstraints": "FIXED_POS" },
            ports: [
                { id: `${n.id}:in`,  x: 0,   y, ...port },
                { id: `${n.id}:out`, x: n.w, y, ...port }
            ]
        }
    }
    const children = [] as ElkNode[]
    const members  = new Map<string, ElkNode[]>()
    for (const n of list) {
        const group = n.group ?? ""
        if (group === "") {
            children.push(node(n))
            continue
        }
        if (!members.has(group)) {
            members.set(group, [])
            children.push({
                id: GROUP + group,
                layoutOptions: {
                    ...options,
                    ...row(group),

                    /*  with rows, the arrow heads of the edges entering the nodes of a group
                        need a line of their own below its label in cell units  */
                    "elk.padding":              rows !== undefined && unit === "cell" ? u.pad.replace("top=2", "top=3") : u.pad,
                    "elk.nodeSize.constraints": "MINIMUM_SIZE",
                    "elk.nodeSize.minimum":     `(${u.gw(labels.get(group) ?? group)}, ${u.h})`
                },
                children: members.get(group)
            })
        }
        members.get(group)!.push(node(n))
    }
    const graph: ElkNode = {
        id: "root",
        layoutOptions: {
            ...options,
            ...partitioning,
            "elk.padding":           "[top=0,left=0,bottom=0,right=0]",
            "elk.hierarchyHandling": "INCLUDE_CHILDREN",
            "elk.json.shapeCoords":  "ROOT",
            "elk.json.edgeCoords":   "ROOT"
        },
        children,
        edges: links.map((e): ElkExtendedEdge => rows !== undefined ?
            { id: edgeId(e), sources: [ `${edgeId(e)}:src` ], targets: [ `${edgeId(e)}:dst` ] } :
            { id: edgeId(e), sources: [ `${e.from}:out` ],    targets: [ `${e.to}:in` ] })
    }
    const dashed = new Set(links.filter((e) => e.dashed === true).map(edgeId))
    const ELK    = (await import("elkjs/lib/elk.bundled.js")).default.default
    const res    = await new ELK().layout(graph)
    const round  = (v: number | undefined) => Math.round(v ?? 0)
    const box    = (n: ElkNode, id: string) => ({ id, x: round(n.x), y: round(n.y), w: round(n.width), h: round(n.height) })
    const nodes  = new Map<string, GraphBox>()
    const groups = [] as GraphBox[]
    for (const n of res.children ?? []) {
        if (n.id.startsWith(GROUP)) {
            groups.push(box(n, n.id.slice(GROUP.length)))
            for (const m of n.children ?? [])
                nodes.set(m.id, box(m, m.id))
        }
        else
            nodes.set(n.id, box(n, n.id))
    }

    /*  the edges may have been moved into the compound nodes of the groups  */
    const edges = [ ...(res.edges ?? []), ...(res.children ?? []).flatMap((n) => n.edges ?? []) ].map((e) => {
        const [ from, to ] = e.id.split("->")
        const points = (e.sections ?? []).flatMap((s) =>
            [ s.startPoint, ...(s.bendPoints ?? []), s.endPoint ].map((p) => ({ x: round(p.x), y: round(p.y) })))
        return dashed.has(e.id) ? { from, to, points, dashed: true } : { from, to, points }
    })
    return { width: round(res.width), height: round(res.height), nodes, groups, edges }
}

/*  lay out the dependency graph of the tasks, with the tasks of each group nested into its
    container; in cell units, all nodes have the same given width and can optionally
    be enlarged to wrap the task titles onto more lines  */
export const layoutGraph = async (board: Board, unit: "cell" | "px", titles = false, width = 40): Promise<GraphLayout> => {
    const u      = units[unit]
    const linked = (id: string) => (board.pred.get(id) ?? []).length + (board.succ.get(id) ?? []).length > 0 ? 0 : 1
    const ids    = [ ...board.cards.values() ].sort((a, b) => linked(a.id) - linked(b.id) || byCreation(a, b)).map((c) => c.id)
    const labels = new Map<string, string>()
    const nodes  = ids.map((id): LayoutNode => {
        /*  in cell units, a node holds its label lines, in pixel units its
            estimated label lines (as wrapped by the browser within the card),
            with two placeholder columns for the "≡" in front of the task id (and
            two more for the "♛" of an epic), where the arrow in front of the title
            stands for the padding and margin of the task id sub-box  */
        const card  = board.cards.get(id)!
        const lines = unit === "cell" ? nodeLines(board, id, titles, width) :
            clampLines(glueGroup.repeat(groupLabel(card) === id ? 4 : 2) + cardLabel(card), u.chars, titles ? 3 : 1)
        const group = groupLabel(card)
        if (group !== "")
            labels.set(group, `♛ ${group} ▶`)
        return { id, w: unit === "cell" ? width : u.w(id), h: Math.round(u.h + (lines.length - 1) * u.line), group }
    })
    const edges  = ids.flatMap((id) => (board.pred.get(id) ?? []).map((p): LayoutEdge => ({ from: p, to: id })))
    return layoutBoxes(unit, nodes, labels, edges)
}

/*  the box drawing character of a set of line directions  */
const UP    = 1
const DOWN  = 2
const LEFT  = 4
const RIGHT = 8
const junction: Record<number, string> = {
    [LEFT]: "─", [RIGHT]: "─", [LEFT | RIGHT]: "─", [UP]: "│", [DOWN]: "│", [UP | DOWN]: "│",
    [DOWN | RIGHT]: "┌", [DOWN | LEFT]: "┐", [UP | RIGHT]: "└", [UP | LEFT]: "┘",
    [UP | DOWN | RIGHT]: "├", [UP | DOWN | LEFT]: "┤", [LEFT | RIGHT | DOWN]: "┬",
    [LEFT | RIGHT | UP]: "┴", [UP | DOWN | LEFT | RIGHT]: "┼"
}

/*  the heavy box drawing characters of the marked edges (touching the selected node)  */
const heavy: Record<string, string> = {
    "─": "━", "│": "┃", "┌": "┏", "┐": "┓", "└": "┗", "┘": "┛", "├": "┣", "┤": "┫",
    "┬": "┳", "┴": "┻", "┼": "╋", "╌": "╍", "╎": "╏"
}

/*  a character grid for drawing a cell-unit layout: per cell its character
    and its tone (for coloring), plus the line directions of the edges and
    whether a cell is crossed by dashed edges only  */
export type TextGrid = { W: number, H: number, chars: string[][], tones: string[][], mask: number[][], dash: number[][] }
export const textGrid = (layout: GraphLayout): TextGrid => {
    const W = layout.width + 2
    const H = layout.height + 1
    const grid = (fill: number) => Array.from({ length: H }, () => new Array<number>(W).fill(fill))
    return {
        W, H,
        chars: Array.from({ length: H }, () => new Array<string>(W).fill(" ")),
        tones: Array.from({ length: H }, () => new Array<string>(W).fill("")),
        mask:  grid(0),
        dash:  grid(0)
    }
}

/*  draw the dashed group containers (to be crossed by the edges), with
    the label of each on its first inner line at the left (cut with an ellipsis)  */
export const drawContainers = (g: TextGrid, groups: GraphBox[], label: (id: string) => string): void => {
    const { W, H, chars, tones } = g
    for (const c of groups)
        for (let y = c.y; y < c.y + c.h && y < H; y++)
            for (let x = c.x; x < c.x + c.w && x < W; x++) {
                const top = y === c.y
                const bot = y === c.y + c.h - 1
                const lft = x === c.x
                const rgt = x === c.x + c.w - 1
                if (!(top || bot || lft || rgt))
                    continue
                chars[y][x] = top ? (lft ? "╭" : rgt ? "╮" : "╌") :
                    bot ? (lft ? "╰" : rgt ? "╯" : "╌") : "╎"
                tones[y][x] = "group-frame"
            }
    drawContainerLabels(g, groups, label)
}

/*  draw the labels of the group containers (again on top of the edges crossing them)  */
export const drawContainerLabels = (g: TextGrid, groups: GraphBox[], label: (id: string) => string): void => {
    const { W, H, chars, tones } = g
    for (const c of groups) {
        const room = Math.max(0, c.w - 4)
        const full = label(c.id)
        const name = full.length > room ? full.slice(0, Math.max(0, room - 1)) + "…" : full
        for (let i = 0; i < name.length && c.y + 1 < H && c.x + 2 + i < W; i++) {
            chars[c.y + 1][c.x + 2 + i] = name[i]
            tones[c.y + 1][c.x + 2 + i] = "group-title"
        }
    }
}

/*  draw the lines of all edges, where edges of the selected node are marked (and heavy), and the
    straight parts of the cells crossed by dashed edges only are dashed, plus the arrow heads
    in front of the side of each target the edge enters, and optionally with hops, i.e., where
    exactly two edges cross straight, only one of them is drawn, so the other one passes under
    it (the vertical one on top, unless only the horizontal one is marked)  */
export const drawEdges = (g: TextGrid, edges: GraphEdge[], selected: string, hops = false): void => {
    const { W, H, chars, tones, mask, dash } = g
    type Pass = { bits: number, dashed: boolean, sel: boolean }
    const passes = new Map<number, Pass[]>()
    for (const e of edges) {
        const sel  = e.from === selected || e.to === selected
        const tone = sel ? "edge-sel" : "edge"
        const own  = new Map<number, number>()
        const set  = (x: number, y: number, bits: number) => {
            if (y < 0 || y >= H || x < 0 || x >= W)
                return
            mask[y][x] |= bits
            own.set(y * W + x, (own.get(y * W + x) ?? 0) | bits)
            dash[y][x] = e.dashed === true ? dash[y][x] | 1 : dash[y][x] | 2
            if (tones[y][x] !== "edge-sel")
                tones[y][x] = tone
        }
        for (let i = 1; i < e.points.length; i++) {
            const a = e.points[i - 1]
            const b = e.points[i]
            if (a.y === b.y) {
                const [ x0, x1 ] = a.x < b.x ? [ a.x, b.x ] : [ b.x, a.x ]
                for (let x = x0; x <= x1; x++)
                    set(x, a.y, (x > x0 ? LEFT : 0) | (x < x1 ? RIGHT : 0))
            }
            else {
                const [ y0, y1 ] = a.y < b.y ? [ a.y, b.y ] : [ b.y, a.y ]
                for (let y = y0; y <= y1; y++)
                    set(a.x, y, (y > y0 ? UP : 0) | (y < y1 ? DOWN : 0))
            }
        }
        for (const [ cell, bits ] of own) {
            if (!passes.has(cell))
                passes.set(cell, [])
            passes.get(cell)!.push({ bits, dashed: e.dashed === true, sel })
        }
    }
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
            if (mask[y][x] !== 0) {
                /*  a hop: a straight horizontal and a straight vertical pass of two edges  */
                const list = passes.get(y * W + x) ?? []
                const hor  = list.find((p) => p.bits === (LEFT | RIGHT))
                const ver  = list.find((p) => p.bits === (UP | DOWN))
                if (hops && list.length === 2 && hor !== undefined && ver !== undefined) {
                    const top = hor.sel && !ver.sel ? hor : ver
                    const c   = top === hor ? (top.dashed ? "╌" : "─") : (top.dashed ? "╎" : "│")
                    chars[y][x] = top.sel ? heavy[c] : c
                    tones[y][x] = top.sel ? "edge-sel" : "edge"
                    continue
                }
                const j = junction[mask[y][x]] ?? "┼"
                const c = dash[y][x] !== 1 ? j : j === "─" ? "╌" : j === "│" ? "╎" : j
                chars[y][x] = tones[y][x] === "edge-sel" ? heavy[c] ?? c : c
            }
    for (const e of edges) {
        const end  = e.points[e.points.length - 1]
        const prev = e.points[e.points.length - 2]
        if (end === undefined || prev === undefined)
            continue
        const [ x, y, head ] = prev.y < end.y ? [ end.x, end.y - 1, "▼" ] : prev.y > end.y ? [ end.x, end.y, "▲" ] :
            prev.x > end.x ? [ end.x, end.y, "◄" ] : [ end.x - 1, end.y, "►" ]
        if (x >= 0 && x < W && y >= 0 && y < H)
            chars[y][x] = head
    }
}

/*  draw a node box (solid, dashed, or heavy) in a tone, with the tone suffix "-frame" on its border  */
export const drawBox = (g: TextGrid, n: GraphBox, tone: string, dashed = false, bold = false): void => {
    const { W, H, chars, tones } = g
    const hor = bold ? "━" : dashed ? "╌" : "─"
    const ver = bold ? "┃" : dashed ? "╎" : "│"
    const [ tl, tr, bl, br ] = bold ? [ "┏", "┓", "┗", "┛" ] : [ "┌", "┐", "└", "┘" ]
    for (let y = n.y; y < n.y + n.h && y < H; y++)
        for (let x = n.x; x < n.x + n.w && x < W; x++) {
            const top = y === n.y
            const bot = y === n.y + n.h - 1
            const lft = x === n.x
            const rgt = x === n.x + n.w - 1
            chars[y][x] = top ? (lft ? tl : rgt ? tr : hor) :
                bot ? (lft ? bl : rgt ? br : hor) : (lft || rgt ? ver : " ")
            tones[y][x] = top || bot || lft || rgt ? `${tone}-frame` : tone
        }
}

/*  draw a cell-unit layout of the tasks onto a character grid, returning per cell the
    character and a tone for coloring: the node tones "done", "active",
    "idle", and "sel" (selected node) with a "-frame" suffix on the box border,
    an "-id" suffix on the task id, a "-title" suffix on the rest of the label, and
    "edge" or "edge-sel" (an edge touching the selected node), "group-frame" and
    "group-title" on the group containers, with a given pulse
    glyph (if any) in the top border of the active nodes and the given badges
    (if any) on the left part of the top border of the nodes (like in the lane view)  */
export const drawGraphText = (board: Board, layout: GraphLayout, selected: string, titles = false, pulse = "",
    badges = new Map<string, Badge[]>()) => {
    const g = textGrid(layout)
    const { W, H, chars, tones } = g

    /*  dashed group containers at the bottom (crossed by the edges), with the
        group name between "♛" and "▶", and the edges above them  */
    drawContainers(g, layout.groups, (id) => `♛ ${id} ▶`)
    drawEdges(g, layout.edges, selected)

    /*  node boxes on top, where a context node (of a filtered graph) is dimmed and dashed  */
    for (const n of layout.nodes.values()) {
        const ctx   = board.context.has(n.id)
        const base  = ctx ? "done" : toneOf(board, board.cards.get(n.id)!)
        const tone  = n.id === selected ? "sel" : base
        drawBox(g, n, tone, ctx)
        if (pulse !== "" && base === "active")
            chars[n.y][n.x + n.w - 3] = pulse

        /*  the badges as inverse " <icon> <name> " boxes (separated by a border character)
            in signal color when selected, in accent color when active, and else in normal
            color, behind one border character and cut before the pulse (with an ellipsis)  */
        const list = badges.get(n.id) ?? []
        if (list.length > 0 && n.w > 10) {
            const room = n.w - 7
            const tint = tone === "sel" ? "sel" : base === "active" ? "active" : "idle"
            let x = n.x + 2
            for (const [ k, badge ] of list.entries()) {
                if (k > 0)
                    x++
                const used = x - n.x - 2
                if (used >= room)
                    break
                const full = ` ${badge.icon} ${badge.name} `
                const text = used + full.length > room ? full.slice(0, room - used - 1) + "…" : full
                for (let i = 0; i < text.length && x < W; i++, x++) {
                    chars[n.y][x] = text[i]
                    tones[n.y][x] = `${tint}-id`
                }
                if (text !== full)
                    break
            }
        }

        /*  the label lines, with the task id at the start of the first line
            (behind the placeholder and "≡" and, for an epic, also behind "♛",
            and with one column of spacing on each side of it), where the part of a task id
            too long for the first line is hard-wrapped onto the following lines  */
        const pre   = groupLabel(board.cards.get(n.id)!) === n.id ? 4 : 2
        const lines = nodeLines(board, n.id, titles, n.w)
        let   spill = Math.max(0, pre + 1 + n.id.length - (lines[0]?.length ?? 0))
        lines.forEach((line, k) => {
            const row = n.y + 1 + k
            if (row >= n.y + n.h - 1 || row >= H)
                return
            const cont = k === 0 ? 0 : Math.min(spill, line.length)
            spill -= cont
            for (let i = 0; i < line.length && n.x + 2 + i < W; i++) {
                chars[row][n.x + 2 + i] = k === 0 && pre > 2 && i === 1 ? "♛" : k === 0 && i === pre - 1 ? "≡" :
                    (k === 0 && i <= pre) || line[i] === glueTitle ? " " : line[i]
                tones[row][n.x + 2 + i] = (k === 0 && i <= pre + n.id.length + 1) || (cont > 0 && i <= cont) ? `${tone}-id` : `${tone}-title`
            }
            if (k === 0 && n.x + 3 + pre + n.id.length < Math.min(W, n.x + n.w - 1))
                tones[row][n.x + 3 + pre + n.id.length] = `${tone}-id`
            else if (cont > 0 && spill === 0 && n.x + 2 + cont < Math.min(W, n.x + n.w - 1))
                tones[row][n.x + 2 + cont] = `${tone}-id`
        })
    }
    return { lines: chars.map((r) => r.join("")), tones }
}

/*  the box of a graph node on the screen (center row/column and borders)  */
export type Place = { r: number, c: number, top: number, bottom: number, bl: number, br: number }

/*  find the nearest graph node in the direction of an arrow, as the nodes are placed
    on the screen, preferring nodes in the same row (left/right) or column (up/down)  */
export const nearestPlace = (places: Map<string, Place>, from: string, dir: "left" | "right" | "up" | "down"): string | undefined => {
    const cur = places.get(from)
    if (cur === undefined)
        return undefined
    let best = Infinity
    let next: string | undefined
    for (const [ id, p ] of places) {
        const dr = p.r - cur.r
        const dc = p.c - cur.c
        const ok = dir === "right" ? dc > 0 : dir === "left" ? dc < 0 : dir === "down" ? dr > 0 : dr < 0
        if (id === from || !ok)
            continue
        const score = dir === "left" || dir === "right" ?
            Math.abs(dc) + Math.abs(dr) * 4 : Math.abs(dr) + Math.abs(dc) / 4
        if (score < best) {
            best = score
            next = id
        }
    }
    return next
}

/*  escape a text for embedding into SVG  */
export const escapeXML = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/*  start the SVG drawing of a pixel-unit layout (with its arrow markers "<name>-arrow" and
    "<name>-arrow-sel", the second one for the marked edges of the selected node, as a marker
    does not inherit the stroke color of its edge, and both named uniquely per drawing, as the
    page holds several drawings and a marker of a hidden one does not render), with every group a
    dashed "g.cluster" container with its label in the top-left corner, and every edge a
    "path.edge" carrying its "data-from" and "data-to" (plus the class "dashed" for a dashed one),
    optionally with hops, i.e., where a horizontal part of an edge crosses a vertical part of
    another edge, it hops over it in a small half circle  */
export const drawSVGFrame = (name: string, layout: GraphLayout, label: (id: string) => string, hops = false): string[] => {
    const out = [ `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" ` +
        `height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    "<defs>" + [ "arrow", "arrow-sel" ].map((id) =>
        `<marker id="${name}-${id}" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" ` +
        `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="${id}"/></marker>`).join("") + "</defs>" ]
    for (const g of layout.groups)
        out.push(`<g class="cluster"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6"/>` +
            `<text x="${g.x + 12}" y="${g.y + 20}">${escapeXML(label(g.id))}</text></g>`)
    const R     = 5
    const verts = layout.edges.flatMap((e, k) => e.points.slice(1).flatMap((b, i) => {
        const a = e.points[i]
        return a.x === b.x && a.y !== b.y ? [ { k, x: a.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) } ] : []
    }))
    for (const [ k, e ] of layout.edges.entries()) {
        let d = `M${e.points[0].x},${e.points[0].y}`
        for (const [ i, b ] of e.points.slice(1).entries()) {
            /*  the hops over the vertical parts of the other edges (in the direction of the part)  */
            const a = e.points[i]
            if (hops && a.y === b.y && a.x !== b.x) {
                const s  = Math.sign(b.x - a.x)
                const xs = verts.filter((v) => v.k !== k && v.y0 < a.y && v.y1 > a.y
                    && Math.min(a.x, b.x) + R < v.x && Math.max(a.x, b.x) - R > v.x)
                    .map((v) => v.x).sort((p, q) => s * (p - q))
                for (const x of xs)
                    d += ` L${x - s * R},${a.y} A${R},${R} 0 0 ${s > 0 ? 1 : 0} ${x + s * R},${a.y}`
            }
            d += ` L${b.x},${b.y}`
        }
        out.push(`<path class="edge${e.dashed === true ? " dashed" : ""}" data-from="${escapeXML(e.from)}" ` +
            `data-to="${escapeXML(e.to)}" d="${d}" marker-end="url(#${name}-arrow)"/>`)
    }
    return out
}

/*  draw a pixel-unit layout of the tasks as SVG, with every group container labeled
    with its name between "♛" and "▶", and every node a "g.node" carrying
    its "data-id" and tone class (plus "context" for a context node of a filtered graph),
    for the click delegation of the page, and its "data-assignee", for the badges placed
    by the page, and holding the same HTML card (task id sub-box and truncated title) as the lanes,
    with the number of label lines its node has room for in "data-lines" (to which the
    page clamps the title, as the browser may wrap it onto more lines than estimated)  */
export const drawGraphSVG = (board: Board, layout: GraphLayout): string => {
    const out = drawSVGFrame("graph", layout, (id) => `♛ ${id} ▶`)
    for (const n of layout.nodes.values()) {
        const card  = board.cards.get(n.id)!
        const lines = Math.round((n.h - units.px.h) / units.px.line) + 1
        out.push(`<g class="node tone-${toneOf(board, card)}${board.context.has(card.id) ? " context" : ""}" data-id="${escapeXML(card.id)}" ` +
            `data-assignee="${escapeXML(card.assignee.replace(/\p{Cc}/gu, ""))}">` +
            `<foreignObject x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="card" data-lines="${lines}"><div class="cbody"><span class="cid">${groupLabel(card) === card.id ? "♛ " : ""}≡ ${escapeXML(card.id)}</span>` +
            `${escapeXML(card.title.replace(/\t/g, " ").replace(/\p{Cc}/gu, ""))
                .replace(/`([^`]+)`/g, "<code>$1</code>")}</div></div></foreignObject></g>`)
    }
    out.push("</svg>")
    return out.join("\n")
}

