import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStore, lastReply, makeEvent, makeStore } from './test-support';

const storeHolder = vi.hoisted(() => ({
  current: undefined as FakeStore | undefined,
}));

vi.mock('../AppState', () => ({
  appState: {
    store: {
      get: (key: string) => storeHolder.current!.get(key),
      set: (key: string, value: unknown) =>
        storeHolder.current!.set(key, value),
    },
  },
}));

const { loadSongList } = await import('./loadSongList');

describe('loadSongList', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('replies empty when no library path is set', async () => {
    storeHolder.current = makeStore({});

    const event = makeEvent();

    await loadSongList(event as never);

    expect(lastReply(event, 'load-song-list')!.args[0]).toEqual({
      songs: [],
      lastOpenedPath: null,
    });
  });

  it('replies empty when the stored library path no longer exists', async () => {
    storeHolder.current = makeStore({
      lastOpenedPath: path.join(root, 'gone'),
    });

    const event = makeEvent();

    await loadSongList(event as never);

    expect(lastReply(event, 'load-song-list')!.args[0]).toMatchObject({
      songs: [],
    });
  });

  it('returns only songs under the library, passing the stored updatedAt through unchanged', async () => {
    const inside = path.join(root, 'inside');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'other-'));
    const storedUpdatedAt = '2020-05-01T12:00:00.000Z';

    fs.mkdirSync(inside);
    storeHolder.current = makeStore({
      lastOpenedPath: root,
      songs: {
        a: { id: 'a', dir: inside, updatedAt: storedUpdatedAt },
        b: { id: 'b', dir: outside },
      },
    });

    const event = makeEvent();

    await loadSongList(event as never);

    const payload = lastReply(event, 'load-song-list')!.args[0] as {
      songs: { id: string; updatedAt: string }[];
    };

    expect(payload.songs.map((s) => s.id)).toEqual(['a']);
    expect(payload.songs[0].updatedAt).toBe(storedUpdatedAt);

    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('skips songs whose directory no longer exists', async () => {
    const inside = path.join(root, 'inside');

    fs.mkdirSync(inside);
    storeHolder.current = makeStore({
      lastOpenedPath: root,
      songs: {
        a: { id: 'a', dir: inside },
        gone: { id: 'gone', dir: path.join(root, 'removed') },
      },
    });

    const event = makeEvent();

    await loadSongList(event as never);

    const payload = lastReply(event, 'load-song-list')!.args[0] as {
      songs: { id: string }[];
    };

    expect(payload.songs.map((s) => s.id)).toEqual(['a']);
  });

  it('replies with an error when the stored songs cannot be read', async () => {
    const base = makeStore({ lastOpenedPath: root });

    storeHolder.current = {
      ...base,
      get: (key: string) => {
        if (key === 'songs') {
          throw new Error('corrupt store');
        }

        return base.get(key);
      },
    };

    const event = makeEvent();

    await loadSongList(event as never);

    expect(lastReply(event, 'load-song-list')!.args[0]).toEqual({
      error: 'corrupt store',
    });
  });
});
