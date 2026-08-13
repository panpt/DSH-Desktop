import type { DesktopInfo, StartupState } from './contracts.js'

declare global {
  interface Window {
    dshDesktop: {
      getInfo(): Promise<DesktopInfo>
      getStartupState(): Promise<StartupState>
      retryEngine(): Promise<void>
      openLogs(): Promise<void>
      checkUpdates(): Promise<void>
      onStartupState(listener: (state: StartupState) => void): () => void
    }
  }
}

export {}

