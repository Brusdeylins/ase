/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as TaskFormat             from "./ase-task-format.js"
import type { AgentPresence, AgentFlow } from "./ase-agent-relay-core.js"
import { units, portSpacing, layoutBoxes, textGrid, drawContainers, drawContainerLabels, drawEdges, drawBox, drawSVGFrame, escapeXML } from "./ase-task-board-graph.js"
import type { GraphLayout, LayoutNode, LayoutEdge } from "./ase-task-board-graph.js"

/*  the id prefixes of the state nodes and of the agent cards of the agent graph
    (where the ids of the edges, separated by "->", never contain this separator)  */
const STATE = "state:"
const CARD  = "agent:"

/*  the sizes of an agent card: in cell units (two border lines around the name line
    and three field lines, like the agent cards of the agents view), and in pixel units
    (the size of the agent cards of the agents view: their 260px column without its
    paddings and borders, and their name line and three field lines with their paddings and borders)  */
const CARD_W    = 32
const CARD_H    = 6
const CARD_PX_W = 238
const CARD_PX_H = 81

/*  an agent card of the agent graph: the running agents of the same kind and mode, merged
    into one card (ordered by their start time), with their name, kind, and mode (of the
    oldest of them), whether any of them is busy, the union of the tasks they are busy with,
    and the lifecycle states they operate on (of a phase agent only)  */
export type FlowCard = {
    id: string, agents: AgentPresence[], name: string, kind: string, mode: string,
    busy: boolean, tasks: string[], states?: AgentFlow
}

/*  the place of a lifecycle state in the lanes view: its phase (column), and its row
    (1: the entry state of the phase, 2: its active state, 3: its parking states)  */
export type FlowSpot = { col: number, row: number }

/*  the agent graph: its agent cards (by their ids) and the lifecycle states referenced
    by them (in lifecycle order), its input, gate (dashed), and output edges, and the
    places of the lifecycle states (as in the lanes view)  */
export type Flow = { cards: Map<string, FlowCard>, states: string[], edges: LayoutEdge[], spots: Map<string, FlowSpot> }

/*  build the agent graph of the running agents, with the lifecycle states placed as in the lanes view  */
export const flowOf = (agents: AgentPresence[], groups: { lanes: { status: string, active: boolean }[] }[]): Flow => {
    const spots = new Map<string, FlowSpot>()
    groups.forEach((g, col) => g.lanes.forEach((lane, l) =>
        spots.set(lane.status, { col, row: lane.active ? 2 : l === 0 ? 1 : 3 })))
    const order = groups.flatMap((g) => g.lanes.map((lane) => lane.status))

    /*  merge the agents of the same kind and mode into one card  */
    const merged = new Map<string, AgentPresence[]>()
    for (const agent of [ ...agents ].sort((a, b) => a.started - b.started)) {
        const id = `${CARD}${agent.kind}:${agent.mode}`
        if (!merged.has(id))
            merged.set(id, [])
        merged.get(id)!.push(agent)
    }
    const rank = (state: string | undefined) => state === undefined || !order.includes(state) ? order.length : order.indexOf(state)
    const cards = new Map<string, FlowCard>()
    const list  = [ ...merged.entries() ].map(([ id, group ]): FlowCard => {
        const first = group[0]
        return {
            id, agents: group, name: first.name, kind: first.kind, mode: first.mode,
            busy:  group.some((a) => a.state === "busy"),
            tasks: [ ...new Set(group.flatMap((a) => a.tasks)) ].sort(TaskFormat.compareIds),
            ...(first.states !== undefined ? { states: first.states } : {})
        }
    })

    /*  order the cards along the lifecycle (by their activity or first incoming state),
        with the request agents (without any states) last  */
    list.sort((a, b) => rank(a.states?.activity ?? a.states?.input[0]) - rank(b.states?.activity ?? b.states?.input[0])
        || a.kind.localeCompare(b.kind) || a.mode.localeCompare(b.mode))
    for (const card of list)
        cards.set(card.id, card)

    /*  the referenced states (in lifecycle order) and the edges, where a gate state
        which is also an incoming state of the agent yields no additional edge  */
    const states = new Set<string>()
    const edges  = [] as LayoutEdge[]
    for (const card of list) {
        const s = card.states
        if (s === undefined)
            continue
        for (const state of s.input) {
            states.add(state)
            edges.push({ from: STATE + state, to: card.id })
        }
        if (s.gate !== undefined && !s.input.includes(s.gate)) {
            states.add(s.gate)
            edges.push({ from: STATE + s.gate, to: card.id, dashed: true })
        }
        for (const state of s.output) {
            states.add(state)
            edges.push({ from: card.id, to: STATE + state })
        }
    }
    return { cards, states: [ ...states ].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)), edges, spots }
}

