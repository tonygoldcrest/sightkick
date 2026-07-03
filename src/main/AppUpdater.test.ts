import { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEvent, lastReply } from './ipc/test-support';

type Handler = (...args: unknown[]) => void;

const updater = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
    }),
    removeAllListeners: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn(),
  };
});
const ipc = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    on: vi.fn((channel: string, cb: Handler) => {
      handlers.set(channel, cb);
    }),
    removeAllListeners: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
  };
});

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: undefined,
    autoDownload: true,
    on: updater.on,
    removeAllListeners: updater.removeAllListeners,
    checkForUpdates: updater.checkForUpdates,
    downloadUpdate: updater.downloadUpdate,
    quitAndInstall: updater.quitAndInstall,
  },
}));

vi.mock('electron-log', () => ({
  default: { transports: { file: { level: 'info' } }, warn: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: { on: ipc.on, removeAllListeners: ipc.removeAllListeners },
}));

const { AppUpdater } = await import('./AppUpdater');
const RELEASES_URL =
  'https://github.com/tonygoldcrest/sightkick/releases/latest';

function build() {
  const send = vi.fn();
  const window = { webContents: { send } };

  new AppUpdater(window as unknown as BrowserWindow);

  return { send };
}

function emitUpdate(version: string, releaseNotes?: unknown) {
  updater.handlers.get('update-available')?.({ version, releaseNotes });
}

beforeEach(() => {
  updater.handlers.clear();
  ipc.handlers.clear();
  vi.clearAllMocks();
});

describe('AppUpdater', () => {
  it('checks for updates on construction without auto-downloading', async () => {
    build();

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    const { autoUpdater } = await import('electron-updater');

    expect(autoUpdater.autoDownload).toBe(false);
  });

  it('clears prior listeners so window recreation does not stack them', () => {
    build();

    expect(updater.removeAllListeners).toHaveBeenCalledWith('update-available');
    expect(ipc.removeAllListeners).toHaveBeenCalledWith('check-update');
  });

  it('pushes the new version to the renderer when an update is found', () => {
    const { send } = build();

    emitUpdate('1.2.0');

    expect(send).toHaveBeenCalledWith('update-status', {
      phase: 'available',
      version: '1.2.0',
      releaseUrl: RELEASES_URL,
      releaseNotes: undefined,
    });
  });

  it('forwards string release notes verbatim', () => {
    const { send } = build();

    emitUpdate('1.2.0', '  Fixed a bug  ');

    expect(send.mock.calls[0][1].releaseNotes).toBe('Fixed a bug');
  });

  it('joins structured release notes into a single string', () => {
    const { send } = build();

    emitUpdate('1.2.0', [
      { version: '1.2.0', note: 'Second change' },
      { version: '1.1.0', note: 'First change' },
    ]);

    expect(send.mock.calls[0][1].releaseNotes).toBe(
      'Second change\n\nFirst change',
    );
  });

  it('leaves release notes undefined when absent', () => {
    const { send } = build();

    emitUpdate('1.2.0', null);

    expect(send.mock.calls[0][1].releaseNotes).toBeUndefined();
  });

  it('downloads the update when the renderer requests it', () => {
    build();

    ipc.handlers.get('download-update')?.();

    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('installs the update when the renderer requests it', () => {
    build();

    ipc.handlers.get('install-update')?.();

    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('forwards download progress to the renderer', () => {
    const { send } = build();

    updater.handlers.get('download-progress')?.({ percent: 42 });

    expect(send).toHaveBeenCalledWith('update-status', {
      phase: 'downloading',
      percent: 42,
    });
  });

  it('notifies the renderer once the update is downloaded', () => {
    const { send } = build();

    updater.handlers.get('update-downloaded')?.({ version: '1.2.0' });

    expect(send).toHaveBeenCalledWith('update-status', {
      phase: 'downloaded',
      version: '1.2.0',
    });
  });

  it('forwards updater errors to the renderer', () => {
    const { send } = build();

    updater.handlers.get('error')?.(new Error('Something broke'));

    expect(send).toHaveBeenCalledWith('update-status', {
      phase: 'error',
      message: 'Something broke',
    });
  });

  it('does not reply to a request before any update is found', () => {
    build();

    const event = makeEvent();

    ipc.handlers.get('check-update')?.(event);

    expect(event.reply).not.toHaveBeenCalled();
  });

  it('replies with the cached update to a later request', () => {
    build();

    emitUpdate('1.2.0');

    const event = makeEvent();

    ipc.handlers.get('check-update')?.(event);

    expect(lastReply(event, 'update-status').args[0]).toEqual({
      phase: 'available',
      version: '1.2.0',
      releaseUrl: RELEASES_URL,
      releaseNotes: undefined,
    });
  });
});
