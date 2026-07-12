import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStore, lastReply, makeEvent, makeStore } from './test-support';

const storeHolder = vi.hoisted(() => ({
  current: undefined as FakeStore | undefined,
}));
const dialogHolder = vi.hoisted(() => ({
  result: { canceled: false, filePaths: [] as string[] },
}));

vi.mock('../AppState', () => ({
  appState: {
    store: {
      get: (key: string) => storeHolder.current!.get(key),
      set: (key: string, value: unknown) =>
        storeHolder.current!.set(key, value),
    },
    setLibraryRoot: (root: string) =>
      storeHolder.current!.set('lastOpenedPath', root),
  },
}));

vi.mock('electron', () => ({
  dialog: { showOpenDialog: () => Promise.resolve(dialogHolder.result) },
}));

const { rescanSongs } = await import('./rescanSongs');

function writeSong(
  root: string,
  folder: string,
  opts: { mid?: boolean; chart?: boolean } = { chart: true },
) {
  const dir = path.join(root, folder);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'song.ini'), `[Song]\nname = ${folder}\n`);

  if (opts.mid) {
    fs.writeFileSync(path.join(dir, 'notes.mid'), 'midi');
  }

  if (opts.chart) {
    fs.writeFileSync(path.join(dir, 'notes.chart'), '[Song]\n{\n}\n');
  }

  return dir;
}

describe('rescanSongs', () => {
  let library: string;

  beforeEach(() => {
    library = fs.mkdtempSync(path.join(os.tmpdir(), 'rescan-'));
    dialogHolder.result = { canceled: false, filePaths: [library] };
  });

  afterEach(() => {
    fs.rmSync(library, { recursive: true, force: true });
  });

  it('does nothing when the folder dialog is canceled', async () => {
    dialogHolder.result = { canceled: true, filePaths: [] };
    storeHolder.current = makeStore({ songs: {} });

    const event = makeEvent();

    await rescanSongs(event as never, true);

    expect(event.replies).toHaveLength(0);
  });

  it('scans the chosen folder and replies with the found songs', async () => {
    writeSong(library, 'Song A');
    writeSong(library, 'Song B');
    storeHolder.current = makeStore({ songs: {} });

    const event = makeEvent();

    await rescanSongs(event as never, true);

    expect(storeHolder.current.get('lastOpenedPath')).toBe(library);

    const final = lastReply(event, 'rescan-songs')!.args[0] as {
      songs: { name: string; updatedAt: string }[];
      lastOpenedPath: string;
    };

    expect(final.songs.map((s) => s.name).sort()).toEqual(['Song A', 'Song B']);
    expect(final.lastOpenedPath).toBe(library);
    expect(final.songs[0].updatedAt).toMatch(/^\d{4}-/);
  });

  it('reuses the stored library path when not asked for a new directory', async () => {
    writeSong(library, 'Song A');
    storeHolder.current = makeStore({ lastOpenedPath: library, songs: {} });

    const event = makeEvent();

    await rescanSongs(event as never, false);

    const final = lastReply(event, 'rescan-songs')!.args[0] as {
      lastOpenedPath: string;
    };

    expect(final.lastOpenedPath).toBe(library);
  });

  it('prefers notes.mid over notes.chart within a directory', async () => {
    writeSong(library, 'Both', { mid: true, chart: true });
    storeHolder.current = makeStore({ songs: {} });

    const event = makeEvent();

    await rescanSongs(event as never, true);

    const final = lastReply(event, 'rescan-songs')!.args[0] as {
      songs: { format: string }[];
    };

    expect(final.songs[0].format).toBe('mid');
  });

  it('keeps songs from other libraries and reuses ids for rescanned ones', async () => {
    const dir = writeSong(library, 'Song A');

    storeHolder.current = makeStore({
      songs: {
        kept: { id: 'kept', dir: '/elsewhere/track', name: 'Outside' },
        existing: { id: 'existing', dir, name: 'Song A', liked: true },
      },
    });

    const event = makeEvent();

    await rescanSongs(event as never, true);

    const songs = storeHolder.current.get('songs') as Record<
      string,
      { id: string; liked?: boolean }
    >;

    expect(songs.kept).toBeDefined();
    expect(songs.existing.id).toBe('existing');
    expect(songs.existing.liked).toBe(true);
  });

  it('replies with an error when the scan throws', async () => {
    const base = makeStore({});

    storeHolder.current = {
      ...base,
      get: (key: string) => {
        if (key === 'songs') {
          throw new Error('scan failed');
        }

        return base.get(key);
      },
    };

    const event = makeEvent();

    await rescanSongs(event as never, true);

    expect(lastReply(event, 'rescan-songs')!.args[0]).toEqual({
      error: 'scan failed',
    });
  });
});
