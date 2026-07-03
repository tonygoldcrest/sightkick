import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStore, lastReply, makeEvent, makeStore } from './test-support';
import { toAssetUrl } from '../util';

const storeHolder = vi.hoisted(() => ({
  current: undefined as FakeStore | undefined,
}));
const spawnHolder = vi.hoisted(() => ({
  procs: [] as FakeProc[],
  mock: undefined as ReturnType<typeof vi.fn> | undefined,
}));

interface FakeEmitter {
  on: (event: string, cb: (...args: unknown[]) => void) => FakeEmitter;
  emit: (event: string, ...args: unknown[]) => void;
}

interface FakeProc extends FakeEmitter {
  stderr: FakeEmitter;
  stdout: FakeEmitter;
  killed: boolean;
  kill: () => void;
}

vi.mock('../AppState', () => ({
  appState: {
    store: {
      get: (key: string) => storeHolder.current!.get(key),
      set: (key: string, value: unknown) =>
        storeHolder.current!.set(key, value),
    },
  },
}));

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}));

vi.mock('child_process', () => {
  const makeEmitter = (): FakeEmitter => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    return {
      on(event, cb) {
        (listeners[event] ??= []).push(cb);

        return this;
      },
      emit(event, ...args) {
        (listeners[event] ?? []).forEach((cb) => cb(...args));
      },
    };
  };
  const spawn = vi.fn(() => {
    const proc = makeEmitter() as FakeProc;

    proc.stderr = makeEmitter();
    proc.stdout = makeEmitter();
    proc.killed = false;
    proc.kill = () => {
      proc.killed = true;
      proc.emit('close', null, 'SIGTERM');
    };
    spawnHolder.procs.push(proc);

    return proc;
  });

  spawnHolder.mock = spawn;

  return { spawn, default: { spawn } };
});

const { splitSong, cancelSplit, killActiveSplit } = await import('./splitSong');

function makeSongDir(root: string) {
  const dir = path.join(root, 'My Song');

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'song.ini'), '[Song]\nname = My Song\n');
  fs.writeFileSync(path.join(dir, 'notes.chart'), '[Song]\n{\n}\n');
  fs.writeFileSync(path.join(dir, 'mix.ogg'), 'audio');

  return dir;
}

function makeStemOutput(dir: string) {
  const out = path.join(dir, 'stems', 'htdemucs', 'mix');

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'drums.mp3'), 'drums');
  fs.writeFileSync(path.join(out, 'bass.mp3'), 'bass');
  fs.writeFileSync(path.join(out, 'vocals.mp3'), 'vocals');
  fs.writeFileSync(path.join(out, 'other.mp3'), 'other');
}

function songEntry(dir: string) {
  return {
    id: 'song-1',
    dir,
    format: 'chart',
    audio: [{ src: toAssetUrl(path.join(dir, 'mix.ogg')), name: 'mix' }],
  };
}

async function waitForProc(index: number) {
  await vi.waitFor(() =>
    expect(spawnHolder.procs.length).toBeGreaterThan(index),
  );

  return spawnHolder.procs[index];
}

