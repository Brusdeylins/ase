/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  flat i18n lookup for tool-emitted strings (table headers, sub-section
    titles, footer attribution).  arc42 help texts themselves live inline
    in each chapter module; this file only carries the additional strings
    that the auto-fill content needs around the imported help text.  */

export type Lang = "de" | "en"

export interface StringSet {
    derivedFromSource: string
    /*  generic table headers  */
    name:        string
    description: string
    version:     string
    method:      string
    signature:   string
    commits:     string
    file:        string
    title:       string
    kind:        string
    value:       string
    /*  metric labels  */
    metric:      string
    coupling:    string
    instability: string
    abstractness:string
    docCoverage: string
    cycles:      string
    cluster:     string
    clusters:    string
    languages:   string
    files:       string
    symbols:     string
    /*  section titles  */
    projectIdentity:    string
    runtimeConstraints: string
    detectedLanguages:  string
    buildTools:         string
    scopeOverview:      string
    clusterOverview:    string
    perClusterDetails:  string
    deploymentArtefacts:string
    topDependencies:    string
    architectureDecisions: string
    qualityMetrics:     string
    documentationDebt:  string
    architecturalShortlist: string
    cycleReport:        string
    topFanIn:           string
    topFanOut:          string
    mainSequence:       string
    /*  fallback / empty-set notes  */
    noManifestDetected: string
    noAdrsFound:        string
    noDeploymentFound:  string
    noCyclesFound:      string
    /*  footer  */
    footerCreatedWith:  string
    /*  toc  */
    tableOfContents:    string
    /*  generated-at preamble  */
    generatedAt:        string
    scope:              string
}

const en: StringSet = {
    derivedFromSource:  "Derived from source code",
    name:               "Name",
    description:        "Description",
    version:            "Version",
    method:             "Method",
    signature:          "Signature",
    commits:            "Commits",
    file:               "File",
    title:              "Title",
    kind:               "Kind",
    value:              "Value",
    metric:             "Metric",
    coupling:           "Coupling",
    instability:        "Instability (I)",
    abstractness:       "Abstractness (A)",
    docCoverage:        "Doc coverage",
    cycles:             "Cycles",
    cluster:            "Cluster",
    clusters:           "Clusters",
    languages:          "Languages",
    files:              "Files",
    symbols:            "Symbols",
    projectIdentity:    "Project identity",
    runtimeConstraints: "Runtime constraints",
    detectedLanguages:  "Detected source languages",
    buildTools:         "Build tools",
    scopeOverview:      "Scope overview",
    clusterOverview:    "Cluster overview",
    perClusterDetails:  "Per-cluster details",
    deploymentArtefacts:"Deployment artefacts detected",
    topDependencies:    "Top dependencies",
    architectureDecisions: "Architecture decision records",
    qualityMetrics:     "Aggregated quality metrics",
    documentationDebt:  "Documentation debt",
    architecturalShortlist: "Architectural shortlist",
    cycleReport:        "Dependency cycle report",
    topFanIn:           "Top fan-in clusters",
    topFanOut:          "Top fan-out clusters",
    mainSequence:       "Martin main-sequence diagram",
    noManifestDetected: "No project manifest detected within the scope ancestry.",
    noAdrsFound:        "No architecture decision records found.",
    noDeploymentFound:  "No deployment artefacts detected.",
    noCyclesFound:      "No dependency cycles detected.",
    footerCreatedWith:  "created with",
    tableOfContents:    "Table of contents",
    generatedAt:        "Generated at",
    scope:              "Scope"
}

const de: StringSet = {
    derivedFromSource:  "Aus dem Quellcode abgeleitet",
    name:               "Name",
    description:        "Beschreibung",
    version:            "Version",
    method:             "Methode",
    signature:          "Signatur",
    commits:            "Commits",
    file:               "Datei",
    title:              "Titel",
    kind:               "Art",
    value:              "Wert",
    metric:             "Metrik",
    coupling:           "Kopplung",
    instability:        "Instabilität (I)",
    abstractness:       "Abstraktheit (A)",
    docCoverage:        "Dokumentations-Abdeckung",
    cycles:             "Zyklen",
    cluster:            "Cluster",
    clusters:           "Cluster",
    languages:          "Sprachen",
    files:              "Dateien",
    symbols:            "Symbole",
    projectIdentity:    "Projekt-Identität",
    runtimeConstraints: "Runtime-Anforderungen",
    detectedLanguages:  "Erkannte Quellcode-Sprachen",
    buildTools:         "Build-Werkzeuge",
    scopeOverview:      "Scope-Übersicht",
    clusterOverview:    "Cluster-Übersicht",
    perClusterDetails:  "Cluster im Detail",
    deploymentArtefacts:"Erkannte Deployment-Artefakte",
    topDependencies:    "Wichtigste Abhängigkeiten",
    architectureDecisions: "Architektur-Entscheidungsprotokolle (ADRs)",
    qualityMetrics:     "Aggregierte Qualitätsmetriken",
    documentationDebt:  "Dokumentations-Schulden",
    architecturalShortlist: "Architektur-Shortlist",
    cycleReport:        "Bericht zu Abhängigkeitszyklen",
    topFanIn:           "Cluster mit höchstem Fan-In",
    topFanOut:          "Cluster mit höchstem Fan-Out",
    mainSequence:       "Martin Main-Sequence-Diagramm",
    noManifestDetected: "Innerhalb des Scope-Stammbaums wurde kein Projekt-Manifest gefunden.",
    noAdrsFound:        "Keine Architektur-Entscheidungsprotokolle gefunden.",
    noDeploymentFound:  "Keine Deployment-Artefakte erkannt.",
    noCyclesFound:      "Keine Abhängigkeitszyklen erkannt.",
    footerCreatedWith:  "erstellt mit",
    tableOfContents:    "Inhaltsverzeichnis",
    generatedAt:        "Erstellt am",
    scope:              "Scope"
}

export const strings: Record<Lang, StringSet> = { en, de }
