import {
  autoUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from 'electron-updater';
import log from 'electron-log';
import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import { IpcUpdateAvailable, IpcUpdateStatus } from '../types';

const RELEASES_URL =
  'https://github.com/tonygoldcrest/sightkick/releases/latest';

function normalizeReleaseNotes(
  releaseNotes: UpdateInfo['releaseNotes'],
): string | undefined {
  if (!releaseNotes) {
    return undefined;
  }

  if (typeof releaseNotes === 'string') {
    return releaseNotes.trim() || undefined;
  }

  const joined = releaseNotes
    .map((entry) => entry.note?.trim())
    .filter(Boolean)
    .join('\n\n');

  return joined || undefined;
}

export class AppUpdater {
  private static instance: AppUpdater | undefined;
  private window: BrowserWindow;
  private updateInfo?: IpcUpdateAvailable;

  static attach(window: BrowserWindow): AppUpdater {
    if (AppUpdater.instance) {
      AppUpdater.instance.window = window;
    } else {
      AppUpdater.instance = new AppUpdater(window);
    }

    AppUpdater.instance.checkForUpdates();

    return AppUpdater.instance;
  }

  static reset(): void {
    AppUpdater.instance?.dispose();
    AppUpdater.instance = undefined;
  }

  private constructor(window: BrowserWindow) {
    this.window = window;

    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;

    this.registerListeners();
  }

  private handleCheckUpdate = (event: IpcMainEvent): void => {
    if (this.updateInfo) {
      event.reply('update-status', this.updateInfo);
    }
  };

  private handleDownloadUpdate = (): void => {
    autoUpdater
      .downloadUpdate()
      .catch((err) => log.warn('Update download failed:', err));
  };

  private handleInstallUpdate = (): void => {
    autoUpdater.quitAndInstall();
  };

  private handleUpdateAvailable = (info: UpdateInfo): void => {
    this.updateInfo = {
      phase: 'available',
      version: info.version,
      releaseUrl: RELEASES_URL,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    };

    this.send(this.updateInfo);
  };

  private handleDownloadProgress = (progress: ProgressInfo): void => {
    this.send({ phase: 'downloading', percent: progress.percent });
  };

  private handleUpdateDownloaded = (info: UpdateDownloadedEvent): void => {
    this.send({ phase: 'downloaded', version: info.version });
  };

  private handleError = (err: Error): void => {
    this.send({ phase: 'error', message: err.message });
  };

  private send(status: IpcUpdateStatus): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send('update-status', status);
    }
  }

  private registerListeners(): void {
    ipcMain.on('check-update', this.handleCheckUpdate);
    ipcMain.on('download-update', this.handleDownloadUpdate);
    ipcMain.on('install-update', this.handleInstallUpdate);
    autoUpdater.on('update-available', this.handleUpdateAvailable);
    autoUpdater.on('download-progress', this.handleDownloadProgress);
    autoUpdater.on('update-downloaded', this.handleUpdateDownloaded);
    autoUpdater.on('error', this.handleError);
  }

  private dispose(): void {
    ipcMain.removeListener('check-update', this.handleCheckUpdate);
    ipcMain.removeListener('download-update', this.handleDownloadUpdate);
    ipcMain.removeListener('install-update', this.handleInstallUpdate);
    autoUpdater.removeListener('update-available', this.handleUpdateAvailable);
    autoUpdater.removeListener(
      'download-progress',
      this.handleDownloadProgress,
    );
    autoUpdater.removeListener(
      'update-downloaded',
      this.handleUpdateDownloaded,
    );
    autoUpdater.removeListener('error', this.handleError);
  }

  private checkForUpdates(): void {
    autoUpdater
      .checkForUpdates()
      .catch((err) => log.warn('Update check failed:', err));
  }
}
