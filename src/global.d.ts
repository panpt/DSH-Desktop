import type { DesktopInfo, DesktopLocale, LocaleSnapshot, StartupState } from './contracts.js'

declare global {
  interface Window {
    dshDesktop: {
      getInfo(): Promise<DesktopInfo>
      getStartupState(): Promise<StartupState>
      retryEngine(): Promise<void>
      openLogs(): Promise<void>
      checkUpdates(): Promise<void>
      getLocale(): Promise<LocaleSnapshot>
      setLocale(locale: DesktopLocale): Promise<LocaleSnapshot>
      onStartupState(listener: (state: StartupState) => void): () => void
      onLocaleChanged(listener: (snapshot: LocaleSnapshot) => void): () => void
    }
  }
}

export {}
