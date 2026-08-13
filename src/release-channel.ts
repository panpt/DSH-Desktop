export type ReleaseChannel = 'stable' | 'beta' | 'dev'

export function baseReleaseChannel(version: string): ReleaseChannel {
  const prerelease = version.split('-', 2)[1]?.toLowerCase() ?? ''
  if (prerelease.startsWith('dev') || prerelease.startsWith('nightly')) return 'dev'
  if (prerelease.startsWith('beta') || prerelease.startsWith('rc')) return 'beta'
  return 'stable'
}

export function updateChannel(version: string, platform = process.platform, arch = process.arch): string {
  const platformName = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform
  return `${baseReleaseChannel(version)}-${platformName}-${arch}`
}