/*  the label of the container of an activity state  */
const containerLabel = (state: string) => `◉ ${state}`

/*  lay out the agent graph top to bottom in rows: the request agents on top, below them
    the lifecycle states in the grid of the lanes view (the entry states, the active states
    as the containers nesting the cards of the agents operating in them, plus the cards
    of the unclaimed phase agents, and the parking states), with the phases as columns  */
export const layoutFlow = (flow: Flow, unit: "cell" | "px"): Promise<GraphLayout> => {
    const u      = units[unit]
    const labels = new Map<string, string>()
    const rows   = new Map<string, number>()
    const spot   = (state: string | undefined) =>
        flow.spots.get(state ?? "") ?? { col: Number.MAX_SAFE_INTEGER, row: 1 }

    /*  the common width of all state nodes: wide enough for the longest state name
        and for the most ports on one side of a state node (as else the layout widens
        each state node individually for its own ports)  */
    const ports  = (state: string) => Math.max(
        flow.edges.filter((e) => e.to   === STATE + state).length,
        flow.edges.filter((e) => e.from === STATE + state).length)
    const stateW = Math.max(0, ...flow.states.map((state) => Math.max(
        unit === "cell" ? state.length + 4 : u.gw(state),
        (ports(state) + 1) * portSpacing[unit])))
    const nodes  = [
        ...flow.states.map((state): LayoutNode & FlowSpot => {
            const s = spot(state)
            rows.set(STATE + state, s.row)
            return { id: STATE + state, w: stateW, h: u.h, ...s }
        }),
        ...[ ...flow.cards.values() ].map((card): LayoutNode & FlowSpot => {
            const activity = card.states?.activity
            const box      = { id: card.id, w: unit === "cell" ? CARD_W : CARD_PX_W, h: unit === "cell" ? CARD_H : CARD_PX_H }
            if (card.states === undefined) {
                rows.set(card.id, 0)
                return { ...box, col: -1, row: 0 }
            }
            if (activity === undefined) {
                rows.set(card.id, 2)
                return { ...box, col: spot(card.states.input[0]).col, row: 2 }
            }
            labels.set(activity, containerLabel(activity))
            rows.set(activity, 2)
            return { ...box, group: activity, col: spot(activity).col, row: 2 }
        })
    ]

    /*  the order of the nodes (and hence of the containers) within each row: by their columns  */
    nodes.sort((a, b) => a.col - b.col || a.row - b.row)
    return layoutBoxes(unit, nodes.map(({ col: _col, row: _row, ...n }) => n), labels, flow.edges, rows)
}

/*  whether a node id of the agent graph is an agent card (and not a state node),
    and the node id of a state node  */
export const isFlowCard = (id: string): boolean =>
    id.startsWith(CARD)
export const flowState = (state: string): string =>
    STATE + state

/*  the agent cards related to a state node of the agent graph: the ones observing it
    (incoming), writing it (outgoing), and gating on it, plus its state  */
export const flowRelations = (flow: Flow, id: string) => {
    const state = id.slice(STATE.length)
    const cards = [ ...flow.cards.values() ]
    return {
        state,
        input:  cards.filter((c) => c.states?.input.includes(state) === true),
        output: cards.filter((c) => c.states?.output.includes(state) === true),
        gate:   cards.filter((c) => c.states?.gate === state && !c.states.input.includes(state))
    }
}

/*  the agent name of a card, with the number of its merged agents  */
const cardName = (card: FlowCard) =>
    card.agents.length > 1 ? `${card.name} ×${card.agents.length}` : card.name

/*  remove control characters from a text of the agent relay  */
const clean = (text: string): string =>
    text.replace(/\p{Cc}/gu, "")

/*  draw a cell-unit layout of the agent graph onto a character grid, returning per cell the
    character and a tone for coloring (like the task graph): the state nodes in tone "done" (or "sel"), the
    agent cards in tone "active" (busy), "idle" (waiting), or "sel" (selected, with a heavy border, like
    a selected state), with the name of
    the agent inverse on their first line, followed by their field lines (with the tone suffix
    "-title" on the labels, "-value" on their bold values, and the busy task ids inverse), and the given pulse glyph (else a filled
    circle) of a busy card, resp. an empty circle of a waiting one, in the right part of their top border  */
