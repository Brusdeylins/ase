import { test } from "node:test"
import { strict as assert } from "node:assert"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"

const ROOT = path.join(import.meta.dirname, "..", "..")
const FIX  = path.join(ROOT, "test", "ase-arch-report", "fixtures", "ts-mini", "src")
const OUT  = path.join(ROOT, "..", ".cli-test-output")
const BIN  = path.join(ROOT, "dst", "ase.js")

const runCli = (...args: string[]): Promise<{ stdout: string; code: number }> =>
    new Promise((resolve, reject) => {
        const p = spawn(process.execPath, [ BIN, ...args ], { stdio: [ "ignore", "pipe", "inherit" ] })
        let stdout = ""
        p.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
        p.on("close", (code) => resolve({ stdout, code: code ?? 0 }))
        p.on("error", reject)
    })

test("cli: --format=both emits both Report: lines", async (t) => {
    await fs.rm(OUT, { recursive: true, force: true })
    t.after(() => fs.rm(OUT, { recursive: true, force: true }))
    const { stdout, code } = await runCli("arch-report", FIX, "--format=both", `--output=${OUT}`)
    assert.equal(code, 0)
    assert.match(stdout, /Report: .+\/index\.md/)
    assert.match(stdout, /Report: .+\/index\.html/)
})

test("cli: --format=md emits only md Report: line", async (t) => {
    await fs.rm(OUT, { recursive: true, force: true })
    t.after(() => fs.rm(OUT, { recursive: true, force: true }))
    const { stdout, code } = await runCli("arch-report", FIX, "--format=md", `--output=${OUT}`)
    assert.equal(code, 0)
    assert.match(stdout, /Report: .+\/index\.md/)
    assert.doesNotMatch(stdout, /index\.html/)
})

test("cli: --format=html emits only html Report: line", async (t) => {
    await fs.rm(OUT, { recursive: true, force: true })
    t.after(() => fs.rm(OUT, { recursive: true, force: true }))
    const { stdout, code } = await runCli("arch-report", FIX, "--format=html", `--output=${OUT}`)
    assert.equal(code, 0)
    assert.match(stdout, /Report: .+\/index\.html/)
    assert.doesNotMatch(stdout, /index\.md/)
})
