/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
**
**  arc42 chapter help texts adapted from the arc42-template v9.0
**  (EN + DE), © Dr. Peter Hruschka, Dr. Gernot Starke and contributors,
**  licensed under CC-BY-SA 4.0.  See <https://arc42.org>.
*/

/*  Twelve arc42 chapters as render-functions.  Each function returns
    `{ md, html }` strings carrying (a) the arc42 help text inline and
    (b) — for ten of twelve chapters — an auto-fill section derived from
    project metadata and the source-code analysis pipeline.  Chapters 4
    (Solution Strategy) and 12 (Glossary) remain help-text-only.  */

import type { ApiJson, Cluster }              from "../../types.js"
import type { RenderContext }                from "../context.js"
import type { ProjectMeta }                  from "../../project-meta.js"
import type { Lang, StringSet }              from "./strings.js"
import { strings }                           from "./strings.js"
import { chapterTitles, anchorId, escapeHtml } from "./html-wrapper.js"
import { buildClassDiagram }                 from "../class-diagram.js"
import { buildLayeredFlowchart }             from "../flowchart.js"
import { mainSequenceMermaid }               from "../main-sequence.js"
import { shortlistMd, shortlistHtml }        from "../shortlist.js"
import { cyclesMd, cyclesHtml }              from "../cycles.js"

export interface ChapterOutput { md: string; html: string }

interface ChapterInput {
    api:        ApiJson
    ctx:        RenderContext
    meta:       ProjectMeta
    lang:       Lang
    scope:      string
}

/*  --- arc42 help texts (DE + EN), per chapter, kept compact ---  */

