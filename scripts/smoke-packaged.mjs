import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function packagedExecutable() {
  if (process.platform === 'win32') return join('release', 'win-unpacked', 'DSH-Desktop.exe')
  if (process.platform !== 'darwin') throw new Error(`Unsupported packaged smoke-test platform: ${process.platform}`)

  const entries = await readdir('release', { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('mac')) continue
    const candidate = join('release', entry.name, 'DSH-Desktop.app', 'Contents', 'MacOS', 'DSH-Desktop')
    if (existsSync(candidate)) return candidate
  }
  throw new Error('Packaged macOS application was not found')
}

const executable = await packagedExecutable()
if (!existsSync(executable)) throw new Error(`Packaged application was not found: ${executable}`)

const marker = join(tmpdir(), `dsh-desktop-smoke-${process.pid}-${Date.now()}.json`)
await rm(marker, { force: true })

const child = spawn(executable, ['--smoke-test'], {
  env: { ...process.env, DSH_DESKTOP_SMOKE_RESULT: marker },
  stdio: 'inherit',
  windowsHide: true,
})

const exitCode = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error('Packaged desktop smoke test timed out'))
  }, 90_000)
  child.once('error', error => {
    clearTimeout(timer)
    reject(error)
  })
  child.once('exit', code => {
    clearTimeout(timer)
    resolve(code)
  })
})

if (!existsSync(marker)) throw new Error(`Packaged desktop exited with code ${exitCode} without a smoke-test result`)
const result = JSON.parse(await readFile(marker, 'utf8'))
await rm(marker, { force: true })
if (exitCode !== 0 || result.status !== 'ok') throw new Error(result.detail ?? `Packaged desktop exited with code ${exitCode}`)
process.stdout.write(`PACKAGED_SMOKE_OK ${result.detail}\n`)
