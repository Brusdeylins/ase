/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Copyright (c) 2025-2026 Matthias Brusdeylins <matthias@brusdeylins.info>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  Project-metadata detector.  Walks upward from the user-supplied
    scope root, identifies the closest enclosing project marker
    (package.json / pom.xml / Cargo.toml / pyproject.toml / go.mod /
    build.gradle / *.csproj), parses what it finds with intentionally
    primitive heuristics (no full manifest parser), and additionally
    sniffs deployment artefacts, ADR folders, and git authors.  Used to
    auto-fill arc42 chapters 1, 2, 7, 8, 9.  Every field is optional
    because no single repository carries every signal.  */

import fs                   from "node:fs/promises"
import path                 from "node:path"
import { execFile }         from "node:child_process"
import { promisify }        from "node:util"

const execFileP = promisify(execFile)

export interface ProjectMeta {
    /*  resolved root directory we treat as project home (may equal scope)  */
    projectRoot:  string
    /*  manifest type detected (used for chapter-2 build-tool listing)  */
    manifestType: ManifestType | null
    /*  human-facing project identity  */
    name?:        string
    description?: string
    version?:     string
    /*  runtime constraints from engines/required-version fields  */
    runtime?:     { name: string; version: string }[]
    /*  primary build tool (npm/stx, mvn/gradle, cargo, pip/poetry, go, msbuild)  */
    buildTools:   string[]
    /*  top dependencies (typically 10 strongest), with optional version  */
    dependencies: { name: string; version?: string; scope?: "runtime" | "dev" }[]
    /*  top git commit authors, format: "Name <email>"  */
    authors:      { name: string; commits: number }[]
    /*  deployment artefacts found in the repo  */
    deployment:   { file: string; kind: DeploymentKind }[]
    /*  architecture-decision-record files found, with first-H1 title  */
    adrFiles:     { file: string; title: string }[]
}

export type ManifestType =
    "package.json" | "pom.xml" | "build.gradle" | "Cargo.toml" |
    "pyproject.toml" | "go.mod" | "csproj"

export type DeploymentKind =
    "Dockerfile" | "docker-compose" | "github-actions" | "gitlab-ci" |
    "circleci" | "azure-pipelines" | "Procfile" | "serverless" | "helm-chart" |
    "kubernetes-manifest" | "terraform"

/*  ordered list: more specific manifests first  */
const MANIFEST_FILES: { file: string; type: ManifestType }[] = [
    { file: "package.json",     type: "package.json" },
    { file: "pom.xml",          type: "pom.xml" },
    { file: "build.gradle.kts", type: "build.gradle" },
    { file: "build.gradle",     type: "build.gradle" },
    { file: "Cargo.toml",       type: "Cargo.toml" },
    { file: "pyproject.toml",   type: "pyproject.toml" },
    { file: "go.mod",           type: "go.mod" }
]

const ADR_DIRS = [
    "docs/adr", "doc/adr", "adr", "decisions", "docs/decisions"
]

/*  walk up from `scopeRoot` to find the nearest directory carrying
    one of the known manifests; cap at 6 ancestors  */
const findProjectRoot = async (
    scopeRoot: string
): Promise<{ root: string; manifest: { file: string; type: ManifestType } | null }> => {
    let dir = path.resolve(scopeRoot)
    for (let i = 0; i < 6; i++) {
        for (const m of MANIFEST_FILES)
            if (await fileExists(path.join(dir, m.file)))
                return { root: dir, manifest: m }
        /*  also accept any *.csproj at this level  */
        try {
            const entries = await fs.readdir(dir)
            const csproj  = entries.find((e) => e.endsWith(".csproj"))
            if (csproj !== undefined)
                return { root: dir, manifest: { file: csproj, type: "csproj" } }
        }
        catch {}
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return { root: scopeRoot, manifest: null }
}

const fileExists = async (p: string): Promise<boolean> => {
    try {
        await fs.stat(p)
        return true
    }
    catch { return false }
}

/*  --- manifest parsers (best-effort, no full schema validation) ---  */

const parsePackageJson = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw  = await fs.readFile(file, "utf8")
        const json = JSON.parse(raw) as Record<string, unknown>
        const deps: ProjectMeta["dependencies"] = []
        const runtime: ProjectMeta["runtime"]   = []
        const collect = (obj: unknown, scope: "runtime" | "dev"): void => {
            if (obj === null || typeof obj !== "object") return
            for (const [ k, v ] of Object.entries(obj as Record<string, unknown>))
                deps.push({ name: k, version: String(v), scope })
        }
        collect(json.dependencies,    "runtime")
        collect(json.devDependencies, "dev")
        if (typeof json.engines === "object" && json.engines !== null)
            for (const [ k, v ] of Object.entries(json.engines as Record<string, unknown>))
                runtime.push({ name: k, version: String(v) })
        const buildTools: string[] = []
        if (typeof json.scripts === "object" && json.scripts !== null) {
            const scripts = json.scripts as Record<string, unknown>
            if (typeof scripts.start === "string" && /stx/i.test(scripts.start))
                buildTools.push("stx")
            buildTools.push("npm")
        }
        return {
            name:         typeof json.name        === "string" ? json.name        : undefined,
            description:  typeof json.description === "string" ? json.description : undefined,
            version:      typeof json.version     === "string" ? json.version     : undefined,
            runtime,
            dependencies: deps,
            buildTools
        }
    }
    catch { return {} }
}