const HELP: Record<Lang, string[]> = {
    en: [
        /* 1  */ "Describes the relevant requirements and the driving forces that software architects and development team must consider. These include underlying business goals, essential features, essential functional requirements, quality goals for the architecture, and relevant stakeholders and their expectations.\n\n*See [Introduction and Goals](https://docs.arc42.org/section-1/) in the arc42 documentation.*",
        /* 2  */ "Any requirement that constrains software architects in their freedom of design and implementation decisions or decision about the development process. These constraints sometimes go beyond individual systems and are valid for whole organizations and companies.\n\n*See [Architecture Constraints](https://docs.arc42.org/section-2/) in the arc42 documentation.*",
        /* 3  */ "Context and scope delimits your system (i.e. your scope) from all its communication partners (neighboring systems and users, i.e. the context of your system). It thereby specifies the external interfaces. If necessary, differentiate the business context (domain specific inputs and outputs) from the technical context (channels, protocols, hardware).\n\n*See [Context and Scope](https://docs.arc42.org/section-3/) in the arc42 documentation.*",
        /* 4  */ "A short summary and explanation of the fundamental decisions and solution strategies that shape the system's architecture. It includes technology decisions, decisions about the top-level decomposition of the system, decisions on how to achieve key quality goals, and relevant organizational decisions.\n\n> This chapter requires genuine human synthesis and is intentionally left for manual completion. Document the **fundamental** choices — not all decisions, but the few that everyone else depends on.\n\n*See [Solution Strategy](https://docs.arc42.org/section-4/) in the arc42 documentation.*",
        /* 5  */ "The building block view shows the static decomposition of the system into building blocks (modules, components, subsystems, classes, interfaces, packages, libraries, frameworks, layers, partitions, tiers, functions, macros, operations, data structures, …) as well as their dependencies (relationships, associations, …). This view is mandatory for every architecture documentation.\n\n*See [Building Block View](https://docs.arc42.org/section-5/) in the arc42 documentation.*",
        /* 6  */ "The runtime view describes concrete behavior and interactions of the system's building blocks in form of scenarios from the following areas: important use cases or features, interactions at critical external interfaces, operation and administration, error and exception scenarios.\n\n*See [Runtime View](https://docs.arc42.org/section-6/) in the arc42 documentation.*",
        /* 7  */ "The deployment view describes the technical infrastructure used to execute the system (with infrastructure elements like geographical locations, environments, computers, processors, channels and net topologies as well as other infrastructure elements) and the mapping of (software) building blocks to that infrastructure elements.\n\n*See [Deployment View](https://docs.arc42.org/section-7/) in the arc42 documentation.*",
        /* 8  */ "This section describes overall, principal regulations and solution ideas that are relevant in multiple parts of the system. Such concepts are often related to multiple building blocks. Examples are domain concepts, architecture and design patterns, rules for using specific technology, principal — often technical — decisions of an overarching (general) nature, and implementation rules.\n\n*See [Crosscutting Concepts](https://docs.arc42.org/section-8/) in the arc42 documentation.*",
        /* 9  */ "Important, expensive, large scale or risky architecture decisions including rationales. With \"decisions\" we mean selecting one alternative based on given criteria.\n\n*See [Architecture Decisions](https://docs.arc42.org/section-9/) in the arc42 documentation.*",
        /* 10 */ "This section contains all quality requirements as quality tree with scenarios. The most important ones have already been described in section 1.2 (Quality Goals). Here you can also capture quality requirements with lesser priority, which will not create high risks if they are not fully achieved.\n\n*See [Quality Requirements](https://docs.arc42.org/section-10/) in the arc42 documentation.*",
        /* 11 */ "A list of identified technical risks or technical debts, ordered by priority.\n\n*See [Risks and Technical Debt](https://docs.arc42.org/section-11/) in the arc42 documentation.*",
        /* 12 */ "The most important domain and technical terms that your stakeholders use when discussing the system. You can also see the glossary as source for translations if you work in multi-language teams.\n\n> This chapter requires genuine human synthesis and is intentionally left for manual completion.\n\n*See [Glossary](https://docs.arc42.org/section-12/) in the arc42 documentation.*"
    ],
    de: [
        /* 1  */ "Beschreibt die wesentlichen Anforderungen und treibenden Kräfte, die bei der Umsetzung der Softwarearchitektur und Entwicklung des Systems berücksichtigt werden müssen. Dazu gehören zugrunde liegende Geschäftsziele, wesentliche Aufgabenstellungen, wesentliche funktionale Anforderungen, Qualitätsziele für die Architektur sowie relevante Stakeholder und deren Erwartungshaltung.\n\n*Siehe [Einführung und Ziele](https://docs.arc42.org/section-1/) in der arc42-Dokumentation.*",
        /* 2  */ "Jegliche Anforderung, die den Architekt:innen Freiheitsgrade bezüglich Entwurf und Implementierung des Systems einschränkt, gehört in diesen Abschnitt. Solche Randbedingungen reichen manchmal über einzelne Systeme hinaus und gelten für ganze Organisationen und Unternehmen.\n\n*Siehe [Randbedingungen](https://docs.arc42.org/section-2/) in der arc42-Dokumentation.*",
        /* 3  */ "Kontextabgrenzung grenzt das System von seinen Kommunikationspartnern (Nachbarsystemen und Benutzern) ab. Sie legt damit auch die externen Schnittstellen fest. Differenzieren Sie ggf. den fachlichen Kontext (fachliche Eingaben und Ausgaben) vom technischen Kontext (Kanäle, Protokolle, Hardware).\n\n*Siehe [Kontextabgrenzung](https://docs.arc42.org/section-3/) in der arc42-Dokumentation.*",
        /* 4  */ "Kurzer Überblick über die grundlegenden Entscheidungen und Lösungsansätze, die Entwurf und Implementierung des Systems prägen. Dazu gehören Technologieentscheidungen, Entscheidungen über die Top-Level-Zerlegung, Ansätze zur Erreichung der Qualitätsziele sowie relevante organisatorische Entscheidungen.\n\n> Dieses Kapitel erfordert echte menschliche Synthese und wird bewusst zur manuellen Bearbeitung übrig gelassen. Dokumentieren Sie die **grundlegenden** Entscheidungen — nicht alle, sondern die wenigen, von denen die übrigen abhängen.\n\n*Siehe [Lösungsstrategie](https://docs.arc42.org/section-4/) in der arc42-Dokumentation.*",
        /* 5  */ "Die Bausteinsicht zeigt die statische Zerlegung des Systems in Bausteine (Module, Komponenten, Subsysteme, Klassen, Schnittstellen, Pakete, Bibliotheken, Frameworks, Schichten, Partitionen, Funktionen, Makros, Datenstrukturen, …) sowie deren Abhängigkeiten (Beziehungen, Assoziationen, …). Diese Sicht ist für jede Architekturdokumentation verpflichtend.\n\n*Siehe [Bausteinsicht](https://docs.arc42.org/section-5/) in der arc42-Dokumentation.*",
        /* 6  */ "Die Laufzeitsicht beschreibt das konkrete Verhalten und Zusammenspiel der Bausteine in Form von Szenarien aus folgenden Bereichen: wichtige Use Cases oder Features, Interaktionen an kritischen externen Schnittstellen, Betrieb und Administration, Fehler- und Ausnahmeszenarien.\n\n*Siehe [Laufzeitsicht](https://docs.arc42.org/section-6/) in der arc42-Dokumentation.*",
        /* 7  */ "Die Verteilungssicht beschreibt die technische Infrastruktur, in der das System ausgeführt wird (geographische Verortung, Umgebungen, Rechner, Prozessoren, Kanäle, Netztopologien etc.), sowie die Abbildung von (Software-)Bausteinen auf diese Infrastrukturelemente.\n\n*Siehe [Verteilungssicht](https://docs.arc42.org/section-7/) in der arc42-Dokumentation.*",
        /* 8  */ "Dieser Abschnitt beschreibt übergreifende, prinzipielle Regelungen und Lösungsansätze, die an mehreren Stellen (\"crosscutting\") des Systems relevant sind. Beispiele: fachliche Konzepte, Architektur- und Entwurfsmuster, Regeln für den Einsatz konkreter Technologie, übergeordnete (meist technische) Entscheidungen, Implementierungsregeln.\n\n*Siehe [Querschnittliche Konzepte](https://docs.arc42.org/section-8/) in der arc42-Dokumentation.*",
        /* 9  */ "Wichtige, teure, große oder riskante Architekturentscheidungen mit Begründung. Mit \"Entscheidungen\" meinen wir die Auswahl einer Option aus mehreren Alternativen anhand gegebener Kriterien.\n\n*Siehe [Architekturentscheidungen](https://docs.arc42.org/section-9/) in der arc42-Dokumentation.*",
        /* 10 */ "Dieser Abschnitt enthält alle Qualitätsanforderungen als Qualitätsbaum mit Szenarien. Die wichtigsten Anforderungen wurden bereits in Abschnitt 1.2 (Qualitätsziele) beschrieben. Hier können Sie auch Qualitätsanforderungen geringerer Priorität festhalten, deren Nicht-Erreichen kein hohes Risiko darstellt.\n\n*Siehe [Qualitätsanforderungen](https://docs.arc42.org/section-10/) in der arc42-Dokumentation.*",
        /* 11 */ "Eine geordnete Liste der erkannten technischen Risiken und technischen Schulden, sortiert nach Priorität.\n\n*Siehe [Risiken und Technische Schulden](https://docs.arc42.org/section-11/) in der arc42-Dokumentation.*",
        /* 12 */ "Die wichtigsten fachlichen und technischen Begriffe, die Stakeholder beim Sprechen über das System verwenden. Das Glossar dient zugleich als Übersetzungsquelle in mehrsprachigen Teams.\n\n> Dieses Kapitel erfordert echte menschliche Synthese und wird bewusst zur manuellen Bearbeitung übrig gelassen.\n\n*Siehe [Glossar](https://docs.arc42.org/section-12/) in der arc42-Dokumentation.*"
    ]
}

