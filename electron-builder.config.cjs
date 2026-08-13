const path = require('node:path')

const repository = process.env.GITHUB_REPOSITORY?.split('/')
const packageVersion = require('./package.json').version
const prerelease = packageVersion.split('-', 2)[1]?.toLowerCase() || ''
const inferredChannel = prerelease.startsWith('dev') || prerelease.startsWith('nightly')
  ? 'dev'
  : prerelease.startsWith('beta') || prerelease.startsWith('rc') ? 'beta' : 'stable'
const baseChannel = process.env.DSH_DESKTOP_CHANNEL || inferredChannel
const platformName = process.platform === 'darwin' ? 'mac' : 'win'
const updateChannel = `${baseChannel}-${platformName}-${process.arch}`
const runtimeDir = `.runtime/${process.platform}-${process.arch}`
const publish = repository?.length === 2
  ? [{
      provider: 'github',
      owner: repository[0],
      repo: repository[1],
      channel: updateChannel,
      releaseType: baseChannel === 'stable' ? 'release' : 'prerelease',
    }]
  : undefined

const notarize = process.env.APPLE_ID && process.env.APPLE_TEAM_ID
  ? { teamId: process.env.APPLE_TEAM_ID }
  : false

module.exports = {
  appId: 'com.dshdesktop.app',
  productName: 'DSH-Desktop',
  artifactName: `DSH-Desktop-${'${version}'}-${platformName}-${'${arch}'}.${'${ext}'}`,
  asar: true,
  // Native modules belong to the DSH sidecar and must keep the bundled Node.js ABI.
  npmRebuild: false,
  asarUnpack: [
    'node_modules/**/*',
  ],
  electronLanguages: ['en-US', 'zh-CN'],
  afterPack: './scripts/after-pack.cjs',
  electronUpdaterCompatibility: '>=2.16',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/*.js',
    'renderer/**/*',
    'locales/**/*',
    'node_modules/**/*',
    '!node_modules/**/*.map',
    '!node_modules/**/*.d.ts',
    '!node_modules/**/*.d.mts',
    '!node_modules/**/*.d.cts',
    '!node_modules/**/{test,tests,__tests__,example,examples}/**/*',
    '!node_modules/node-pty/prebuilds/*/**/*',
    `node_modules/node-pty/prebuilds/${process.platform}-${process.arch}/**/*`,
    '!node_modules/node-pty/third_party/conpty/*/win10-arm64/**/*',
    '!node_modules/node-pty/third_party/conpty/*/win10-x64/**/*',
    ...(process.platform === 'win32'
      ? [`node_modules/node-pty/third_party/conpty/*/win10-${process.arch}/**/*`]
      : []),
    'package.json',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
  ],
  extraResources: [
    {
      from: path.join(runtimeDir, process.platform === 'win32' ? 'node.exe' : 'node'),
      to: process.platform === 'win32' ? 'runtime/node.exe' : 'runtime/node',
    },
    {
      from: path.join(runtimeDir, 'LICENSE'),
      to: 'runtime/LICENSE.node.txt',
    },
    {
      from: path.join(runtimeDir, 'runtime.json'),
      to: 'runtime/runtime.json',
    },
  ],
  publish,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    executableName: 'DSH-Desktop',
    icon: 'build/icon.svg',
    verifyUpdateCodeSignature: true,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: true,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'DSH-Desktop',
  },
  mac: {
    target: [
      { target: 'dmg', arch: [process.arch] },
      { target: 'zip', arch: [process.arch] },
    ],
    category: 'public.app-category.developer-tools',
    icon: 'build/icon.svg',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize,
    extendInfo: {
      NSDocumentsFolderUsageDescription: 'DSH-Desktop accesses only workspaces that you explicitly select.',
      NSDownloadsFolderUsageDescription: 'DSH-Desktop accesses only workspaces that you explicitly select.',
    },
  },
  dmg: {
    sign: false,
  },
}
