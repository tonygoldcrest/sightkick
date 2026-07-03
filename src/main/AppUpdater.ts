import { autoUpdater, UpdateInfo } from 'electron-updater';
import log from 'electron-log';
import { BrowserWindow, ipcMain } from 'electron';
import { IpcUpdateAvailable } from '../types';

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
  private updateInfo?: IpcUpdateAvailable;

  constructor(window: BrowserWindow) {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;

    ipcMain.removeAllListeners('check-update');
    ipcMain.on('check-update', (event) => {
      if (this.updateInfo) {
        event.reply('update-status', this.updateInfo);
      }
    });

    ipcMain.removeAllListeners('download-update');
    ipcMain.on('download-update', () => {
      autoUpdater
        .downloadUpdate()
        .catch((err) => log.warn('Update download failed:', err));
    });

    ipcMain.removeAllListeners('install-update');
    ipcMain.on('install-update', () => {
      autoUpdater.quitAndInstall();
    });

    autoUpdater.removeAllListeners('update-available');
    autoUpdater.on('update-available', (info) => {
      this.updateInfo = {
        phase: 'available',
        version: info.version,
        releaseUrl: RELEASES_URL,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      };

      window.webContents.send('update-status', this.updateInfo);
    });

    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.on('download-progress', (progress) => {
      window.webContents.send('update-status', {
        phase: 'downloading',
        percent: progress.percent,
      });
    });

    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.on('update-downloaded', (info) => {
      window.webContents.send('update-status', {
        phase: 'downloaded',
        version: info.version,
      });
    });

    autoUpdater.removeAllListeners('error');
    autoUpdater.on('error', (err) => {
      window.webContents.send('update-status', {
        phase: 'error',
        message: err.message,
      });
    });

    autoUpdater
      .checkForUpdates()
      .catch((err) => log.warn('Update check failed:', err));
  }
}
