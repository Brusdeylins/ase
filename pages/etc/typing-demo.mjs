/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  Record the <TypingDemo/> capture composition as an animated GIF.
    - a prior "npm start build" (or this script runs it on demand)
    - playwright installed (npm i -D playwright && npx playwright install chromium)
    - ffmpeg available on PATH  */

import fs                from "node:fs/promises"
import { existsSync }    from "node:fs"
import path              from "node:path"
import { fileURLToPath } from "node:url"
import { spawn }         from "node:child_process"
import { chromium }      from "playwright"

/*  parse a minimal set of "--key value" options.  */
const argv = process.argv.slice(2)
const opt  = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return (i >= 0 && i + 1 < argv.length) ? argv[i + 1] : fallback
}

const port = parseInt(opt("port", "4399"), 10)
const fps  = parseInt(opt("fps",  "10"),   10)
const url  = `http://localhost:${port}/typing-demo`

const here     = path.dirname(fileURLToPath(import.meta.url))
const root     = path.resolve(here, "..")
const tmpDir   = path.join(root, "dst", "video")
const outFile  = path.resolve(root, opt("out", "public/assets/typing-demo.gif"))
const outFile2 = path.resolve(root, opt("out2", "public/assets/typing-demo.mp4"))

/*  the capture viewport  */
const width  = 1000
const height = 220

/*  run a child process to completion, inheriting stdio.  */
const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts })
    child.on("error", reject)
    child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)))
})

/*  poll a URL until it answers or a timeout elapses.  */
const waitForServer = async (probe, timeoutMs) => {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(probe)
            if (res.ok)
                return
        }
        catch {
            /*  server not up yet  */
        }
        await new Promise((r) => setTimeout(r, 300))
    }
    throw new Error(`server at ${probe} did not come up within ${timeoutMs}ms`)
}

await fs.mkdir(tmpDir,                { recursive: true })
await fs.mkdir(path.dirname(outFile), { recursive: true })

/*  ensure a production build exists for "astro preview" to serve.  */
if (!existsSync(path.join(root, "dst", "typing-demo", "index.html"))) {
    console.log("building site (no dst/ build found) ...")
    await run("npx", [ "astro", "build", "--config", "etc/astro.config.mjs" ], { cwd: root })
}

/*  refuse to run against a foreign or stale leftover server, as it would
    silently serve an outdated build while our own preview fails to bind.  */
const occupied = await fetch(url, { signal: AbortSignal.timeout(1000) })
    .then(()  => true)
    .catch(() => false)
if (occupied)
    throw new Error(`port ${port} is already served by another process ` +
        `(possibly a stale "astro preview" of an earlier run): stop it or pass --port`)

/*  start a self-contained preview server. It is detached to become the
    leader of its own process group, as the spawned "npx" is merely a
    wrapper around the actual "astro preview" grandchild process.  */
console.log(`starting preview server on port ${port} ...`)
const server = spawn("npx",
    [ "astro", "preview", "--config", "etc/astro.config.mjs", "--port", String(port) ],
    { cwd: root, stdio: "ignore", detached: true })

/*  stop the preview server and its entire process group, as signalling
    just the "npx" wrapper would leave the "astro preview" grandchild
    behind as an orphan still holding the port.  */
const stopServer = async (child) => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null)
        return
    const exited = new Promise((resolve) => child.once("exit", resolve))
    const signal = (sig) => {
        try {
            process.kill(-child.pid, sig)
        }
        catch {
            /*  no process group (or unsupported): fall back to the wrapper  */
            try {
                child.kill(sig)
            }
            catch {
                /*  already gone  */
            }
        }
    }
    signal("SIGTERM")
    const timer = setTimeout(() => signal("SIGKILL"), 5000)
    await exited
    clearTimeout(timer)
}

/*  also stop the preview server on interactive aborts, as the "finally"
    block below does not run on a signal-driven process exit.  */
for (const sig of [ "SIGINT", "SIGTERM" ])
    process.once(sig, async () => {
        await stopServer(server)
        process.exit(1)
    })

let webm
try {
    await waitForServer(url, 30000)

    console.log(`recording ${url} ...`)
    const browser = await chromium.launch()
    const context = await browser.newContext({
        viewport:          { width, height },
        deviceScaleFactor: 2,
        /*  the video size MUST match the viewport (see note above); a
            higher deviceScaleFactor yields a crisper recording without
            changing the captured layout.  */
        recordVideo:       { dir: tmpDir, size: { width, height } }
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: "domcontentloaded" })

    /*  Bound the capture to exactly one full loop, ending on the LAST
        command fully typed -- never letting the first command be typed a
        second time (which previously left a duplicate at the tail).

        The typed body cycles: it grows while a command types, pauses fully
        shown (backDelay), then shrinks to ~empty while it erases. Each such
        settled "peak" is one completed command. We know how many commands
        the page cycles through (read from the DOM), so we count peaks and
        cut during the Nth command's on-screen pause -- fully shown, before
        it erases and the first command would be typed a second time.  */
    const typed   = page.locator("#hero-typed")
    const total   = await page.evaluate(() => {
        const el = document.querySelector(".hero-prompt")
        const n  = Number(el?.getAttribute("data-count")) || 0
        /*  data-count 0 means "all commands"; fall back to a large cap  */
        return n > 0 ? n : 999
    })
    const started = Date.now()
    const hardMs  = 120000
    let   prevLen = 0
    let   stable  = 0
    let   peaks   = 0
    while (Date.now() - started < hardMs) {
        await page.waitForTimeout(120)
        const len = (await typed.textContent())?.length ?? 0
        if (len > 0 && len === prevLen)
            stable += 120
        else
            stable = 0
        prevLen = len

        /*  A fully-typed command pauses on screen for the full backDelay
            (5s) before erasing. Require ~2s of unchanging, non-empty length
            so typing micro-stalls (e.g. line wraps) are not mistaken for a
            completed command. That settled state IS the on-screen pause.  */
        if (stable >= 2000 && len > 0) {
            peaks++
            if (peaks >= total)
                /*  Nth (last) command is fully shown; cut now, mid-pause  */
                break
            /*  wait out the rest of this command's pause + its erase so the
                next poll lands on the following command, not this peak  */
            await page.waitForTimeout(3500)
            stable = 0
        }
    }

    await context.close()   /*  flushes the .webm to disk  */
    await browser.close()

    /*  Playwright names the video file unpredictably; pick the newest.  */
    const files = (await fs.readdir(tmpDir))
        .filter((f) => f.endsWith(".webm"))
        .map((f) => path.join(tmpDir, f))
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(f)).mtimeMs })))
    webm = stats.sort((a, b) => b.t - a.t)[0]?.f
    if (!webm)
        throw new Error(`no .webm produced in ${tmpDir}`)
}
finally {
    await stopServer(server)
}

const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`

console.log(`transcoding ${path.basename(webm)} -> ${path.relative(root, outFile)} ...`)
await run("ffmpeg", [
    "-y",
    "-i",      webm,
    "-vf",     `${filters},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer`,
    "-loop",   "0",
    outFile
])

console.log(`transcoding ${path.basename(webm)} -> ${path.relative(root, outFile2)} ...`)
await run("ffmpeg", [
    "-y",
    "-i",      webm,
    "-vf",     `${filters}`,
    outFile2
])

await fs.unlink(webm)
