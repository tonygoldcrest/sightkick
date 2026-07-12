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
    removeListener: vi.fn((event: string, cb: Handler) => {
      if (handlers.get(event) === cb) {
        handlers.delete(event);
      }
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
    removeListener: vi.fn((channel: string, cb: Handler) => {
      if (handlers.get(channel) === cb) {
        handlers.delete(channel);
      }
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
    removeListener: updater.removeListener,
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
  ipcMain: {
    on: ipc.on,
    removeListener: ipc.removeListener,
    removeAllListeners: ipc.removeAllListeners,
  },
}));

const { AppUpdater } = await import('./AppUpdater');
const RELEASES_URL =
  'https://github.com/tonygoldcrest/sightkick/releases/latest';

function build() {
  const send = vi.fn();
  const window = { isDestroyed: () => false, webContents: { send } };

  AppUpdater.attach(window as unknown as BrowserWindow);

  return { send };
}

function emitUpdate(version: string, releaseNotes?: unknown) {
  updater.handlers.get('update-available')?.({ version, releaseNotes });
}

beforeEach(() => {
  AppUpdater.reset();
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

  it('registers listeners once across window recreation and targets the latest window', () => {
    const first = vi.fn();
    const second = vi.fn();

    AppUpdater.attach({
      isDestroyed: () => false,
      webContents: { send: first },
    } as unknown as BrowserWindow);
    AppUpdater.attach({
      isDestroyed: () => false,
      webContents: { send: second },
    } as unknown as BrowserWindow);

    expect(
      updater.on.mock.calls.filter(([event]) => event === 'update-available'),
    ).toHaveLength(1);

    emitUpdate('1.2.0');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(
      'update-status',
      expect.objectContaining({ version: '1.2.0' }),
    );
  });

  it('does not send to a window that has been destroyed', () => {
    const send = vi.fn();
    let destroyed = false;

    AppUpdater.attach({
      isDestroyed: () => destroyed,
      webContents: { send },
    } as unknown as BrowserWindow);

    destroyed = true;
    emitUpdate('1.2.0');

    expect(send).not.toHaveBeenCalled();
  });

  it('removes its own listeners on reset', () => {
    build();

    expect(updater.handlers.has('update-available')).toBe(true);
    expect(ipc.handlers.has('check-update')).toBe(true);

    AppUpdater.reset();

    expect(updater.handlers.has('update-available')).toBe(false);
    expect(ipc.handlers.has('check-update')).toBe(false);
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
