import { app, BrowserWindow, dialog, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import log from 'electron-log/main.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { updateChannel } from './release-channel.js'

export interface DesktopUpdaterOptions {
  window: () => BrowserWindow | undefined
  beforeInstall: () => Promise<void>
}

export class DesktopUpdater {
  readonly configured: boolean
  readonly channel: string
  private readonly updater: AppUpdater
  private timer?: NodeJS.Timeout
  private manualCheck = false

  private showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    const window = this.options.window()
    return window === undefined ? dialog.showMessageBox(options) : dialog.showMessageBox(window, options)
  }

  constructor(private readonly options: DesktopUpdaterOptions) {
    const { autoUpdater } = electronUpdater
    this.updater = autoUpdater
    this.channel = updateChannel(app.getVersion())
    this.configured = app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))
      || typeof process.env.DSH_DESKTOP_UPDATE_URL === 'string'

    log.initialize()
    this.updater.logger = log
    this.updater.channel = this.channel
    this.updater.allowPrerelease = this.channel.startsWith('dev-') || this.channel.startsWith('beta-')
    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = true

    this.updater.on('download-progress', progress => {
      this.options.window()?.setProgressBar(progress.percent / 100)
    })
    this.updater.on('update-downloaded', async info => {
      this.options.window()?.setProgressBar(-1)
      const result = await this.showMessageBox({
        type: 'info',
        title: 'DSH-Desktop 更新已就绪',
        message: `版本 ${info.version} 已下载完成`,
        detail: '立即重启将安装更新。工作区配置和会话数据不会被删除。',
        buttons: ['立即重启更新', '稍后'],
        defaultId: 0,
        cancelId: 1,
      })
      if (result.response === 0) {
        await this.options.beforeInstall()
        this.updater.quitAndInstall(false, true)
      }
    })
    this.updater.on('update-not-available', async () => {
      if (!this.manualCheck) return
      await this.showMessageBox({
        type: 'info',
        title: 'DSH-Desktop',
        message: '当前已经是此更新频道的最新版本。',
      })
    })
    this.updater.on('error', async error => {
      this.options.window()?.setProgressBar(-1)
      log.error('Updater error', error)
      if (!this.manualCheck) return
      await this.showMessageBox({
        type: 'error',
        title: '检查更新失败',
        message: '暂时无法完成更新检查。',
        detail: error.message,
      })
    })
  }

  start(): void {
    if (!this.configured) return
    setTimeout(() => void this.check(false), 15_000).unref()
    this.timer = setInterval(() => void this.check(false), 6 * 60 * 60 * 1_000)
    this.timer.unref()
  }

  async check(manual = true): Promise<void> {
    this.manualCheck = manual
    if (!this.configured) {
      if (manual) {
        await this.showMessageBox({
          type: 'info',
          title: '自动更新尚未配置',
          message: '当前本地构建没有更新源。',
          detail: '通过 GitHub Actions 发布的安装包会自动写入对应的 Dev/Beta/Stable 更新源。',
        })
      }
      return
    }
    try {
      await this.updater.checkForUpdates()
    } finally {
      this.manualCheck = false
    }
  }

  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
  }
}
