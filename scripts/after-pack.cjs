const { readdir, rm } = require('node:fs/promises')
const path = require('node:path')

async function removeTypeDeclarations(directory) {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return }
  await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return removeTypeDeclarations(target)
    if (/\.d\.(?:ts|mts|cts)$/.test(entry.name)) await rm(target, { force: true })
  }))
}

module.exports = async function afterPack(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources')
  await removeTypeDeclarations(path.join(resources, 'app.asar.unpacked', 'node_modules'))
}
