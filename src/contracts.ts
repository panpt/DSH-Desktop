export type StartupPhase = 'starting' | 'ready' | 'error'

export interface StartupState {
  phase: StartupPhase
  message: string
  detail?: string
}

export interface DesktopInfo {
  desktopVersion: string
  engineVersion: string
  updateChannel: string
  updateConfigured: boolean
  platform: NodeJS.Platform
  arch: string
}

export const IPC = {
  desktopInfo: 'desktop:info',
  startupState: 'desktop:startup-state',
  startupStateChanged: 'desktop:startup-state-changed',
  retryEngine: 'desktop:retry-engine',
  openLogs: 'desktop:open-logs',
  checkUpdates: 'desktop:check-updates',
} as const

