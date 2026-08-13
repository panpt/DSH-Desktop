const path = require('node:path')

const repository = process.env.GITHUB_REPOSITORY?.split('/')
const baseChannel = process.env.DSH_DESKTOP_CHANNEL || 'dev'
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
  electronUpdaterCompatibility: '>=2.16',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/*.js',
    'dist/*.js.map',
    'renderer/**/*',
    'node_modules/**/*',
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
