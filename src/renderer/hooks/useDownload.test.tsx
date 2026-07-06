import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Song } from '../../types';
import {
  getNotification,
  installIpcMock,
  IpcMock,
  NotificationMock,
  resetNotification,
} from './test-support';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

let ipc: IpcMock;
let notification: NotificationMock;

function song(id: string): Song {
  return {
    id,
    dir: `https://files/${id}.sng`,
    name: `Name ${id}`,
    artist: `Artist ${id}`,
    charter: `Charter ${id}`,
  } as Song;
}

beforeEach(() => {
  ipc = installIpcMock();
  notification = resetNotification();
});

async function load(results: Song[], onAdded = vi.fn()) {
  const { useDownload } = await import('./useDownload');
  const view = renderHook(() => useDownload(results, onAdded));

  return { ...view, onAdded };
}

describe('useDownload', () => {
  it('sends the download payload and marks the id as downloading', async () => {
    const { result } = await load([song('a')]);

    act(() => result.current.handleDownload('a'));

    expect(result.current.downloadingIds.has('a')).toBe(true);
    expect(ipc.sent).toEqual([
      {
        channel: 'download-song',
        args: [
          {
            url: 'https://files/a.sng',
            md5: 'a',
            name: 'Name a',
            artist: 'Artist a',
            charter: 'Charter a',
          },
        ],
      },
    ]);
  });

  it('ignores downloads for unknown ids', async () => {
    const { result } = await load([song('a')]);

    act(() => result.current.handleDownload('missing'));

    expect(result.current.downloadingIds.size).toBe(0);
    expect(ipc.sent).toEqual([]);
  });

  it('adds the song and clears downloading on success', async () => {
    const { result, onAdded } = await load([song('a')]);
    const added = song('a');

    act(() => result.current.handleDownload('a'));
    act(() =>
      ipc.emit('download-song', { success: true, md5: 'a', song: added }),
    );

    expect(onAdded).toHaveBeenCalledWith(added);
    expect(result.current.downloadingIds.has('a')).toBe(false);
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('notifies and clears downloading on failure', async () => {
    const { result, onAdded } = await load([song('a')]);

    act(() => result.current.handleDownload('a'));
    act(() =>
      ipc.emit('download-song', {
        success: false,
        md5: 'a',
        error: 'no disk space',
      }),
    );

    expect(onAdded).not.toHaveBeenCalled();
    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      description: 'no disk space',
    });
    expect(result.current.downloadingIds.has('a')).toBe(false);
  });

  it('treats success without a song as a failure', async () => {
    const { result, onAdded } = await load([song('a')]);

    act(() => result.current.handleDownload('a'));
    act(() => ipc.emit('download-song', { success: true, md5: 'a' }));

    expect(onAdded).not.toHaveBeenCalled();
    expect(notification.error).toHaveBeenCalledTimes(1);
  });

  it('does not start a second download while one is in flight', async () => {
    const { result } = await load([song('a')]);

    act(() => result.current.handleDownload('a'));
    act(() => result.current.handleDownload('a'));

    expect(ipc.sent.filter((s) => s.channel === 'download-song')).toHaveLength(
      1,
    );
  });

  it('allows re-downloading after a completed download', async () => {
    const { result } = await load([song('a')]);

    act(() => result.current.handleDownload('a'));
    act(() =>
      ipc.emit('download-song', { success: true, md5: 'a', song: song('a') }),
    );
    act(() => result.current.handleDownload('a'));

    expect(ipc.sent.filter((s) => s.channel === 'download-song')).toHaveLength(
      2,
    );
  });

  it('routes a reply only to the matching download', async () => {
    const { result, onAdded } = await load([song('a'), song('b')]);

    act(() => result.current.handleDownload('a'));
    act(() => result.current.handleDownload('b'));

    expect(result.current.downloadingIds.has('a')).toBe(true);
    expect(result.current.downloadingIds.has('b')).toBe(true);

    act(() =>
      ipc.emit('download-song', { success: true, md5: 'a', song: song('a') }),
    );

    expect(result.current.downloadingIds.has('a')).toBe(false);
    expect(result.current.downloadingIds.has('b')).toBe(true);
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded).toHaveBeenCalledWith(song('a'));

    act(() =>
      ipc.emit('download-song', { success: true, md5: 'b', song: song('b') }),
    );

    expect(result.current.downloadingIds.has('b')).toBe(false);
    expect(onAdded).toHaveBeenCalledTimes(2);
  });

  it('ignores replies for ids that are not downloading', async () => {
    const { result, onAdded } = await load([song('a')]);

    act(() =>
      ipc.emit('download-song', { success: true, md5: 'a', song: song('a') }),
    );

    expect(onAdded).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
    expect(result.current.downloadingIds.size).toBe(0);
  });
});
