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

const { loadSong } = await import('./loadSong');

describe('loadSong', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-song-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replies with the song metadata and the raw chart bytes', () => {
    fs.writeFileSync(path.join(dir, 'notes.mid'), 'MIDI-BYTES');
    storeHolder.current = makeStore({
      songs: { abc: { id: 'abc', dir, format: 'mid' } },
    });

    const event = makeEvent();

    loadSong(event as never, 'abc');

    const reply = lastReply(event, 'load-song')!;
    const payload = reply.args[0] as {
      data: { id: string };
      fileData: Buffer;
    };

    expect(payload.data.id).toBe('abc');
    expect(payload.fileData.toString()).toBe('MIDI-BYTES');
  });

  it('reads notes.chart when the song format is chart', () => {
    fs.writeFileSync(path.join(dir, 'notes.chart'), 'CHART-BYTES');
    storeHolder.current = makeStore({
      songs: { abc: { id: 'abc', dir, format: 'chart' } },
    });

    const event = makeEvent();

    loadSong(event as never, 'abc');

    const payload = lastReply(event, 'load-song')!.args[0] as {
      fileData: Buffer;
    };

    expect(payload.fileData.toString()).toBe('CHART-BYTES');
  });

  it('replies with an error when the song is not in the store', () => {
    storeHolder.current = makeStore({ songs: {} });

    const event = makeEvent();

    loadSong(event as never, 'missing');

    expect(lastReply(event, 'load-song')!.args[0]).toEqual({
      error: 'Song "missing" not found',
    });
  });

  it('replies with an error when the chart file cannot be read', () => {
    storeHolder.current = makeStore({
      songs: { abc: { id: 'abc', dir, format: 'mid' } },
    });

    const event = makeEvent();

    loadSong(event as never, 'abc');

    const payload = lastReply(event, 'load-song')!.args[0] as {
      error: string;
    };

    expect(payload.error).toContain('ENOENT');
  });
});
