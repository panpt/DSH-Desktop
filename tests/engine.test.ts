import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { engineArguments, engineEntryPath, installedEngineVersion, runtimePath } from '../src/engine.js'

describe('Harness engine adapter', () => {
  it('installs the exact Harness version selected in the desktop manifest', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const selectedVersion = manifest.dependencies?.['@deepseek-ai/dsh']
    expect(selectedVersion).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
    expect(installedEngineVersion()).toBe(selectedVersion)
  })

  it('builds a loopback-only web invocation', () => {
    const args = engineArguments(3080)
    expect(args.slice(1)).toEqual(['web', '--host', '127.0.0.1', '--port', '3080'])
    expect(() => engineArguments(0)).toThrow(RangeError)
  })

  it('resolves development and packaged runtimes separately', () => {
    expect(runtimePath({
      packaged: false,
      resourcesPath: 'R',
      appPath: 'A',
      platform: 'win32',
      arch: 'x64',
    }).replaceAll('\\', '/')).toBe('A/.runtime/win32-x64/node.exe')
    expect(runtimePath({
      packaged: true,
      resourcesPath: 'R',
      appPath: 'A',
      platform: 'darwin',
      arch: 'arm64',
    }).replaceAll('\\', '/')).toBe('R/runtime/node')

    expect(engineEntryPath({
      packaged: true,
      resourcesPath: 'R',
    }).replaceAll('\\', '/')).toBe('R/app.asar.unpacked/node_modules/@deepseek-ai/dsh/lib/bin.js')
  })
})
