import { app, BrowserWindow, dialog, ipcMain, Menu, shell, session } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { HarnessEngine } from './engine.js'
import { IPC, type DesktopInfo, type DesktopLocale, type LocaleSnapshot, type StartupState, type TranslationKey } from './contracts.js'
import { DesktopUpdater } from './updater.js'
import { updateChannel } from './release-channel.js'
import { localeSnapshot, resolvePreferredLocale, translate } from './i18n.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const smokeTest = process.argv.includes('--smoke-test')
let mainWindow: BrowserWindow | undefined
let engine: HarnessEngine
let updater: DesktopUpdater
let locale: DesktopLocale = 'en-US'
let state: StartupState = { phase: 'starting', messageKey: 'starting' }
let quitting = false
let allowedEngineOrigin: string | undefined

function t(key: TranslationKey, variables?: Readonly<Record<string, string | number>>): string {
  return translate(locale, key, variables)
}

function preferencesPath(): string {
  return join(app.getPath('userData'), 'desktop-settings.json')
}

function loadDesktopLocale(): DesktopLocale {
  let preferences: unknown
  try { preferences = JSON.parse(readFileSync(preferencesPath(), 'utf8')) } catch { preferences = undefined }
  return resolvePreferredLocale(preferences, app.getLocale())
}

function saveDesktopLocale(nextLocale: DesktopLocale): void {
  writeFileSync(preferencesPath(), `${JSON.stringify({ locale: nextLocale }, null, 2)}\n`, 'utf8')
}

function setDesktopLocale(nextLocale: DesktopLocale): LocaleSnapshot {
  locale = nextLocale
  saveDesktopLocale(locale)
  installMenu()
  const snapshot = localeSnapshot(locale)
  mainWindow?.webContents.send(IPC.localeChanged, snapshot)
  return snapshot
}

function reportSmoke(status: 'ok' | 'failed', detail: string): void {
  const line = status === 'ok' ? `DSH_DESKTOP_SMOKE_OK ${detail}` : `DSH_DESKTOP_SMOKE_FAILED ${detail}`
  const resultPath = process.env.DSH_DESKTOP_SMOKE_RESULT
  if (resultPath !== undefined) writeFileSync(resultPath, JSON.stringify({ status, detail }), 'utf8')
  const stream = status === 'ok' ? process.stdout : process.stderr
  stream.write(`${line}\n`)
}

app.setName('DSH-Desktop')
if (process.platform === 'win32') app.setAppUserModelId('com.dshdesktop.app')

const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()

function statusPagePath(): string {
  return join(app.getAppPath(), 'renderer', 'startup.html')
}

function setState(next: StartupState): void {
  state = next
  mainWindow?.webContents.send(IPC.startupStateChanged, state)
}

function desktopInfo(): DesktopInfo {
  return {
    desktopVersion: app.getVersion(),
    engineVersion: engine.version,
    updateChannel: updateChannel(app.getVersion()),
    updateConfigured: updater?.configured ?? false,
    platform: process.platform,
    arch: process.arch,
    locale,
  }
}

function safeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: !smokeTest,
    backgroundColor: '#0b0d12',
    title: 'DSH-Desktop',
    webPreferences: {
      preload: join(currentDir, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (safeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const origin = (() => { try { return new URL(url).origin } catch { return '' } })()
    if (url.startsWith('file:') || origin === allowedEngineOrigin) return
    event.preventDefault()
    if (safeExternalUrl(url)) void shell.openExternal(url)
  })
  window.on('closed', () => { mainWindow = undefined })
  void window.loadFile(statusPagePath())
  return window
}

async function showStatusPage(): Promise<void> {
  const window = mainWindow
  if (window === undefined || window.isDestroyed()) return
  await window.loadFile(statusPagePath())
  window.webContents.send(IPC.startupStateChanged, state)
}

