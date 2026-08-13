import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { delimiter, dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { EventEmitter, once } from 'node:events'

const require = createRequire(import.meta.url)
const START_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 5_000

export interface RuntimeLocationOptions {
  packaged: boolean
  resourcesPath: string
  appPath: string
  platform?: NodeJS.Platform | undefined
  arch?: string | undefined
}

export interface HarnessEngineOptions {
  appPath: string
  resourcesPath: string
  packaged: boolean
  userDataPath: string
  logPath: string
  platform?: NodeJS.Platform | undefined
  arch?: string | undefined
}

export interface EngineReadyInfo {
  url: string
  port: number
  pid: number
}

export function runtimePath(options: RuntimeLocationOptions): string {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const executable = platform === 'win32' ? 'node.exe' : 'node'
  return options.packaged
    ? join(options.resourcesPath, 'runtime', executable)
    : join(options.appPath, '.runtime', `${platform}-${arch}`, executable)
}

export function engineEntryPath(options?: Pick<RuntimeLocationOptions, 'packaged' | 'resourcesPath'>): string {
  if (options?.packaged) {
    return join(options.resourcesPath, 'app.asar.unpacked', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  }
  const packagePath = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(packagePath), 'lib', 'bin.js')
}

export function installedEngineVersion(): string {
  const packagePath = require.resolve('@deepseek-ai/dsh/package.json')
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) return 'unknown'
  return manifest.version
}

export function engineArguments(port: number, entryPath = engineEntryPath()): string[] {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new RangeError(`Invalid port: ${port}`)
  return [entryPath, 'web', '--host', '127.0.0.1', '--port', String(port)]
}

export async function reserveLoopbackPort(): Promise<number> {
  const server = createServer()
  server.unref()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Unable to reserve a loopback port')
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return Promise.race([
    once(child, 'exit').then(() => true),
    delay(timeoutMs).then(() => false),
  ])
}

async function waitForHttp(url: string, child: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS
  let lastError = 'server did not respond'
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Harness exited during startup (code ${child.exitCode ?? 'none'}, signal ${child.signalCode ?? 'none'})`)
    }
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(1_500),
      })
      if (response.status < 500) {
        await delay(1_000)
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`Harness exited during startup (code ${child.exitCode ?? 'none'}, signal ${child.signalCode ?? 'none'})`)
        }
        const confirmation = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(1_500),
        })
        if (confirmation.status < 500) return
        lastError = `HTTP ${confirmation.status}`
        continue
      }
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await delay(250)
  }
  throw new Error(`Harness startup timed out: ${lastError}`)
}

export class HarnessEngine extends EventEmitter {
  readonly version = installedEngineVersion()
  private child: ChildProcessWithoutNullStreams | undefined
  private ready: EngineReadyInfo | undefined
  private stopping = false
  private startPromise: Promise<EngineReadyInfo> | undefined

  constructor(private readonly options: HarnessEngineOptions) {
    super()
  }

  get info(): EngineReadyInfo | undefined {
    return this.ready
  }

  start(): Promise<EngineReadyInfo> {
    if (this.ready !== undefined) return Promise.resolve(this.ready)
    if (this.startPromise !== undefined) return this.startPromise
    this.startPromise = this.startInternal().finally(() => { this.startPromise = undefined })
    return this.startPromise
  }

  private async startInternal(): Promise<EngineReadyInfo> {
    const nodePath = runtimePath({
      packaged: this.options.packaged,
      resourcesPath: this.options.resourcesPath,
      appPath: this.options.appPath,
      platform: this.options.platform,
      arch: this.options.arch,
    })
    if (!existsSync(nodePath)) throw new Error(`Bundled Node.js runtime is missing: ${nodePath}`)

    const homePath = join(this.options.userDataPath, 'harness')
    mkdirSync(homePath, { recursive: true })
    mkdirSync(dirname(this.options.logPath), { recursive: true })
    const port = await reserveLoopbackPort()
    const output = createWriteStream(this.options.logPath, { flags: 'a' })
    output.write(`\n[DSH-Desktop] Starting Harness ${this.version} on 127.0.0.1:${port}\n`)

    this.stopping = false
    const entryPath = engineEntryPath({
      packaged: this.options.packaged,
      resourcesPath: this.options.resourcesPath,
    })
    if (!existsSync(entryPath)) throw new Error(`Harness engine is missing: ${entryPath}`)

    const child = spawn(nodePath, engineArguments(port, entryPath), {
      cwd: homePath,
      env: {
        ...process.env,
        DSH_HOME: homePath,
        PATH: `${dirname(nodePath)}${delimiter}${process.env.PATH ?? ''}`,
      },
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    child.stdout.pipe(output, { end: false })
    child.stderr.pipe(output, { end: false })
    child.once('error', error => output.write(`[DSH-Desktop] Process error: ${error.message}\n`))
    child.once('exit', (code, signal) => {
      output.write(`[DSH-Desktop] Harness exited (code ${code ?? 'none'}, signal ${signal ?? 'none'})\n`)
      output.end()
      this.child = undefined
      this.ready = undefined
      if (!this.stopping) this.emit('unexpected-exit', { code, signal })
    })

    const url = `http://127.0.0.1:${port}/`
    try {
      await waitForHttp(url, child)
    } catch (error) {
      await this.stop()
      throw error
    }
    if (child.pid === undefined) throw new Error('Harness started without a process id')
    this.ready = { url, port, pid: child.pid }
    return this.ready
  }

  async restart(): Promise<EngineReadyInfo> {
    await this.stop()
    return this.start()
  }

  async stop(): Promise<void> {
    const child = this.child
    this.ready = undefined
    if (child === undefined) return
    this.stopping = true

    if (process.platform === 'win32') {
      const taskkill = spawn('taskkill', ['/PID', String(child.pid), '/T'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      await Promise.race([once(taskkill, 'exit'), delay(2_000)])
    } else if (child.pid !== undefined) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
    }

    const exited = await waitForExit(child, STOP_TIMEOUT_MS)
    if (!exited) {
      if (process.platform === 'win32') {
        const taskkill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
        await Promise.race([once(taskkill, 'exit'), delay(2_000)])
      } else if (child.pid !== undefined) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
      }
      await waitForExit(child, 2_000)
    }
    this.child = undefined
  }
}
