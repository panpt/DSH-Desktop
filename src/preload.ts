import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopInfo, type StartupState } from './contracts.js'

const api = Object.freeze({
  getInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke(IPC.desktopInfo),
  getStartupState: (): Promise<StartupState> => ipcRenderer.invoke(IPC.startupState),
  retryEngine: (): Promise<void> => ipcRenderer.invoke(IPC.retryEngine),
  openLogs: (): Promise<void> => ipcRenderer.invoke(IPC.openLogs),
  checkUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.checkUpdates),
  onStartupState: (listener: (state: StartupState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: StartupState): void => listener(state)
    ipcRenderer.on(IPC.startupStateChanged, handler)
    return () => ipcRenderer.removeListener(IPC.startupStateChanged, handler)
  },
})

contextBridge.exposeInMainWorld('dshDesktop', api)