const parsePomXml = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw  = await fs.readFile(file, "utf8")
        const pick = (tag: string): string | undefined => {
            const m = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(raw)
            return m !== null ? m[1].trim() : undefined
        }
        const deps: ProjectMeta["dependencies"] = []
        const re = /<dependency>([\s\S]*?)<\/dependency>/g
        let m: RegExpExecArray | null
        while ((m = re.exec(raw)) !== null) {
            const block = m[1]
            const g = /<groupId>([^<]+)<\/groupId>/.exec(block)?.[1]
            const a = /<artifactId>([^<]+)<\/artifactId>/.exec(block)?.[1]
            const v = /<version>([^<]+)<\/version>/.exec(block)?.[1]
            const s = /<scope>([^<]+)<\/scope>/.exec(block)?.[1]
            if (a !== undefined)
                deps.push({
                    name:    g !== undefined ? `${g}:${a}` : a,
                    version: v,
                    scope:   s === "test" || s === "provided" ? "dev" : "runtime"
                })
        }
        return {
            name:         pick("artifactId"),
            description:  pick("description"),
            version:      pick("version"),
            dependencies: deps,
            buildTools:   [ "maven" ]
        }
    }
    catch { return {} }
}

const parseCargoToml = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw = await fs.readFile(file, "utf8")
        const pick = (key: string): string | undefined => {
            const m = new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m").exec(raw)
            return m !== null ? m[1] : undefined
        }
        const deps: ProjectMeta["dependencies"] = []
        /*  naive: walks lines between [dependencies] and the next [section]  */
        const depBlock = /\[dependencies\]([\s\S]*?)(?=\n\[|$)/.exec(raw)?.[1] ?? ""
        for (const line of depBlock.split("\n")) {
            const m = /^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/.exec(line.trim())
            if (m !== null) deps.push({ name: m[1], version: m[2], scope: "runtime" })
        }
        const devBlock = /\[dev-dependencies\]([\s\S]*?)(?=\n\[|$)/.exec(raw)?.[1] ?? ""
        for (const line of devBlock.split("\n")) {
            const m = /^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/.exec(line.trim())
            if (m !== null) deps.push({ name: m[1], version: m[2], scope: "dev" })
        }
        return {
            name:         pick("name"),
            description:  pick("description"),
            version:      pick("version"),
            dependencies: deps,
            buildTools:   [ "cargo" ]
        }
    }
    catch { return {} }
}

const parsePyprojectToml = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw = await fs.readFile(file, "utf8")
        const pick = (key: string): string | undefined => {
            const m = new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m").exec(raw)
            return m !== null ? m[1] : undefined
        }
        const deps: ProjectMeta["dependencies"] = []
        const arr = /^dependencies\s*=\s*\[([\s\S]*?)\]/m.exec(raw)?.[1] ?? ""
        for (const line of arr.split(",")) {
            const m = /"([^"]+)"/.exec(line)
            if (m !== null) deps.push({ name: m[1], scope: "runtime" })
        }
        return {
            name:         pick("name"),
            description:  pick("description"),
            version:      pick("version"),
            dependencies: deps,
            buildTools:   /\[tool\.poetry\]/.test(raw) ? [ "poetry" ] : [ "pip" ]
        }
    }
    catch { return {} }
}

const parseGoMod = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw = await fs.readFile(file, "utf8")
        const modLine  = /^module\s+(\S+)/m.exec(raw)?.[1]
        const goLine   = /^go\s+(\S+)/m.exec(raw)?.[1]
        const deps: ProjectMeta["dependencies"] = []
        const block = /^require\s*\(([\s\S]*?)\)/m.exec(raw)?.[1] ?? ""
        for (const line of block.split("\n")) {
            const m = /^\s*(\S+)\s+(\S+)/.exec(line)
            if (m !== null) deps.push({ name: m[1], version: m[2], scope: "runtime" })
        }
        return {
            name:         modLine,
            runtime:      goLine !== undefined ? [ { name: "go", version: goLine } ] : undefined,
            dependencies: deps,
            buildTools:   [ "go" ]
        }
    }
    catch { return {} }
}

const parseBuildGradle = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw  = await fs.readFile(file, "utf8")
        const pick = (key: string): string | undefined => {
            const m = new RegExp(`(?:^|\\s)${key}\\s*=?\\s*["']([^"']+)["']`, "m").exec(raw)
            return m !== null ? m[1] : undefined
        }
        return {
            name:        pick("rootProject\\.name") ?? pick("group"),
            version:     pick("version"),
            buildTools:  [ "gradle" ],
            /*  dep parsing in gradle would need a real parser; keep it empty for now  */
            dependencies: []
        }
    }
    catch { return {} }
}

