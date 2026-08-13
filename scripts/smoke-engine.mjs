import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HarnessEngine } from '../dist/engine.js'

const temporary = await mkdtemp(join(tmpdir(), 'dsh-desktop-smoke-'))
const engine = new HarnessEngine({
  appPath: process.cwd(),
  resourcesPath: process.cwd(),
  packaged: false,
  userDataPath: temporary,
  logPath: join(temporary, 'logs', 'harness.log'),
})

try {
  const ready = await engine.start()
  const response = await fetch(ready.url)
  if (response.status >= 500) throw new Error(`Harness returned HTTP ${response.status}`)
  process.stdout.write(`ENGINE_SMOKE_OK version=${engine.version} status=${response.status} pid=${ready.pid}\n`)
} finally {
  await engine.stop()
  await rm(temporary, { recursive: true, force: true })
}

