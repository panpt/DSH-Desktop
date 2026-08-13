export type StartupPhase = 'starting' | 'ready' | 'error'
export type DesktopLocale = 'zh-CN' | 'en-US'
export type StartupMessageKey = 'starting' | 'ready' | 'startFailed' | 'unexpectedExit'

export type TranslationKey =
  | 'starting' | 'ready' | 'startFailed' | 'unexpectedExit' | 'exitDetail' | 'none'
  | 'file' | 'reloadInterface' | 'restartHarness' | 'close' | 'quit'
  | 'edit' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'
  | 'view' | 'actualSize' | 'zoomIn' | 'zoomOut' | 'toggleFullscreen' | 'toggleDeveloperTools'
  | 'language' | 'chinese' | 'english' | 'help' | 'checkUpdates' | 'versionInfo'
  | 'aboutTitle' | 'updateChannel' | 'openLogs' | 'harnessHomepage'
  | 'updaterReadyTitle' | 'updaterVersionDownloaded' | 'updaterReadyDetail'
  | 'restartNow' | 'later' | 'latestVersion' | 'updateCheckFailedTitle'
  | 'updateCheckFailedMessage' | 'updateUnconfiguredTitle' | 'updateUnconfiguredMessage'
  | 'updateUnconfiguredDetail' | 'retry' | 'desktopLabel' | 'harnessLabel'

export type DesktopTranslations = Record<TranslationKey, string>

export interface LocaleSnapshot {
  locale: DesktopLocale
  messages: DesktopTranslations
}

export interface StartupState {
  phase: StartupPhase
  messageKey: StartupMessageKey
  detail?: string
}

export interface DesktopInfo {
  desktopVersion: string
  engineVersion: string
  updateChannel: string
  updateConfigured: boolean
  platform: NodeJS.Platform
  arch: string
  locale: DesktopLocale
}

export const IPC = {
  desktopInfo: 'desktop:info',
  startupState: 'desktop:startup-state',
  startupStateChanged: 'desktop:startup-state-changed',
  retryEngine: 'desktop:retry-engine',
  openLogs: 'desktop:open-logs',
  checkUpdates: 'desktop:check-updates',
  localeSnapshot: 'desktop:locale-snapshot',
  localeChanged: 'desktop:locale-changed',
  setLocale: 'desktop:set-locale',
} as const