/*  --- shared layout helpers ---  */

const chapterHeader = (
    n: number, title: string, lang: Lang
): { md: string; html: string } => ({
    md:   `# ${n}. ${title}\n\n${HELP[lang][n - 1]}\n\n`,
    html: `<h1 id="${anchorId(n, title)}">${n}. ${escapeHtml(title)}</h1>\n` +
        `<div class="arc42-help">${markdownInlineToHtml(HELP[lang][n - 1])}</div>\n`
})

/*  bare minimum inline-markdown to HTML for the help blocks:
    paragraphs, bold *...*, links [text](url), and blockquote lines  */
const markdownInlineToHtml = (md: string): string => {
    const paras = md.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0)
    return paras.map((p) => {
        if (p.startsWith("> "))
            return `<blockquote>${inline(p.slice(2))}</blockquote>`
        return `<p>${inline(p)}</p>`
    }).join("\n")
}
const inline = (s: string): string =>
    escapeHtml(s)
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\">$1</a>")

const derivedHeader = (lang: Lang, fmt: "md" | "html"): string => {
    const label = strings[lang].derivedFromSource
    return fmt === "md" ?
        `### ${label}\n\n` :
        `<div class="derived">\n<h3>${escapeHtml(label)}</h3>\n`
}
const derivedFooter = (fmt: "md" | "html"): string =>
    fmt === "html" ? "</div>\n" : ""

