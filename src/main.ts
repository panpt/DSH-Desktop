import { app, BrowserWindow, dialog, ipcMain, Menu, shell, session } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { HarnessEngine } from './engine.js'
import { IPC, type DesktopInfo, type StartupState } from './contracts.js'
import { DesktopUpdater } from './updater.js'
import { updateChannel } from './release-channel.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const smokeTest = process.argv.includes('--smoke-test')
let mainWindow: BrowserWindow | undefined
let engine: HarnessEngine
let updater: DesktopUpdater
let state: StartupState = { phase: 'starting', message: '正在启动 DeepSeek Harness…' }
let quitting = false
let allowedEngineOrigin: string | undefined

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
  setState({ phase: 'starting', message: '正在启动 DeepSeek Harness…' })
  await showStatusPage()
  try {
    const ready = await engine.start()
    allowedEngineOrigin = new URL(ready.url).origin
    setState({ phase: 'ready', message: 'DeepSeek Harness 已就绪' })
    if (navigate && mainWindow !== undefined) await mainWindow.loadURL(ready.url)
    if (smokeTest) {
      reportSmoke('ok', ready.url)
      await engine.stop()
      app.exit(0)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    setState({ phase: 'error', message: 'DeepSeek Harness 启动失败', detail })
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
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '重新加载界面', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: '重启 Harness', click: () => void startEngine() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: '帮助',
      submenu: [
        { label: '检查更新…', click: () => void updater.check(true) },
        {
          label: '版本信息',
          click: () => {
            const options = {
              type: 'info' as const,
              title: '关于 DSH-Desktop',
              message: `DSH-Desktop ${app.getVersion()}`,
              detail: `DeepSeek Harness ${engine.version}\n更新频道 ${updateChannel(app.getVersion())}\n${process.platform} ${process.arch}`,
            }
            void (mainWindow === undefined ? dialog.showMessageBox(options) : dialog.showMessageBox(mainWindow, options))
          },
        },
        { label: '打开日志目录', click: () => void shell.openPath(join(app.getPath('userData'), 'logs')) },
        { label: 'DeepSeek Harness 项目主页', click: () => void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness') },
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
}

async function initialize(): Promise<void> {
  const logsDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logsDir, { recursive: true })
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
      message: 'DeepSeek Harness 意外退出',
      detail: `退出代码：${code ?? '无'}，信号：${signal ?? '无'}`,
    })
    void showStatusPage()
  })

  mainWindow = createWindow()
  updater = new DesktopUpdater({
    window: () => mainWindow,
    beforeInstall: async () => { quitting = true; await engine.stop() },
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