async function startEngine(navigate = true): Promise<void> {
  setState({ phase: 'starting', messageKey: 'starting' })
  await showStatusPage()
  try {
    const ready = await engine.start()
    allowedEngineOrigin = new URL(ready.url).origin
    setState({ phase: 'ready', messageKey: 'ready' })
    if (navigate && mainWindow !== undefined) await mainWindow.loadURL(ready.url)
    if (smokeTest) {
      reportSmoke('ok', ready.url)
      await engine.stop()
      app.exit(0)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    setState({ phase: 'error', messageKey: 'startFailed', detail })
    await showStatusPage()
    if (smokeTest) {
      reportSmoke('failed', detail)
      app.exit(1)
    }
  }
}

function installMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'DSH-Desktop',
      submenu: [
        { label: t('aboutTitle'), role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { label: t('quit'), role: 'quit' as const },
      ],
    }] : []),
    {
      label: t('file'),
      submenu: [
        { label: t('reloadInterface'), accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: t('restartHarness'), click: () => void startEngine() },
        { type: 'separator' },
        isMac ? { label: t('close'), role: 'close' } : { label: t('quit'), role: 'quit' },
      ],
    },
    {
      label: t('edit'),
      submenu: [
        { label: t('undo'), role: 'undo' },
        { label: t('redo'), role: 'redo' },
        { type: 'separator' },
        { label: t('cut'), role: 'cut' },
        { label: t('copy'), role: 'copy' },
        { label: t('paste'), role: 'paste' },
        { label: t('selectAll'), role: 'selectAll' },
      ],
    },
    {
      label: t('view'),
      submenu: [
        { label: t('actualSize'), role: 'resetZoom' },
        { label: t('zoomIn'), role: 'zoomIn' },
        { label: t('zoomOut'), role: 'zoomOut' },
        { type: 'separator' },
        { label: t('toggleFullscreen'), role: 'togglefullscreen' },
        { label: t('toggleDeveloperTools'), role: 'toggleDevTools' },
      ],
    },
    {
      label: t('language'),
      submenu: [
        { label: t('chinese'), type: 'radio', checked: locale === 'zh-CN', click: () => setDesktopLocale('zh-CN') },
        { label: t('english'), type: 'radio', checked: locale === 'en-US', click: () => setDesktopLocale('en-US') },
      ],
    },
    {
      label: t('help'),
      submenu: [
        { label: t('checkUpdates'), click: () => void updater.check(true) },
        {
          label: t('versionInfo'),
          click: () => {
            const options = {
              type: 'info' as const,
              title: t('aboutTitle'),
              message: `DSH-Desktop ${app.getVersion()}`,
              detail: `DeepSeek Harness ${engine.version}\n${t('updateChannel')} ${updateChannel(app.getVersion())}\n${process.platform} ${process.arch}`,
            }
            void (mainWindow === undefined ? dialog.showMessageBox(options) : dialog.showMessageBox(mainWindow, options))
          },
        },
        { label: t('openLogs'), click: () => void shell.openPath(join(app.getPath('userData'), 'logs')) },
        { label: t('harnessHomepage'), click: () => void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function installIpc(): void {
  ipcMain.handle(IPC.desktopInfo, () => desktopInfo())
  ipcMain.handle(IPC.startupState, () => state)
  ipcMain.handle(IPC.retryEngine, async () => { await startEngine() })
  ipcMain.handle(IPC.openLogs, async () => { await shell.openPath(join(app.getPath('userData'), 'logs')) })
  ipcMain.handle(IPC.checkUpdates, async () => { await updater.check(true) })
  ipcMain.handle(IPC.localeSnapshot, () => localeSnapshot(locale))
  ipcMain.handle(IPC.setLocale, (_event, nextLocale: unknown) => {
    if (nextLocale !== 'zh-CN' && nextLocale !== 'en-US') throw new TypeError('Unsupported desktop locale')
    return setDesktopLocale(nextLocale)
  })
}

async function initialize(): Promise<void> {
  const logsDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logsDir, { recursive: true })
  locale = loadDesktopLocale()
  engine = new HarnessEngine({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    packaged: app.isPackaged,
    userDataPath: app.getPath('userData'),
    logPath: join(logsDir, 'harness.log'),
  })
  engine.on('unexpected-exit', ({ code, signal }) => {
    if (quitting) return
    setState({
      phase: 'error',
      messageKey: 'unexpectedExit',
      detail: t('exitDetail', { code: code ?? t('none'), signal: signal ?? t('none') }),
    })
    void showStatusPage()
  })

  mainWindow = createWindow()
  updater = new DesktopUpdater({
    window: () => mainWindow,
    beforeInstall: async () => { quitting = true; await engine.stop() },
    translate: t,
  })
  installIpc()
  installMenu()
  updater.start()

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  await startEngine()
}

app.on('second-instance', () => {
  if (mainWindow === undefined) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.on('activate', () => {
  if (mainWindow === undefined) {
    mainWindow = createWindow()
    if (engine.info !== undefined) void mainWindow.loadURL(engine.info.url)
    else void startEngine()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', event => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  updater?.dispose()
  void engine?.stop().finally(() => app.quit())
})

if (lock) void app.whenReady().then(initialize)
