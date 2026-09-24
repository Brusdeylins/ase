/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import path                      from "node:path"
import { PassThrough }           from "node:stream"

import type Hapi                 from "@hapi/hapi"
import { Marked }                from "marked"
import { renderMermaidSVG }      from "beautiful-mermaid"

import type Log                  from "./ase-log.js"
import { Task }                  from "./ase-task.js"
import { buildBoard, mermaidOf, toneOf, watchTasks, DashboardState } from "./ase-dashboard-core.js"
import type { Board }            from "./ase-dashboard-core.js"

/*  escape a text for embedding into HTML  */
const escapeHTML = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/*  the Markdown renderer for task plans: raw HTML is escaped instead of
    passed through, links are restricted to harmless schemes, and the
    plan checkboxes are rendered as SpecBook-style progress boxes  */
const marked = new Marked({
    gfm: true,
    renderer: {
        html ({ text }) {
            return escapeHTML(text)
        },
        link ({ href, tokens }) {
            const label = this.parser.parseInline(tokens)
            return /^(https?:|mailto:|#|\.{0,2}\/)/.test(href) ?
                `<a href="${escapeHTML(href)}" target="_blank" rel="noopener">${label}</a>` : label
        }
    }
})
const boxes: Record<string, string> = { "x": "done", "/": "part", "?": "open", "-": "cancel", ">": "defer", " ": "todo" }
const renderPlan = (body: string): string => {
    const prepared = body.replace(/^(\s*[-*]\s+)\[([ x/?\->])\]/gm, (_m, lead: string, box: string) =>
        `${lead}⟦box:${box}⟧`)
    const html = marked.parse(prepared, { async: false })
    return html.replace(/⟦box:(.)⟧/g, (_m, box: string) =>
        `<span class="box ${boxes[box] ?? "todo"}" title="[${escapeHTML(box)}]"></span>`)
}

/*  serialize the board for the browser  */
const boardJSON = (board: Board) => ({
    mode:     board.mode,
    project:  path.basename(Task.projectRoot()),
    warnings: board.warnings,
    surface:  DashboardState.load().web,
    groups:   board.groups.map((g) => ({
        title: g.title,
        lanes: g.lanes.map((l) => ({
            status: l.status, active: l.active, weight: l.weight, dashed: l.dashed,
            cards:  (board.lanes.get(l.status) ?? []).map((c) => ({ num: c.num, id: c.id, cyclic: board.cyclic.has(c.id) }))
        }))
    })),
    nodes: [ ...board.cards.values() ].map((c) => ({ num: c.num, id: c.id, status: c.status, tone: toneOf(board, c) }))
})

/*  the connected event stream clients and the shared change watcher  */
const clients = new Set<PassThrough>()
let stopWatch: (() => Promise<void>) | null = null
let modeTimer: ReturnType<typeof setInterval> | null = null

/*  broadcast a change notification to all event stream clients  */
const broadcast = (): void => {
    for (const c of clients)
        c.write("event: change\ndata: {}\n\n")
}

/*  register the dashboard routes on the ASE service of the project  */
export const registerDashboardRoutes = (server: Hapi.Server, log: Log): void => {
    /*  the single page of the web dashboard  */
    server.route({
        method:  "GET",
        path:    "/dashboard",
        handler: (_request, h) => h.response(page).type("text/html; charset=utf-8")
    })

    /*  the board model  */
    server.route({
        method:  "GET",
        path:    "/dashboard/api/board",
        handler: (_request, h) => {
            try {
                return h.response(boardJSON(buildBoard(log)))
            }
            catch (err: unknown) {
                return h.response({ error: err instanceof Error ? err.message : String(err) }).code(500)
            }
        }
    })

    /*  the dependency graph as SVG  */
    server.route({
        method:  "GET",
        path:    "/dashboard/api/graph",
        handler: (_request, h) => {
            const board = buildBoard(log)
            const svg   = board.cards.size === 0 ? "" : renderMermaidSVG(mermaidOf(board))
            return h.response({ svg })
        }
    })

    /*  one task plan, rendered in the appearance of SpecBook  */
    server.route({
        method:  "GET",
        path:    "/dashboard/api/task/{id}",
        handler: (request, h) => {
            const id    = String(request.params.id)
            const board = buildBoard(log)
            const card  = board.cards.get(id)
            const parts = card !== undefined ? Task.parts(log, id) : null
            if (card === undefined || parts === null)
                return h.response({ error: `no task "${id}"` }).code(404)
            const ref = (ids: string[]) => ids.map((x) => ({ num: board.cards.get(x)!.num, id: x }))
            return h.response({
                num:    card.num,
                id,
                status: card.status,
                fields: [ ...parts.keys ].filter(([ k ]) => k !== "Type"),
                html:   renderPlan(parts.body),
                pred:   ref(board.pred.get(id) ?? []),
                succ:   ref(board.succ.get(id) ?? [])
            })
        }
    })

    /*  toggle a minimized lane or a collapsed group of the web surface  */
    server.route({
        method:  "POST",
        path:    "/dashboard/api/toggle",
        options: { payload: { parse: true, allow: "application/json" } },
        handler: (request, h) => {
            const p = request.payload as { list?: unknown, entry?: unknown } | null
            if (p === null || (p.list !== "minimized" && p.list !== "collapsed") || typeof p.entry !== "string")
                return h.response({ error: "invalid toggle request" }).code(400)
            return h.response(DashboardState.toggle("web", p.list, p.entry).web)
        }
    })

    /*  keep-alive of the service while a dashboard page is open  */
    server.route({
        method:  "GET",
        path:    "/dashboard/api/ping",
        handler: (_request, h) => h.response({ ok: true })
    })

    /*  the change event stream: the watcher runs only while at least one
        client is connected, and a change of the lifecycle mode is noticed
        by comparing it periodically  */
    server.route({
        method:  "GET",
        path:    "/dashboard/events",
        handler: (request, h) => {
            const stream = new PassThrough()
            clients.add(stream)
            if (stopWatch === null) {
                stopWatch = watchTasks(log, broadcast)
                let mode  = Task.lifecycle(log).name
                modeTimer = setInterval(() => {
                    const now = Task.lifecycle(log).name
                    if (now !== mode) {
                        mode = now
                        broadcast()
                    }
                }, 3000)
            }
            request.raw.req.on("close", () => {
                clients.delete(stream)
                stream.end()
                if (clients.size === 0 && stopWatch !== null) {
                    stopWatch().catch(() => {})
                    stopWatch = null
                    if (modeTimer !== null)
                        clearInterval(modeTimer)
                    modeTimer = null
                }
            })
            stream.write(": connected\n\n")
            return h.response(stream)
                .type("text/event-stream")
                .header("Cache-Control", "no-cache")
                .header("X-Accel-Buffering", "no")
        }
    })
}

/*  the single page of the web dashboard (all texts in English)  */
const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ASE Dashboard</title>
<style>
:root { --blue: #2f6fb0; --blue-bg: #f2f7fd; --blue-hd: #dce9f8; --grey: #c3cad3; --grey-bg: #f1f3f6;
        --grey-hd: #e4e7ec; --ink: #1d2939; --mute: #667085; --dark: #344054; }
* { box-sizing: border-box }
[hidden] { display: none !important }
body { margin: 0; font: 13px/1.4 "Source Sans 3", Helvetica, Arial, sans-serif; color: var(--ink); background: #f5f6f8 }
header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #d0d5dd }
.tab { border: 0; border-radius: 11px; padding: 3px 18px; background: #cfd5dd; color: var(--dark); cursor: pointer; font: inherit }
.tab.on { background: var(--blue); color: #fff }
.legend, .mute { color: var(--mute); font-size: 11px }
.warn { color: #b54708; font-size: 11px }
.spacer { flex: 1 }
.mode { position: relative; background: var(--blue); color: #fff; border-radius: 11px; padding: 3px 14px; font-weight: bold; cursor: help }
.mode .tip { display: none; position: absolute; right: 0; top: 30px; z-index: 5; width: 540px; padding: 10px 14px;
             background: var(--ink); color: #e4e7ec; border-radius: 6px; font-weight: normal }
.mode .tip code { color: #9fc6ee; font-family: "Source Code Pro", Menlo, monospace }
.mode:hover .tip, .mode:focus .tip { display: block }
#view { padding: 14px 16px }
#board { display: flex; gap: 12px; height: calc(100vh - 118px); overflow-x: auto }
.group { display: flex; flex-direction: column; gap: 8px; min-width: 220px; flex: 1 }
.group.coll { min-width: 46px; max-width: 46px; flex: none }
.ghd { background: var(--dark); color: #fff; font-weight: bold; padding: 4px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap }
.coll .vt { writing-mode: vertical-rl; margin: 12px auto; color: var(--dark); font-weight: bold }
.coll .body { flex: 1; background: var(--grey-bg); border: 1px solid var(--grey); border-radius: 6px }
.lane { display: flex; flex-direction: column; min-height: 0; background: var(--grey-bg); border: 1px solid var(--grey); border-radius: 6px }
.lane.active { background: var(--blue-bg); border-color: var(--blue) }
.lane.dashed { border-style: dashed }
.lane.min { flex: none !important }
.lhd { display: flex; justify-content: space-between; padding: 4px 12px; background: var(--grey-hd); border-radius: 6px 6px 0 0;
       font-weight: bold; color: #475467; cursor: pointer; font-size: 12px }
.active .lhd { background: var(--blue-hd); color: #1a4f85 }
.cards { overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px }
.card { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--grey); border-radius: 5px;
        padding: 8px 10px; cursor: pointer; font-weight: bold }
.card:hover { border-color: var(--blue) }
.num { background: #e8eef6; border: 1px solid #a9c6e3; color: var(--blue); border-radius: 4px; padding: 0 6px; font-size: 12px }
#hscroll { display: flex; align-items: center; gap: 8px; padding: 6px 16px 0; color: var(--mute); font-size: 11px }
#hscroll button { border: 0; background: none; cursor: pointer; color: #475467 }
#graph svg { max-width: none }
#graph .node { cursor: pointer }
#graph .tone-done rect { fill: #f1f3f6; stroke: #d0d5dd }
#graph .tone-done text { fill: #98a2b3 }
#graph .tone-active rect { fill: var(--blue-bg); stroke: var(--blue); stroke-width: 2 }
#graph .tone-active text { fill: #1a4f85; font-weight: bold }
#scrim { display: none; position: fixed; inset: 0; background: rgba(12,17,29,.55); z-index: 10 }
#dlg { position: absolute; left: 50%; top: 4vh; transform: translateX(-50%); width: min(900px, 94vw); max-height: 92vh;
       display: flex; flex-direction: column; background: #fff; border: 1px solid #b7c0cc; border-radius: 10px;
       box-shadow: 4px 6px 0 rgba(12,17,29,.25) }
#dlg .dhd { display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: #f2f5f9; border-radius: 10px 10px 0 0 }
#dlg .dhd h1 { font-size: 16px; margin: 0 }
.chip { border: 1px solid #a9c6e3; background: #eaf2fa; border-radius: 10px; padding: 1px 10px; font-size: 11px; color: var(--mute) }
.chip.st { background: var(--blue); color: #fff; border-color: #1a4f85; font-weight: bold }
.close { border: 0; background: none; font-size: 16px; cursor: pointer }
#dlg .dbody { overflow-y: auto; padding: 16px 32px 24px }
.fields { display: grid; grid-template-columns: 90px 1fr 90px 1fr; gap: 2px 12px; font: 12px "Source Code Pro", Menlo, monospace;
          padding-bottom: 12px; border-bottom: 1px solid #e4e7ec }
.fields .k { color: var(--mute) }
.plan { counter-reset: sec1 }
.plan h1 { display: none }
.plan h2 { counter-increment: sec1; font-size: 15px; margin: 18px 0 8px }
.plan h2::before { content: counter(sec1, decimal-leading-zero) " "; color: #98a2b3; font-weight: normal; margin-right: 6px }
.plan ul { list-style: none; padding-left: 6px }
.plan li { margin: 6px 0 }
.box { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border: 1px solid var(--blue); border-radius: 2px;
       vertical-align: -1px }
.box.done { background: var(--blue) } .box.part { background: #a9c6e3 } .box.todo { background: #fff; border-color: #a9c6e3 }
.box.open { background: #fdf2fa; border-color: #c11574 } .box.cancel { background: #e4e7ec; border-color: #98a2b3 }
.box.defer { background: #fef0c7; border-color: #b54708 }
.refs { border-top: 1px solid #e4e7ec; margin-top: 14px; padding-top: 10px; display: grid; grid-template-columns: 110px 1fr; gap: 8px }
.ref { border: 1px solid var(--blue); background: #eaf2fa; color: var(--blue); border-radius: 11px; padding: 1px 10px;
       margin-right: 6px; cursor: pointer; font-weight: bold; font-size: 11px }
</style>
</head>
<body>
<header>
  <button class="tab on" id="tabLanes">Lanes</button>
  <button class="tab" id="tabGraph">Graph</button>
  <span id="project"></span>
  <span id="count" class="mute"></span>
  <span class="legend">blue = active lane · grey = parking lane</span>
  <span id="warn" class="warn"></span>
  <span class="spacer"></span>
  <span class="mode" tabindex="0"><span id="mode"></span> ?
    <span class="tip">The mode comes from the ASE configuration, not the dashboard:<br>
      <code>ase config set project.task.lifecycle &lt;solo|team|enterprise&gt;</code></span></span>
</header>
<div id="view">
  <div id="board"></div>
  <div id="graph" hidden></div>
</div>
<div id="hscroll"><button id="left">◀</button><span id="hinfo"></span><button id="right">▶</button></div>
<div id="scrim"><div id="dlg"></div></div>
<script>
"use strict"
let board = null, view = "lanes", openId = null
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" })[c])
const api = async (url, opts) => (await fetch(url, opts)).json()

function renderBoard () {
    $("project").textContent = board.project
    $("count").textContent   = board.nodes.length + " tasks"
    $("mode").textContent    = "Mode: " + board.mode
    $("warn").textContent    = board.warnings.length > 0 ? "⚠ " + board.warnings.join(" · ") : ""
    const s = board.surface
    $("board").innerHTML = board.groups.map((g) => {
        if (s.collapsed.includes(g.title)) {
            const total = g.lanes.reduce((n, l) => n + l.cards.length, 0)
            return '<div class="group coll"><div class="ghd" data-group="' + esc(g.title) + '">▸</div>' +
                '<div class="body"><div class="vt">' + esc(g.title.replace(/^\\d+\\s+/, "")) + " · " + total + "</div></div></div>"
        }
        return '<div class="group"><div class="ghd" data-group="' + esc(g.title) + '">' + esc(g.title) + "</div>" +
            g.lanes.map((l) => {
                const min = s.minimized.includes(l.status)
                return '<div class="lane' + (l.active ? " active" : "") + (l.dashed ? " dashed" : "") + (min ? " min" : "") +
                    '" style="flex:' + l.weight + ' 1 0"><div class="lhd" data-lane="' + esc(l.status) + '"><span>' +
                    (min ? "▸ " : "▾ ") + esc(l.status) + "</span><span>" + l.cards.length + "</span></div>" +
                    (min ? "" : '<div class="cards">' + l.cards.map((c) => '<div class="card" data-id="' + esc(c.id) + '">' +
                        '<span class="num">' + c.num + "</span>" + esc(c.id) + (c.cyclic ? " ⟲" : "") + "</div>").join("") + "</div>") +
                    "</div>"
            }).join("") + "</div>"
    }).join("")
    updateScroll()
}

function updateScroll () {
    const el = $("board"), groups = [ ...el.querySelectorAll(".group") ]
    const visible = groups.map((g, i) => [ g, i ]).filter(([ g ]) =>
        g.offsetLeft + g.offsetWidth > el.scrollLeft + 1 && g.offsetLeft < el.scrollLeft + el.clientWidth - 1)
    const all = visible.length === groups.length
    $("left").style.visibility  = all ? "hidden" : "visible"
    $("right").style.visibility = all ? "hidden" : "visible"
    $("hinfo").textContent = visible.length === 0 ? "" : "Groups " + (visible[0][1] + 1) + "–" +
        (visible[visible.length - 1][1] + 1) + " of " + groups.length + (all ? " · all visible" : " · scroll or ◀/▶")
}

async function renderGraph () {
    const { svg } = await api("/dashboard/api/graph")
    $("graph").innerHTML = svg || '<p class="mute">(no tasks)</p>'
    for (const g of $("graph").querySelectorAll("g.node[data-id]")) {
        const n = board.nodes.find((x) => "n" + x.num === g.dataset.id)
        if (n) g.classList.add("tone-" + n.tone)
    }
}

async function openTask (id) {
    const t = await api("/dashboard/api/task/" + encodeURIComponent(id))
    if (t.error) { closeTask(); return }
    openId = id
    const refs = (list) => list.length === 0 ? '<span class="mute">—</span>' :
        list.map((r) => '<span class="ref" data-ref="' + esc(r.id) + '">' + r.num + " · " + esc(r.id) + "</span>").join("")
    $("dlg").innerHTML =
        '<div class="dhd"><span class="num">' + t.num + "</span><h1>" + esc(t.id) + '</h1><span class="chip st">' +
        esc(t.status) + '</span><span class="spacer"></span><span class="mute">ESC closes</span>' +
        '<button class="close" id="close">✕</button></div><div class="dbody"><div class="fields">' +
        t.fields.map(([ k, v ]) => '<span class="k">' + esc(k) + "</span><span>" + esc(v) + "</span>").join("") +
        '</div><div class="plan">' + t.html + '</div><div class="refs"><span class="mute">PREDECESSORS</span><span>' +
        refs(t.pred) + '</span><span class="mute">SUCCESSORS (computed)</span><span>' + refs(t.succ) + "</span></div></div>"
    $("scrim").style.display = "block"
}

function closeTask () {
    openId = null
    $("scrim").style.display = "none"
}

async function reload () {
    board = await api("/dashboard/api/board")
    if (board.error) { $("board").textContent = board.error; return }
    renderBoard()
    if (view === "graph") await renderGraph()
    if (openId !== null) await openTask(openId)
}

async function toggle (list, entry) {
    board.surface = await api("/dashboard/api/toggle", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ list, entry }) })
    renderBoard()
}

function setView (v) {
    view = v
    $("tabLanes").classList.toggle("on", v === "lanes")
    $("tabGraph").classList.toggle("on", v === "graph")
    $("board").hidden = v !== "lanes"
    $("hscroll").hidden = v !== "lanes"
    $("graph").hidden = v !== "graph"
    if (v === "graph") renderGraph()
}

$("tabLanes").onclick = () => setView("lanes")
$("tabGraph").onclick = () => setView("graph")
$("left").onclick  = () => $("board").scrollBy({ left: -240, behavior: "smooth" })
$("right").onclick = () => $("board").scrollBy({ left:  240, behavior: "smooth" })
$("board").addEventListener("scroll", updateScroll)
window.addEventListener("resize", updateScroll)
$("board").addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]"), lane = ev.target.closest("[data-lane]"), group = ev.target.closest("[data-group]")
    if (card)  openTask(card.dataset.id)
    else if (lane)  toggle("minimized", lane.dataset.lane)
    else if (group) toggle("collapsed", group.dataset.group)
})
$("graph").addEventListener("click", (ev) => {
    const node = ev.target.closest("g.node[data-id]")
    if (!node) return
    const hit = board.nodes.find((n) => "n" + n.num === node.dataset.id)
    if (hit) openTask(hit.id)
})
$("scrim").addEventListener("click", (ev) => {
    if (ev.target === $("scrim") || ev.target.id === "close") closeTask()
    const ref = ev.target.closest("[data-ref]")
    if (ref) openTask(ref.dataset.ref)
})
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeTask() })
new EventSource("/dashboard/events").addEventListener("change", () => reload())
setInterval(() => fetch("/dashboard/api/ping"), 60 * 1000)
reload()
</script>
</body>
</html>
`
