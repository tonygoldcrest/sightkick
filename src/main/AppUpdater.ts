import { autoUpdater, UpdateInfo } from 'electron-updater';
import log from 'electron-log';
import { BrowserWindow, ipcMain } from 'electron';
import { IpcUpdateAvailableResponse } from '../types';

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
  private updateInfo?: IpcUpdateAvailableResponse;

  constructor(window: BrowserWindow) {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;

    ipcMain.removeAllListeners('check-update');
    ipcMain.on('check-update', (event) => {
      if (this.updateInfo) {
        event.reply('update-available', this.updateInfo);
      }
    });

    autoUpdater.removeAllListeners('update-available');
    autoUpdater.on('update-available', (info) => {
      this.updateInfo = {
        version: info.version,
        releaseUrl: RELEASES_URL,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      };

      window.webContents.send('update-available', this.updateInfo);
    });

    autoUpdater
      .checkForUpdates()
      .catch((err) => log.warn('Update check failed:', err));
  }
}