describe('splitSong', () => {
  let library: string;

  beforeEach(() => {
    library = fs.mkdtempSync(path.join(os.tmpdir(), 'split-'));
    spawnHolder.procs = [];
    spawnHolder.mock?.mockClear();
  });

  afterEach(() => {
    fs.rmSync(library, { recursive: true, force: true });
  });

  it('replies with an error when the song has no audio', async () => {
    const dir = makeSongDir(library);

    storeHolder.current = makeStore({
      songs: { 'song-1': { ...songEntry(dir), audio: [] } },
    });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    await vi.waitFor(() =>
      expect(lastReply(event, 'split-song')).toBeDefined(),
    );

    expect(lastReply(event, 'split-song')!.args[0]).toMatchObject({
      id: 'song-1',
      success: false,
      error: 'No audio file found',
    });
  });

  it('forwards demucs progress parsed from stderr', async () => {
    const dir = makeSongDir(library);

    makeStemOutput(dir);
    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);

    proc.stderr.emit('data', Buffer.from(' 42%|####'));

    expect(
      event.replies.find((r) => (r.args[0] as { progress?: number }).progress),
    ).toMatchObject({ args: [{ id: 'song-1', progress: 42 }] });

    proc.emit('close', 0, null);
    await vi.waitFor(() =>
      expect(
        (lastReply(event, 'split-song')!.args[0] as { success?: boolean })
          .success,
      ).toBe(true),
    );
  });

  it('relocates stems and rebuilds the song on success', async () => {
    const dir = makeSongDir(library);

    makeStemOutput(dir);
    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);

    proc.emit('close', 0, null);

    await vi.waitFor(() =>
      expect(
        (lastReply(event, 'split-song')!.args[0] as { success?: boolean })
          .success,
      ).toBe(true),
    );

    expect(fs.existsSync(path.join(dir, 'song.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'drums.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'bass.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'vocals.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'other.mp3'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'mix.ogg'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'stems'))).toBe(false);

    const stored = storeHolder.current.get('songs.song-1') as { id: string };

    expect(stored.id).toBe('song-1');
  });

  it('runs a full split rather than isolating only drums', async () => {
    const dir = makeSongDir(library);

    makeStemOutput(dir);
    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);
    const args = spawnHolder.mock!.mock.calls[0][1] as string[];

    expect(args).not.toContain('--two-stems=drums');
    expect(args.some((arg) => arg.startsWith('--two-stems'))).toBe(false);

    proc.emit('close', 0, null);
    await vi.waitFor(() =>
      expect(lastReply(event, 'split-song')).toBeDefined(),
    );
  });

  it('reports a non-zero exit code as a failure', async () => {
    const dir = makeSongDir(library);

    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);

    proc.stderr.emit('data', Buffer.from('boom'));
    proc.emit('close', 2, null);

    await vi.waitFor(() =>
      expect(
        (lastReply(event, 'split-song')!.args[0] as { error?: string }).error,
      ).toContain('code 2'),
    );
  });

  it('cancels the active split by killing the process', async () => {
    const dir = makeSongDir(library);

    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);

    cancelSplit(event as never, 'song-1');

    expect(proc.killed).toBe(true);

    await vi.waitFor(() =>
      expect(lastReply(event, 'split-song')!.args[0]).toMatchObject({
        cancelled: true,
      }),
    );
  });

  it('kills the running split on shutdown', async () => {
    const dir = makeSongDir(library);

    storeHolder.current = makeStore({ songs: { 'song-1': songEntry(dir) } });

    const event = makeEvent();

    splitSong(event as never, 'song-1');

    const proc = await waitForProc(0);

    killActiveSplit();

    expect(proc.killed).toBe(true);
  });

  it('does not throw when killing with no active split', () => {
    expect(() => killActiveSplit()).not.toThrow();
  });

  it('cancels a queued split without killing the running one', async () => {
    const dir = makeSongDir(library);

    storeHolder.current = makeStore({
      songs: {
        'song-1': songEntry(dir),
        'song-2': { ...songEntry(dir), id: 'song-2' },
      },
    });

    const eventA = makeEvent();
    const eventB = makeEvent();

    splitSong(eventA as never, 'song-1');

    const running = await waitForProc(0);

    splitSong(eventB as never, 'song-2');
    cancelSplit(eventB as never, 'song-2');

    expect(lastReply(eventB, 'split-song')!.args[0]).toMatchObject({
      id: 'song-2',
      cancelled: true,
    });
    expect(running.killed).toBe(false);

    running.emit('close', 0, null);
    await vi.waitFor(() =>
      expect(lastReply(eventA, 'split-song')).toBeDefined(),
    );
  });
});
