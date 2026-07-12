import path from 'path';
import { pathToFileURL } from 'url';
import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  shell,
  powerSaveBlocker,
} from 'electron';
import Store from 'electron-store';
import MenuBuilder from './menu';
import { ASSET_PROTOCOL, resolveAssetFilePath, resolveHtmlPath } from './util';
import { AppUpdater } from './AppUpdater';
import { loadSong } from './ipc/loadSong';
import { loadSongList } from './ipc/loadSongList';
import { downloadSong } from './ipc/downloadSong';
import { checkStemTools, checkStemToolsUpdate } from './ipc/checkStemTools';
import { downloadStemTools, cancelStemTools } from './ipc/downloadStemTools';
import { deleteStemTools } from './ipc/deleteStemTools';
import { splitSong, cancelSplit, killActiveSplit } from './ipc/splitSong';
import { listenMidi, loadMidiDeviceList, stopListenMidi } from './ipc/midi';
import { updateSong } from './ipc/updateSong';
import { rescanSongs } from './ipc/rescanSongs';
import { exportPdf } from './ipc/exportPdf';

class AppState {
  private static instance: AppState;
  private mainWindow: BrowserWindow | null = null;
  private powerSaveBlockerId: number = -1;
  readonly store = new Store();
  private libraryRoot = this.store.get('lastOpenedPath') as string | undefined;

  static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }

    return AppState.instance;
  }

  setLibraryRoot(root: string): void {
    this.libraryRoot = root;
    this.store.set('lastOpenedPath', root);
  }

  start(): void {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: ASSET_PROTOCOL,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
          stream: true,
        },
      },
    ]);
    app.on('window-all-closed', () => {
      this.cleanup();

      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    app.on('before-quit', () => {
      this.cleanup();
    });
    app
      .whenReady()
      .then(() => {
        protocol.handle(ASSET_PROTOCOL, (request) => {
          const filePath = resolveAssetFilePath(request.url, this.libraryRoot);

          if (!filePath) {
            return new Response('Forbidden', { status: 403 });
          }

          return net.fetch(pathToFileURL(filePath).toString());
        });
        this.setupIpc();
        this.createWindow();
        app.on('activate', () => {
          if (!this.mainWindow) {
            this.createWindow();
          }
        });
      })
      .catch(console.log);
  }

  private setupIpc(): void {
    const isDebug =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true';

    ipcMain.on('load-song', loadSong);
    ipcMain.on('load-song-list', loadSongList);
    ipcMain.on('rescan-songs', rescanSongs);
    ipcMain.on('download-song', downloadSong);

    ipcMain.on('check-stem-tools', checkStemTools);
    ipcMain.on('check-stem-tools-update', checkStemToolsUpdate);
    ipcMain.on('download-stem-tools', downloadStemTools);
    ipcMain.on('cancel-stem-tools', cancelStemTools);
    ipcMain.on('delete-stem-tools', deleteStemTools);

    ipcMain.on('split-song', splitSong);
    ipcMain.on('cancel-split', cancelSplit);

    ipcMain.on('update-song', updateSong);
    ipcMain.on('export-pdf', exportPdf);
    ipcMain.on('midi-device-list', loadMidiDeviceList);
    ipcMain.on('listen-midi', listenMidi);
    ipcMain.on('stop-listen-midi', stopListenMidi);

    ipcMain.on('open-song-directory', (_event, dir: string) => {
      shell.openPath(dir);
    });
    ipcMain.on('check-dev', (event) => {
      event.reply('check-dev', isDebug);
    });
    ipcMain.on('like-song', (event, id, liked) => {
      this.store.set(`songs.${id}.liked`, liked);
    });
    ipcMain.on('prevent-sleep', () => this.preventSleep());
    ipcMain.on('resume-sleep', () => this.resumeSleep());
  }

  async createWindow(): Promise<void> {
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');
    const getAssetPath = (...paths: string[]): string => {
      return path.join(RESOURCES_PATH, ...paths);
    };

    this.mainWindow = new BrowserWindow({
      show: false,
      x: 0,
      y: 0,
      width: 1366,
      height: 768,
      icon:
        process.platform === 'win32'
          ? getAssetPath('icon.ico')
          : process.platform === 'linux'
          ? getAssetPath('icons', '512x512.png')
          : getAssetPath('icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        backgroundThrottling: false,
      },
    });
    this.mainWindow.loadURL(resolveHtmlPath('index.html'));
    this.mainWindow.on('ready-to-show', () => {
      if (!this.mainWindow) {
        throw new Error('"mainWindow" is not defined');
      }

      if (process.env.START_MINIMIZED) {
        this.mainWindow.minimize();
      } else {
        this.mainWindow.maximize();
        this.mainWindow.show();
      }
    });
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    const menuBuilder = new MenuBuilder(this.mainWindow);

    menuBuilder.buildMenu();
    this.mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);

      return { action: 'deny' };
    });
    new AppUpdater(this.mainWindow);
  }

  preventSleep(): void {
    if (this.powerSaveBlockerId === -1) {
      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
  }

  resumeSleep(): void {
    if (this.powerSaveBlockerId !== -1) {
      powerSaveBlocker.stop(this.powerSaveBlockerId);
      this.powerSaveBlockerId = -1;
    }
  }

  cleanup(): void {
    this.resumeSleep();
    stopListenMidi();
    killActiveSplit();
    cancelStemTools();
  }
}

export const appState = AppState.getInstance();
