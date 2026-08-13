import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopInfo, type DesktopLocale, type LocaleSnapshot, type StartupState } from './contracts.js'

const api = Object.freeze({
  getInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke(IPC.desktopInfo),
  getStartupState: (): Promise<StartupState> => ipcRenderer.invoke(IPC.startupState),
  retryEngine: (): Promise<void> => ipcRenderer.invoke(IPC.retryEngine),
  openLogs: (): Promise<void> => ipcRenderer.invoke(IPC.openLogs),
  checkUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.checkUpdates),
  getLocale: (): Promise<LocaleSnapshot> => ipcRenderer.invoke(IPC.localeSnapshot),
  setLocale: (locale: DesktopLocale): Promise<LocaleSnapshot> => ipcRenderer.invoke(IPC.setLocale, locale),
  onStartupState: (listener: (state: StartupState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: StartupState): void => listener(state)
    ipcRenderer.on(IPC.startupStateChanged, handler)
    return () => ipcRenderer.removeListener(IPC.startupStateChanged, handler)
  },
  onLocaleChanged: (listener: (snapshot: LocaleSnapshot) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: LocaleSnapshot): void => listener(snapshot)
    ipcRenderer.on(IPC.localeChanged, handler)
    return () => ipcRenderer.removeListener(IPC.localeChanged, handler)
  },
})

contextBridge.exposeInMainWorld('dshDesktop', api)
