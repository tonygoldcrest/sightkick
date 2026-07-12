import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'load-song-list'
  | 'load-song'
  | 'rescan-songs'
  | 'like-song'
  | 'prevent-sleep'
  | 'resume-sleep'
  | 'check-dev'
  | 'download-song'
  | 'check-stem-tools'
  | 'check-stem-tools-update'
  | 'download-stem-tools'
  | 'cancel-stem-tools'
  | 'delete-stem-tools'
  | 'split-song'
  | 'cancel-split'
  | 'open-song-directory'
  | 'midi-device-list'
  | 'listen-midi'
  | 'midi-error'
  | 'stop-listen-midi'
  | 'check-update'
  | 'update-status'
  | 'download-update'
  | 'install-update'
  | 'update-song'
  | 'export-pdf';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on<T>(channel: Channels, func: (args: T) => void) {
      const subscription = (_event: IpcRendererEvent, args: T) => func(args);

      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once<T>(channel: Channels, func: (args: T) => void) {
      const subscription = (_event: IpcRendererEvent, args: T) => func(args);

      ipcRenderer.once(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
