import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, '..')
const outDir = join(root, 'public')
const statusPath = join(outDir, 'verify-status.json')

async function ensureOut() {
  await mkdir(outDir, { recursive: true })
}

async function runOnce() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const args = ['playwright', 'test', '--reporter=json']
    const child = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      let summary = {
        ok: false,
        code,
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
        failed: [],
        ts: new Date().toISOString(),
      }
      try {
        const json = JSON.parse(stdout || '{}')
        const suites = json.suites || []
        let total = 0, passed = 0, failed = 0, skipped = 0
        const failedList = []
        const walk = (s) => {
          ;(s.suites || []).forEach(walk)
          ;(s.tests || []).forEach((t) => {
            total++
            const r = t.results?.[0]
            const status = r?.status || t.status
            if (status === 'passed') passed++
            else if (status === 'skipped') skipped++
            else { failed++; failedList.push({ title: t.title, err: r?.error?.message || '' }) }
          })
        }
        suites.forEach(walk)
        summary.tests = { total, passed, failed, skipped }
        summary.failed = failedList
        summary.ok = failed === 0 && code === 0
      } catch (e) {
        summary.ok = false
        summary.failed = [{ title: 'json-parse', err: String(e) }]
      }
      if (stderr && !summary.ok) summary.failed.push({ title: 'stderr', err: stderr.slice(-4096) })
      resolve(summary)
    })
  })
}

async function writeStatus(s) {
  try { await ensureOut() } catch {}
  try { await writeFile(statusPath, JSON.stringify(s, null, 2)) } catch {}
}

async function loop() {
  // ensure browsers installed (best-effort)
  try {
    await new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
      const args = ['playwright', 'install', '--with-deps']
      const p = spawn(cmd, args, { cwd: root, stdio: 'ignore' })
      p.on('close', () => resolve(null))
    })
  } catch {}
  while (true) {
    const res = await runOnce()
    await writeStatus(res)
    // small idle delay
    await new Promise((r) => setTimeout(r, 4000))
  }
}

loop().catch((e) => {
  console.error('verify-loop fatal', e)
})
