import { describe, expect, it } from 'vitest'
import { engineArguments, engineEntryPath, installedEngineVersion, runtimePath } from '../src/engine.js'

describe('Harness engine adapter', () => {
  it('pins the installed Harness version', () => {
    expect(installedEngineVersion()).toBe('0.1.0-rc.6')
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
