import { describe, expect, it } from 'vitest'
import { baseReleaseChannel, updateChannel } from '../src/release-channel.js'

describe('release channels', () => {
  it('maps prereleases to the intended audience', () => {
    expect(baseReleaseChannel('1.0.0')).toBe('stable')
    expect(baseReleaseChannel('1.0.0-beta.2')).toBe('beta')
    expect(baseReleaseChannel('1.0.0-rc.1')).toBe('beta')
    expect(baseReleaseChannel('1.0.0-dev.9')).toBe('dev')
    expect(baseReleaseChannel('1.0.0-nightly.1')).toBe('dev')
  })

  it('separates update feeds by OS and CPU architecture', () => {
    expect(updateChannel('1.0.0-dev.1', 'win32', 'x64')).toBe('dev-win-x64')
    expect(updateChannel('1.0.0-beta.1', 'darwin', 'arm64')).toBe('beta-mac-arm64')
  })
})