export const drawFlowText = (flow: Flow, layout: GraphLayout, selected: string, pulse = "",
    beat: (agent: string) => boolean = () => false) => {
    const g = textGrid(layout)
    const { W, H, chars, tones } = g
    const put = (x: number, y: number, max: number, text: string, tone: string): number => {
        const n = y < H ? Math.min(text.length, max, W - x) : 0
        for (let i = 0; i < n; i++) {
            chars[y][x + i] = text[i]
            tones[y][x + i] = tone
        }
        return x + Math.max(0, n)
    }
    drawContainers(g, layout.groups, containerLabel)
    drawEdges(g, layout.edges, selected, true)
    drawContainerLabels(g, layout.groups, containerLabel)
    for (const n of layout.nodes.values()) {
        if (!isFlowCard(n.id)) {
            /*  the state centered within its box (which may be widened for its ports)  */
            const state = n.id.slice(STATE.length)
            const tone  = n.id === selected ? "sel" : "done"
            drawBox(g, n, tone, false, n.id === selected)
            put(n.x + Math.max(2, Math.floor((n.w - state.length) / 2)), n.y + 1, n.w - 4, state, `${tone}-title`)
            continue
        }
        const card = flow.cards.get(n.id)
        if (card === undefined)
            continue
        const base = card.busy ? "active" : "idle"
        const tone = n.id === selected ? "sel" : base
        drawBox(g, n, tone, false, n.id === selected)
        if (n.w > 6)
            chars[n.y][n.x + n.w - 3] = !card.busy ? "○" : pulse !== "" ? pulse : "●"

        /*  the name line (with the heart of the agents in the top right corner inside the card,
            like in the agents view, filled for a second after a heartbeat of any of them)
            and the field lines, cut at the right border  */
        const max  = n.w - 4
        const room = max - 2
        const name = ` ⚉ ${clean(cardName(card))} `
        put(n.x + 2, n.y + 1, room, name.length > room ? name.slice(0, room - 1) + "…" : name, `${tone}-id`)
        put(n.x + n.w - 3, n.y + 1, 1, card.agents.some((a) => beat(a.id)) ? "♥" : "♡", tone)
        const fields: [ string, string ][] = [
            [ "kind:", clean(card.kind) ],
            [ "mode:", card.mode !== "" ? clean(card.mode) : "none" ],
            [ "task:", "" ]
        ]
        fields.forEach(([ label, value ], k) => {
            const y = n.y + 2 + k
            if (y >= n.y + n.h - 1)
                return
            let x = put(n.x + 2, y, max, label.padEnd(6), `${tone}-title`)
            const end = n.x + 2 + max
            if (label !== "task:")
                put(x, y, end - x, value, `${tone}-value`)
            else if (card.tasks.length === 0)
                put(x, y, end - x, `none (${card.agents[0].state})`, `${tone}-value`)
            else
                for (const id of card.tasks) {
                    if (x >= end)
                        break
                    x = put(x, y, end - x, ` ${clean(id)} `, `${tone}-id`) + 1
                }
        })
    }
    return { lines: chars.map((r) => r.join("")), tones }
}

/*  draw a pixel-unit layout of the agent graph as SVG, with every activity container labeled
    with its state, every state node a "g.node.state" box with its state, and every agent card a
    "g.node" holding the same HTML card as the agents view (with the class "busy" for a busy agent,
    and with the heart of its agents, carrying their ids, to be filled by the page on their heartbeats),
    both carrying their "data-id" (for the click delegation of the page)  */
export const drawFlowSVG = (flow: Flow, layout: GraphLayout): string => {
    const out = drawSVGFrame(layout, containerLabel, true)
    for (const n of layout.nodes.values()) {
        if (!isFlowCard(n.id)) {
            out.push(`<g class="node state" data-id="${escapeXML(n.id)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5"/>` +
                `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2}">${escapeXML(n.id.slice(STATE.length))}</text></g>`)
            continue
        }
        const card = flow.cards.get(n.id)
        if (card === undefined)
            continue
        const field = (label: string, value: string) =>
            `<span>${label}</span><b class="aval">${escapeXML(clean(value))}</b>`
        const tasks = card.tasks.length === 0 ? `<b>none (${escapeXML(card.agents[0].state)})</b>` :
            card.tasks.map((id) => `<span class="atask">${escapeXML(clean(id))}</span>`).join("")
        out.push(`<g class="node" data-id="${escapeXML(card.id)}">` +
            `<foreignObject x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="acard${card.busy ? " busy" : ""}">` +
            `<div class="aname"><span class="abadge"><span class="aicon">⚉</span> ${escapeXML(clean(cardName(card)))}</span></div>` +
            `<span class="abeat" data-agents="${escapeXML(card.agents.map((a) => a.id).join(" "))}">♡</span>` +
            "<div class=\"afields\">" +
            field("kind:", card.kind) + field("mode:", card.mode !== "" ? card.mode : "none") +
            `<span>task:</span><span class="aval atasks">${tasks}</span>` +
            "</div></div></foreignObject></g>")
    }
    out.push("</svg>")
    return out.join("\n")
}

