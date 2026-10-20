import { contextBridge, ipcRenderer } from 'electron';
import type { IpcResult } from '../shared/types';

const api = {
  invoke<T>(channel: string, input?: unknown): Promise<IpcResult<T>> {
    return ipcRenderer.invoke(channel, input ?? {}) as Promise<IpcResult<T>>;
  }
};

contextBridge.exposeInMainWorld('pos', api);

declare global {
  interface Window {
    pos: typeof api;
  }
}
