import { app, BrowserWindow, dialog, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import log from 'electron-log/main.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { updateChannel } from './release-channel.js'
import type { TranslationKey } from './contracts.js'

export interface DesktopUpdaterOptions {
  window: () => BrowserWindow | undefined
  beforeInstall: () => Promise<void>
  translate: (key: TranslationKey, variables?: Readonly<Record<string, string | number>>) => string
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
        title: this.options.translate('updaterReadyTitle'),
        message: this.options.translate('updaterVersionDownloaded', { version: info.version }),
        detail: this.options.translate('updaterReadyDetail'),
        buttons: [this.options.translate('restartNow'), this.options.translate('later')],
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
        message: this.options.translate('latestVersion'),
      })
    })
    this.updater.on('error', async error => {
      this.options.window()?.setProgressBar(-1)
      log.error('Updater error', error)
      if (!this.manualCheck) return
      await this.showMessageBox({
        type: 'error',
        title: this.options.translate('updateCheckFailedTitle'),
        message: this.options.translate('updateCheckFailedMessage'),
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
          title: this.options.translate('updateUnconfiguredTitle'),
          message: this.options.translate('updateUnconfiguredMessage'),
          detail: this.options.translate('updateUnconfiguredDetail'),
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