const mdTable = (header: string[], rows: string[][]): string => {
    const sep = header.map(() => "---").join(" | ")
    const lines = [
        `| ${header.join(" | ")} |`,
        `| ${sep} |`,
        ...rows.map((r) => `| ${r.join(" | ")} |`)
    ]
    return lines.join("\n") + "\n\n"
}
const htmlTable = (header: string[], rows: string[][]): string => {
    const th = header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
    const tr = rows.map((r) =>
        `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("\n")
    return `<table><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table>\n`
}

const mermaidMd   = (src: string): string => `\n\`\`\`mermaid\n${src}\n\`\`\`\n\n`
const mermaidHtml = (src: string): string =>
    `<div class="diagram-frame"><div class="mermaid">${escapeHtml(src)}</div></div>\n`

/*  --- chapter renderers ---  */

const chap01 = (i: ChapterInput): ChapterOutput => {
    const { meta, lang } = i
    const s = strings[lang]
    const head = chapterHeader(1, chapterTitles(lang)[0], lang)
    const idRows: string[][] = []
    if (meta.name        !== undefined) idRows.push([ s.name,        meta.name ])
    if (meta.description !== undefined) idRows.push([ s.description, meta.description ])
    if (meta.version     !== undefined) idRows.push([ s.version,     meta.version ])
    const authors = meta.authors.slice(0, 10)
        .map((a) => [ a.name, String(a.commits) ])
    let md   = ""
    let html = ""
    if (idRows.length > 0) {
        md   += `**${s.projectIdentity}**\n\n` + mdTable([ s.metric, s.value ], idRows)
        html += `<h4>${escapeHtml(s.projectIdentity)}</h4>` + htmlTable([ s.metric, s.value ], idRows)
    }
    if (authors.length > 0) {
        md   += `**${s.commits}** (top contributors)\n\n` + mdTable([ s.name, s.commits ], authors)
        html += `<h4>${escapeHtml(s.commits)}</h4>` + htmlTable([ s.name, s.commits ], authors)
    }
    return {
        md:   head.md + (md.length > 0 ? derivedHeader(lang, "md") + md : ""),
        html: head.html + (html.length > 0 ? derivedHeader(lang, "html") + html + derivedFooter("html") : "")
    }
}

const chap02 = (i: ChapterInput): ChapterOutput => {
    const { api, meta, lang } = i
    const s = strings[lang]
    const head = chapterHeader(2, chapterTitles(lang)[1], lang)
    const langs = api.languages
    const runtime = meta.runtime ?? []
    const tools = meta.buildTools
    let md   = ""
    let html = ""
    if (langs.length > 0) {
        md   += `**${s.detectedLanguages}**: ${langs.join(", ")}\n\n`
        html += `<p><strong>${escapeHtml(s.detectedLanguages)}:</strong> ${escapeHtml(langs.join(", "))}</p>`
    }
    if (runtime.length > 0) {
        const rows = runtime.map((r) => [ r.name, r.version ])
        md   += `**${s.runtimeConstraints}**\n\n` + mdTable([ s.name, s.version ], rows)
        html += `<h4>${escapeHtml(s.runtimeConstraints)}</h4>` + htmlTable([ s.name, s.version ], rows)
    }
    if (tools.length > 0) {
        md   += `**${s.buildTools}**: ${tools.join(", ")}\n\n`
        html += `<p><strong>${escapeHtml(s.buildTools)}:</strong> ${escapeHtml(tools.join(", "))}</p>`
    }
    return {
        md:   head.md + (md.length > 0 ? derivedHeader(lang, "md") + md : ""),
        html: head.html + (html.length > 0 ? derivedHeader(lang, "html") + html + derivedFooter("html") : "")
    }
}

const chap03 = (i: ChapterInput): ChapterOutput => {
    const { api, lang, scope } = i
    const s = strings[lang]
    const head = chapterHeader(3, chapterTitles(lang)[2], lang)
    const filesByLang = new Map<string, number>()
    for (const f of api.files)
        filesByLang.set(f.language, (filesByLang.get(f.language) ?? 0) + 1)
    const rows = [ ...filesByLang.entries() ]
        .sort((a, b) => b[1] - a[1])
        .map(([ l, n ]) => [ l, String(n) ])
    const summary = [
        [ s.scope,     scope ],
        [ s.languages, api.languages.join(", ") ],
        [ s.files,     String(api.files.length) ],
        [ s.clusters,  String(api.clusters.length) ]
    ]
    let md = `**${s.scopeOverview}**\n\n` + mdTable([ s.metric, s.value ], summary)
    let html = `<h4>${escapeHtml(s.scopeOverview)}</h4>` + htmlTable([ s.metric, s.value ], summary)
    if (rows.length > 0) {
        md   += mdTable([ s.languages, s.files ], rows)
        html += htmlTable([ s.languages, s.files ], rows)
    }
    return {
        md:   head.md + derivedHeader(lang, "md") + md,
        html: head.html + derivedHeader(lang, "html") + html + derivedFooter("html")
    }
}

const chap04 = (i: ChapterInput): ChapterOutput =>
    chapterHeader(4, chapterTitles(i.lang)[3], i.lang)

const chap05 = (i: ChapterInput): ChapterOutput => {
    const { api, ctx, lang } = i
    const s = strings[lang]
    const head = chapterHeader(5, chapterTitles(lang)[4], lang)
    /*  cluster overview flowchart  */
    const fc = buildLayeredFlowchart(api, ctx.layerOfCluster, ctx.cycleReport)
    let md   = `### ${s.clusterOverview}\n\n` + mermaidMd(fc)
    let html = `<h3>${escapeHtml(s.clusterOverview)}</h3>` + mermaidHtml(fc)
    /*  per-cluster details  */
    md   += `### ${s.perClusterDetails}\n\n`
    html += `<h3>${escapeHtml(s.perClusterDetails)}</h3>`
    for (const cluster of api.clusters) {
        const cd = buildClassDiagram(cluster, ctx.allInScopeSymbols)
        md   += `#### ${escapeHtml(cluster.name)}\n\n${mermaidMd(cd)}` + perClusterSymbolsMd(cluster, s)
        html += `<h4>${escapeHtml(cluster.name)}</h4>${mermaidHtml(cd)}` + perClusterSymbolsHtml(cluster, s)
    }
    return {
        md:   head.md + derivedHeader(lang, "md") + md,
        html: head.html + derivedHeader(lang, "html") + html + derivedFooter("html")
    }
}

const perClusterSymbolsMd = (cluster: Cluster, s: StringSet): string => {
    const lines: string[] = []
    for (const sym of cluster.symbols) {
        if (sym.enclosingFqn !== null) continue
        const members = sym.members.filter((m) => !m.modifiers.includes("private"))
        if (members.length === 0) continue
        lines.push(`**${sym.name}**`)
        lines.push("")
        lines.push(mdTable(
            [ s.method, s.signature, s.description ],
            members.map((m) => [ m.name, "`" + m.signature + "`", m.doc ?? "" ])
        ))
    }
    return lines.join("\n") + "\n"
}

const perClusterSymbolsHtml = (cluster: Cluster, s: StringSet): string => {
    const parts: string[] = []
    for (const sym of cluster.symbols) {
        if (sym.enclosingFqn !== null) continue
        const members = sym.members.filter((m) => !m.modifiers.includes("private"))
        if (members.length === 0) continue
        parts.push(`<h5>${escapeHtml(sym.name)}</h5>`)
        parts.push(htmlTable(
            [ s.method, s.signature, s.description ],
            members.map((m) => [ m.name, m.signature, m.doc ?? "" ])
        ))
    }
    return parts.join("\n")
}

const chap06 = (i: ChapterInput): ChapterOutput => {
    const { api, ctx, lang } = i
    const s = strings[lang]
    const head = chapterHeader(6, chapterTitles(lang)[5], lang)
    const ms = mainSequenceMermaid(api.clusters, ctx.martin)
    if (ms === "")
        return head
    const md   = `### ${s.mainSequence}\n\n` + mermaidMd(ms)
    const html = `<h3>${escapeHtml(s.mainSequence)}</h3>` + mermaidHtml(ms)
    return {
        md:   head.md + derivedHeader(lang, "md") + md,
        html: head.html + derivedHeader(lang, "html") + html + derivedFooter("html")
    }
}

const chap07 = (i: ChapterInput): ChapterOutput => {
    const { meta, lang } = i
    const s = strings[lang]
    const head = chapterHeader(7, chapterTitles(lang)[6], lang)
    if (meta.deployment.length === 0) {
        return {
            md:   head.md + derivedHeader(lang, "md")   + `_${s.noDeploymentFound}_\n\n`,
            html: head.html + derivedHeader(lang, "html") + `<p><em>${escapeHtml(s.noDeploymentFound)}</em></p>` + derivedFooter("html")
        }
    }
    const rows = meta.deployment.map((d) => [ d.file, d.kind ])
    return {
        md:   head.md + derivedHeader(lang, "md")   + `### ${s.deploymentArtefacts}\n\n` + mdTable([ s.file, s.kind ], rows),
        html: head.html + derivedHeader(lang, "html") + `<h3>${escapeHtml(s.deploymentArtefacts)}</h3>` + htmlTable([ s.file, s.kind ], rows) + derivedFooter("html")
    }
}

const chap08 = (i: ChapterInput): ChapterOutput => {
    const { meta, lang } = i
    const s = strings[lang]
    const head = chapterHeader(8, chapterTitles(lang)[7], lang)
    const top = meta.dependencies
        .filter((d) => d.scope === "runtime")
        .slice(0, 10)
    if (top.length === 0)
        return head
    const rows = top.map((d) => [ d.name, d.version ?? "" ])
    return {
        md:   head.md + derivedHeader(lang, "md")   + `### ${s.topDependencies}\n\n` + mdTable([ s.name, s.version ], rows),
        html: head.html + derivedHeader(lang, "html") + `<h3>${escapeHtml(s.topDependencies)}</h3>` + htmlTable([ s.name, s.version ], rows) + derivedFooter("html")
    }
}

const chap09 = (i: ChapterInput): ChapterOutput => {
    const { meta, lang } = i
    const s = strings[lang]
    const head = chapterHeader(9, chapterTitles(lang)[8], lang)
    if (meta.adrFiles.length === 0) {
        return {
            md:   head.md + derivedHeader(lang, "md")   + `_${s.noAdrsFound}_\n\n`,
            html: head.html + derivedHeader(lang, "html") + `<p><em>${escapeHtml(s.noAdrsFound)}</em></p>` + derivedFooter("html")
        }
    }
    const rows = meta.adrFiles.map((a) => [ a.file, a.title ])
    return {
        md:   head.md + derivedHeader(lang, "md")   + `### ${s.architectureDecisions}\n\n` + mdTable([ s.file, s.title ], rows),
        html: head.html + derivedHeader(lang, "html") + `<h3>${escapeHtml(s.architectureDecisions)}</h3>` + htmlTable([ s.file, s.title ], rows) + derivedFooter("html")
    }
}

const chap10 = (i: ChapterInput): ChapterOutput => {
    const { ctx, lang } = i
    const s = strings[lang]
    const head = chapterHeader(10, chapterTitles(lang)[9], lang)
    const cov = ctx.docCovAggregate
    const cyclesN = ctx.cycleReport.cycles.length
    const instabilities = [ ...ctx.martin.values() ].map((m) => m.i).filter((v) => Number.isFinite(v))
    const avgI = instabilities.length > 0 ?
        (instabilities.reduce((a, b) => a + b, 0) / instabilities.length).toFixed(2) : "—"
    const rows: string[][] = [
        [ s.docCoverage,  `${cov.percent.toFixed(1)}% (${cov.documented}/${cov.total})` ],
        [ s.instability,  String(avgI) ],
        [ s.cycles,       String(cyclesN) ]
    ]
    return {
        md:   head.md + derivedHeader(lang, "md")   + `### ${s.qualityMetrics}\n\n` + mdTable([ s.metric, s.value ], rows),
        html: head.html + derivedHeader(lang, "html") + `<h3>${escapeHtml(s.qualityMetrics)}</h3>` + htmlTable([ s.metric, s.value ], rows) + derivedFooter("html")
    }
}

const chap11 = (i: ChapterInput): ChapterOutput => {
    const { api, ctx, lang } = i
    const s = strings[lang]
    const head = chapterHeader(11, chapterTitles(lang)[10], lang)
    let md   = ""
    let html = ""
    if (ctx.shortlist.length > 0) {
        md   += `### ${s.architecturalShortlist}\n\n` + shortlistMd(ctx.shortlist)
        html += `<h3>${escapeHtml(s.architecturalShortlist)}</h3>` + shortlistHtml(ctx.shortlist)
    }
    if (ctx.cycleReport.cycles.length > 0) {
        md   += `### ${s.cycleReport}\n\n` + cyclesMd(ctx.cycleReport)
        html += `<h3>${escapeHtml(s.cycleReport)}</h3>` + cyclesHtml(ctx.cycleReport)
    }
    else {
        md   += `_${s.noCyclesFound}_\n\n`
        html += `<p><em>${escapeHtml(s.noCyclesFound)}</em></p>`
    }
    if (api.docDebt.length > 0) {
        md   += `### ${s.documentationDebt}\n\n` + mdTable(
            [ s.name, s.file ],
            api.docDebt.slice(0, 50).map((d) => [ d.fqn, `${d.file}:${d.line}` ])
        )
        html += `<h3>${escapeHtml(s.documentationDebt)}</h3>` + htmlTable(
            [ s.name, s.file ],
            api.docDebt.slice(0, 50).map((d) => [ d.fqn, `${d.file}:${d.line}` ])
        )
    }
    return {
        md:   head.md + (md.length > 0 ? derivedHeader(lang, "md") + md : ""),
        html: head.html + (html.length > 0 ? derivedHeader(lang, "html") + html + derivedFooter("html") : "")
    }
}

const chap12 = (i: ChapterInput): ChapterOutput =>
    chapterHeader(12, chapterTitles(i.lang)[11], i.lang)

export const renderAllChapters = (i: ChapterInput): ChapterOutput[] => [
    chap01(i), chap02(i), chap03(i), chap04(i), chap05(i), chap06(i),
    chap07(i), chap08(i), chap09(i), chap10(i), chap11(i), chap12(i)
]