const parseCsproj = async (file: string): Promise<Partial<ProjectMeta>> => {
    try {
        const raw  = await fs.readFile(file, "utf8")
        const pick = (tag: string): string | undefined => {
            const m = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(raw)
            return m !== null ? m[1].trim() : undefined
        }
        const deps: ProjectMeta["dependencies"] = []
        const re = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g
        let m: RegExpExecArray | null
        while ((m = re.exec(raw)) !== null)
            deps.push({ name: m[1], version: m[2], scope: "runtime" })
        return {
            name:         pick("AssemblyName") ?? path.basename(file, ".csproj"),
            description:  pick("Description"),
            version:      pick("Version"),
            runtime:      pick("TargetFramework") !== undefined ?
                [ { name: ".NET", version: pick("TargetFramework")! } ] : undefined,
            dependencies: deps,
            buildTools:   [ "dotnet" ]
        }
    }
    catch { return {} }
}

const parseManifest = async (
    root: string, m: { file: string; type: ManifestType } | null
): Promise<Partial<ProjectMeta>> => {
    if (m === null) return {}
    const full = path.join(root, m.file)
    switch (m.type) {
        case "package.json":    return parsePackageJson(full)
        case "pom.xml":         return parsePomXml(full)
        case "build.gradle":    return parseBuildGradle(full)
        case "Cargo.toml":      return parseCargoToml(full)
        case "pyproject.toml":  return parsePyprojectToml(full)
        case "go.mod":          return parseGoMod(full)
        case "csproj":          return parseCsproj(full)
    }
}

/*  --- deployment-artefact sniffer ---  */

const detectDeployment = async (root: string): Promise<ProjectMeta["deployment"]> => {
    const out: ProjectMeta["deployment"] = []
    const check = async (rel: string, kind: DeploymentKind): Promise<void> => {
        if (await fileExists(path.join(root, rel))) out.push({ file: rel, kind })
    }
    await check("Dockerfile",          "Dockerfile")
    await check("docker-compose.yml",  "docker-compose")
    await check("docker-compose.yaml", "docker-compose")
    await check(".gitlab-ci.yml",      "gitlab-ci")
    await check(".circleci/config.yml", "circleci")
    await check("azure-pipelines.yml", "azure-pipelines")
    await check("Procfile",            "Procfile")
    await check("serverless.yml",      "serverless")
    /*  github-actions: list every workflow file individually  */
    const wfDir = path.join(root, ".github", "workflows")
    try {
        const entries = await fs.readdir(wfDir)
        for (const f of entries)
            if (f.endsWith(".yml") || f.endsWith(".yaml"))
                out.push({ file: path.join(".github/workflows", f), kind: "github-actions" })
    }
    catch {}
    /*  helm: any Chart.yaml under the repo  */
    if (await fileExists(path.join(root, "Chart.yaml")))
        out.push({ file: "Chart.yaml", kind: "helm-chart" })
    return out
}

/*  --- ADR scanner ---  */

const findAdrFiles = async (root: string): Promise<ProjectMeta["adrFiles"]> => {
    const out: ProjectMeta["adrFiles"] = []
    for (const rel of ADR_DIRS) {
        const dir = path.join(root, rel)
        const entries = await fs.readdir(dir).catch(() => null)
        if (entries === null) continue
        for (const f of entries) {
            if (!f.endsWith(".md")) continue
            const full = path.join(dir, f)
            let title  = f.replace(/\.md$/, "")
            try {
                const raw = await fs.readFile(full, "utf8")
                const m   = /^#\s+(.+)$/m.exec(raw)
                if (m !== null) title = m[1].trim()
            }
            catch {}
            out.push({ file: path.join(rel, f), title })
        }
    }
    return out
}

/*  --- git author collection ---  */

const collectAuthors = async (root: string): Promise<ProjectMeta["authors"]> => {
    try {
        const { stdout } = await execFileP("git",
            [ "-C", root, "shortlog", "-sn", "--no-merges", "HEAD" ],
            { maxBuffer: 1024 * 1024 })
        const out: ProjectMeta["authors"] = []
        for (const line of stdout.split("\n")) {
            const m = /^\s*(\d+)\s+(.+)$/.exec(line)
            if (m !== null) out.push({ name: m[2].trim(), commits: Number(m[1]) })
        }
        return out
    }
    catch { return [] }
}

/*  --- public entry point ---  */

export const collectProjectMeta = async (scopeRoot: string): Promise<ProjectMeta> => {
    const { root, manifest } = await findProjectRoot(scopeRoot)
    const partial = await parseManifest(root, manifest)
    const [ deployment, adrFiles, authors ] = await Promise.all([
        detectDeployment(root),
        findAdrFiles(root),
        collectAuthors(root)
    ])
    return {
        projectRoot:  root,
        manifestType: manifest?.type ?? null,
        name:         partial.name,
        description:  partial.description,
        version:      partial.version,
        runtime:      partial.runtime,
        buildTools:   partial.buildTools ?? [],
        dependencies: partial.dependencies ?? [],
        authors,
        deployment,
        adrFiles
    }
}
