import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioData, SongData } from '../../types';
import {
  getNotification,
  installIpcMock,
  IpcMock,
  NotificationMock,
  resetNotification,
} from './test-support';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

const { useSongLoader } = await import('./useSongLoader');
let ipc: IpcMock;
let notification: NotificationMock;

function response(
  format: 'mid' | 'chart',
  audio: AudioData[],
  fileData: Buffer = Buffer.from([1, 2, 3]),
) {
  return { data: { format, audio } as SongData, fileData };
}

beforeEach(() => {
  ipc = installIpcMock();
  notification = resetNotification();
  navigate.mockClear();
});

describe('useSongLoader', () => {
  it('registers a reply listener and requests the song', () => {
    renderHook(() => useSongLoader('song-1'));

    expect(ipc.onceCount('load-song')).toBe(1);
    expect(ipc.sent).toEqual([{ channel: 'load-song', args: ['song-1'] }]);
  });

  it('exposes file data, format and song data from the reply', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));
    const fileData = Buffer.from([9, 9]);

    act(() => {
      ipc.emit('load-song', response('chart', [], fileData));
    });

    expect(result.current.fileData).toBe(fileData);
    expect(result.current.format).toBe('chart');
    expect(result.current.songData).not.toBeNull();
  });

  it('groups every drums stem into a single track placed first', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));

    act(() => {
      ipc.emit(
        'load-song',
        response('mid', [
          { name: 'song', src: 'song.ogg' },
          { name: 'drums_1', src: 'd1.ogg' },
          { name: 'drums_2', src: 'd2.ogg' },
          { name: 'guitar', src: 'g.ogg' },
        ]),
      );
    });

    expect(result.current.trackData).toEqual([
      { name: 'drums', urls: ['d1.ogg', 'd2.ogg'] },
      { name: 'song', urls: ['song.ogg'] },
      { name: 'guitar', urls: ['g.ogg'] },
    ]);
  });

  it('omits the drums track when there are no drums stems', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));

    act(() => {
      ipc.emit('load-song', response('mid', [{ name: 'song', src: 's.ogg' }]));
    });

    expect(result.current.trackData).toEqual([
      { name: 'song', urls: ['s.ogg'] },
    ]);
  });

  it('handles an empty audio list', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));

    act(() => {
      ipc.emit('load-song', response('mid', []));
    });

    expect(result.current.trackData).toEqual([]);
  });

  it('re-requests when the id changes', () => {
    const { rerender } = renderHook(({ id }) => useSongLoader(id), {
      initialProps: { id: 'song-1' as string | undefined },
    });

    rerender({ id: 'song-2' });

    expect(ipc.sent).toEqual([
      { channel: 'load-song', args: ['song-1'] },
      { channel: 'load-song', args: ['song-2'] },
    ]);
    expect(ipc.onceCount('load-song')).toBe(2);
  });

  it('sends a request even when the id is undefined', () => {
    renderHook(() => useSongLoader(undefined));

    expect(ipc.sent).toEqual([{ channel: 'load-song', args: [undefined] }]);
  });

  it('does not treat a non-drums name containing "drum" as a drums stem', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));

    act(() => {
      ipc.emit(
        'load-song',
        response('mid', [{ name: 'drum', src: 'drum.ogg' }]),
      );
    });

    expect(result.current.trackData).toEqual([
      { name: 'drum', urls: ['drum.ogg'] },
    ]);
  });

  it('notifies and navigates back to the library when the load fails', () => {
    const { result } = renderHook(() => useSongLoader('song-1'));

    act(() => {
      ipc.emit('load-song', { error: 'chart missing' });
    });

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
    expect(result.current.fileData).toBeUndefined();
  });
});
