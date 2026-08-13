import { createHash } from 'node:crypto'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const NODE_VERSION = 'v24.19.0'
const NODE_LICENSE_SHA256 = '148eacf7863ef4329224a29398623077200a27194aa075569faf4a0a85566ca5'
const args = new Map(process.argv.slice(2).map(value => value.split('=', 2)))
const platform = args.get('--platform') || process.platform
const arch = args.get('--arch') || process.arch

if (!['win32', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
  throw new Error(`Unsupported runtime target: ${platform}-${arch}`)
}
if (platform === 'win32' && arch !== 'x64') {
  throw new Error('The initial DSH-Desktop release supports Windows x64 only')
}

const projectRoot = new URL('../', import.meta.url)
const outputDir = new URL(`.runtime/${platform}-${arch}/`, projectRoot)
const executable = new URL(platform === 'win32' ? 'node.exe' : 'node', outputDir)
const marker = new URL('runtime.json', outputDir)

try {
  const current = JSON.parse(await readFile(marker, 'utf8'))
  await readFile(executable)
  if (current.version === NODE_VERSION && current.platform === platform && current.arch === arch) {
    process.stdout.write(`Node runtime ${NODE_VERSION} already prepared for ${platform}-${arch}\n`)
    process.exit(0)
  }
} catch {}

await mkdir(outputDir, { recursive: true })
const baseUrls = [
  `https://registry.npmmirror.com/-/binary/node/${NODE_VERSION}`,
  `https://nodejs.org/dist/${NODE_VERSION}`,
]
const sums = (await downloadAny('SHASUMS256.txt')).toString('utf8')

if (platform === 'win32') {
  const relative = `win-${arch}/node.exe`
  const hash = expectedHash(sums, relative)
  let binary
  try {
    binary = await readFile(executable)
    verify(binary, hash, relative)
    process.stdout.write(`Reusing verified ${relative}\n`)
  } catch {
    binary = await downloadAny(relative)
    verify(binary, hash, relative)
    await writeFile(executable, binary)
  }
} else {
  const filename = `node-${NODE_VERSION}-darwin-${arch}.tar.gz`
  const archive = await downloadAny(filename)
  verify(archive, expectedHash(sums, filename), filename)
  const temporary = await mkdtemp(join(tmpdir(), 'dsh-desktop-node-'))
  const archivePath = join(temporary, filename)
  try {
    await writeFile(archivePath, archive)
    const tar = spawn('tar', ['-xzf', archivePath, '-C', temporary], { stdio: 'inherit' })
    const [code] = await once(tar, 'exit')
    if (code !== 0) throw new Error(`tar exited with code ${code}`)
    await copyFile(join(temporary, basename(filename, '.tar.gz'), 'bin', 'node'), executable)
    await chmod(executable, 0o755)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

const license = await download(`https://raw.githubusercontent.com/nodejs/node/${NODE_VERSION}/LICENSE`)
verify(license, NODE_LICENSE_SHA256, `nodejs/node/${NODE_VERSION}/LICENSE`)
await writeFile(new URL('LICENSE', outputDir), license)
await writeFile(marker, `${JSON.stringify({ version: NODE_VERSION, platform, arch }, null, 2)}\n`)
process.stdout.write(`Prepared Node runtime ${NODE_VERSION} for ${platform}-${arch}\n`)

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function downloadAny(relative) {
  const errors = []
  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}/${relative}`
    try {
      process.stdout.write(`Downloading ${url}\n`)
      return await download(url)
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`All Node.js download sources failed for ${relative}:\n${errors.join('\n')}`)
}

function expectedHash(sumsText, filename) {
  const line = sumsText.split(/\r?\n/).find(value => value.endsWith(`  ${filename}`))
  if (!line) throw new Error(`No SHA-256 entry for ${filename}`)
  return line.split(/\s+/)[0]
}

function verify(data, expected, filename) {
  const actual = createHash('sha256').update(data).digest('hex')
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${filename}: expected ${expected}, got ${actual}`)
}
