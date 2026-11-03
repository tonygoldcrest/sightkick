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

const { deleteSong } = await import('./deleteSong');

describe('deleteSong', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'delete-library-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('deletes the song folder and drops it from the library', () => {
    const dir = path.join(root, 'Artist - Song');

    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'song.ogg'), 'audio');
    storeHolder.current = makeStore({
      lastOpenedPath: root,
      songs: {
        hash: { id: 'hash', dir, name: 'Song' },
        keep: { id: 'keep', dir: path.join(root, 'other'), name: 'Keep' },
      },
    });

    const event = makeEvent();

    deleteSong(event as never, 'hash');

    expect(fs.existsSync(dir)).toBe(false);
    expect(lastReply(event, 'delete-song')!.args[0]).toEqual({
      success: true,
      id: 'hash',
    });
    expect(storeHolder.current!.get('songs')).toEqual({
      keep: { id: 'keep', dir: path.join(root, 'other'), name: 'Keep' },
    });
  });

  it('refuses to delete a folder outside the library', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));

    storeHolder.current = makeStore({
      lastOpenedPath: root,
      songs: { hash: { id: 'hash', dir: outside } },
    });

    const event = makeEvent();

    deleteSong(event as never, 'hash');

    expect(fs.existsSync(outside)).toBe(true);
    expect(lastReply(event, 'delete-song')!.args[0]).toMatchObject({
      success: false,
      id: 'hash',
    });

    fs.rmSync(outside, { recursive: true, force: true });
  });
});
