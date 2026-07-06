import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongData } from '../../types';
import {
  getNotification,
  installIpcMock,
  IpcMock,
  NotificationMock,
  resetNotification,
} from './test-support';

const { setCurrentPath } = vi.hoisted(() => ({ setCurrentPath: vi.fn() }));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ setCurrentPath }),
}));

let ipc: IpcMock;
let notification: NotificationMock;

function song(id: string, extra: Partial<SongData> = {}): SongData {
  return { id, name: `Name ${id}`, ...extra } as SongData;
}

beforeEach(() => {
  ipc = installIpcMock();
  notification = resetNotification();
  setCurrentPath.mockClear();
});

async function load() {
  const { useSongList } = await import('./useSongList');

  return renderHook(() => useSongList());
}

describe('useSongList', () => {
  it('requests the song list on mount and stores the reply', async () => {
    const { result } = await load();

    expect(ipc.sent).toContainEqual({ channel: 'load-song-list', args: [] });

    act(() =>
      ipc.emit('load-song-list', {
        songs: [song('a')],
        lastOpenedPath: '/music',
      }),
    );

    expect(result.current.songList).toHaveLength(1);
    expect(setCurrentPath).toHaveBeenCalledWith('/music');
  });

  it('replaces the list on rescan', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() =>
      ipc.emit('rescan-songs', {
        songs: [song('b'), song('c')],
        lastOpenedPath: '/b',
      }),
    );

    expect(result.current.songList.map((s) => s.id)).toEqual(['b', 'c']);
    expect(setCurrentPath).toHaveBeenLastCalledWith('/b');
  });

  it('tracks scan progress and clears it when the rescan completes', async () => {
    const { result } = await load();

    act(() => ipc.emit('rescan-songs', { current: 0, total: 4 }));
    act(() => ipc.emit('rescan-songs', { current: 2, total: 4 }));

    expect(result.current.scanProgress).toEqual({ current: 2, total: 4 });

    act(() =>
      ipc.emit('rescan-songs', { songs: [song('b')], lastOpenedPath: '/b' }),
    );

    expect(result.current.scanProgress).toBeUndefined();
  });

  it('appends a downloaded song with addSong', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => result.current.addSong(song('b')));

    expect(result.current.songList.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('marks a song as splitting and notifies on handleSplit', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => result.current.handleSplit('a'));

    expect(result.current.splittingIds.has('a')).toBe(true);
    expect(ipc.sent).toContainEqual({ channel: 'split-song', args: ['a'] });
    expect(notification.info).toHaveBeenCalledTimes(1);
  });

  it('tracks split progress including zero', async () => {
    const { result } = await load();

    act(() => result.current.handleSplit('a'));
    act(() => ipc.emit('split-song', { id: 'a', progress: 0 }));
    expect(result.current.splitProgress.get('a')).toBe(0);

    act(() => ipc.emit('split-song', { id: 'a', progress: 75 }));
    expect(result.current.splitProgress.get('a')).toBe(75);
    expect(result.current.splittingIds.has('a')).toBe(true);
  });

  it('finishes a split successfully, replacing the song', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => result.current.handleSplit('a'));
    act(() => ipc.emit('split-song', { id: 'a', progress: 50 }));
    act(() =>
      ipc.emit('split-song', {
        id: 'a',
        success: true,
        song: song('a', { name: 'Split' }),
      }),
    );

    expect(result.current.splittingIds.has('a')).toBe(false);
    expect(result.current.splitProgress.has('a')).toBe(false);
    expect(result.current.songList[0].name).toBe('Split');
    expect(notification.success).toHaveBeenCalledTimes(1);
  });

  it('finishes a split with an error notification', async () => {
    const { result } = await load();

    act(() => result.current.handleSplit('a'));
    act(() =>
      ipc.emit('split-song', { id: 'a', success: false, error: 'failed' }),
    );

    expect(result.current.splittingIds.has('a')).toBe(false);
    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      description: 'failed',
    });
  });

  it('likes a song and persists the change', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => result.current.handleLikeChange('a', true));

    expect(ipc.sent).toContainEqual({
      channel: 'like-song',
      args: ['a', true],
    });
    expect(result.current.songList[0].liked).toBe(true);
  });

  it('ignores a like change for an unknown song', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => result.current.handleLikeChange('missing', true));

    expect(ipc.sent.filter((s) => s.channel === 'like-song')).toHaveLength(0);
  });

  it('applies an update-song reply to the matching song', async () => {
    const { result } = await load();

    act(() =>
      ipc.emit('load-song-list', { songs: [song('a')], lastOpenedPath: '/a' }),
    );
    act(() => ipc.emit('update-song', song('a', { name: 'Renamed' })));

    expect(result.current.songList[0].name).toBe('Renamed');
  });

  it('notifies when loading the song list fails', async () => {
    await load();

    act(() => ipc.emit('load-song-list', { error: 'read failed' }));

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      message: "Couldn't load your songs",
    });
  });

  it('notifies and clears progress when a rescan fails', async () => {
    const { result } = await load();

    act(() => ipc.emit('rescan-songs', { current: 1, total: 4 }));
    act(() => ipc.emit('rescan-songs', { error: 'scan failed' }));

    expect(result.current.scanProgress).toBeUndefined();
    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      message: "Couldn't scan your library",
    });
  });

  it('notifies when saving a song update fails', async () => {
    await load();

    act(() => ipc.emit('update-song', { error: 'write failed' }));

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      message: "Couldn't save your progress",
    });
  });

  it('unsubscribes from rescan and split listeners on unmount', async () => {
    const { unmount } = await load();

    expect(ipc.onCount('rescan-songs')).toBe(1);
    expect(ipc.onCount('split-song')).toBe(1);

    unmount();

    expect(ipc.onCount('rescan-songs')).toBe(0);
    expect(ipc.onCount('split-song')).toBe(0);
  });
});
