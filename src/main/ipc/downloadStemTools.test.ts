import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastReply, makeEvent } from './test-support';
import { IpcDownloadStemToolsResponse } from '../../types';

const userDataHolder = vi.hoisted(() => ({ current: '' }));
const spawnHolder = vi.hoisted(() => ({ procs: [] as FakeProc[] }));

interface FakeEmitter {
  on: (event: string, cb: (...args: unknown[]) => void) => FakeEmitter;
  emit: (event: string, ...args: unknown[]) => void;
}

interface FakeProc extends FakeEmitter {
  stderr: FakeEmitter;
  kill: () => void;
}

vi.mock('electron', () => ({
  app: { getPath: () => userDataHolder.current },
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
    proc.kill = () => proc.emit('close', null, 'SIGTERM');
    spawnHolder.procs.push(proc);

    return proc;
  });

  return { spawn, default: { spawn } };
});

const { downloadStemTools, cancelStemTools } = await import(
  './downloadStemTools'
);

function setPlatform(platform: NodeJS.Platform, arch = process.arch) {
  Object.defineProperty(process, 'platform', { value: platform });
  Object.defineProperty(process, 'arch', { value: arch });
}

function archiveResponse(chunks: Uint8Array[], contentLength = 0) {
  let index = 0;

  return {
    ok: true,
    headers: { get: () => (contentLength ? String(contentLength) : null) },
    body: {
      getReader: () => ({
        read: () =>
          index < chunks.length
            ? Promise.resolve({ done: false, value: chunks[index++] })
            : Promise.resolve({ done: true, value: undefined }),
      }),
    },
  };
}

function stubFetch(
  manifest: unknown,
  archive: ReturnType<typeof archiveResponse>,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('.json')
          ? { ok: true, json: () => Promise.resolve(manifest) }
          : archive,
      ),
    ),
  );
}

function bundleDir() {
  return path.join(userDataHolder.current, 'stem-tools', 'demucs-split');
}

function findStaging(): string {
  const root = path.join(userDataHolder.current, 'stem-tools');
  const entry = fs.readdirSync(root).find((e) => e.startsWith('.staging'));

  return path.join(root, entry!);
}

function populateStaging(files: string[]) {
  const stagingBundle = path.join(findStaging(), 'demucs-split');

  for (const file of files) {
    const full = path.join(stagingBundle, file);

    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'x');
  }
}

async function waitForProc() {
  await vi.waitFor(() => expect(spawnHolder.procs.length).toBeGreaterThan(0));

  return spawnHolder.procs[0];
}

function replies(event: ReturnType<typeof makeEvent>) {
  return event.replies
    .filter((r) => r.channel === 'download-stem-tools')
    .map((r) => r.args[0] as IpcDownloadStemToolsResponse);
}

describe('downloadStemTools', () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  beforeEach(() => {
    userDataHolder.current = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-'));
    spawnHolder.procs = [];
    setPlatform('darwin', 'arm64');
  });

  afterEach(() => {
    setPlatform(originalPlatform, originalArch);
    vi.unstubAllGlobals();
    fs.rmSync(userDataHolder.current, { recursive: true, force: true });

    try {
      fs.unlinkSync(path.join(os.tmpdir(), 'demucs-split-mac-arm64.tar.gz'));
    } catch {
      // archive may have been cleaned up already
    }
  });

  it('reports failure on an unsupported platform', async () => {
    setPlatform('linux', 'x64');

    const event = makeEvent();

    await downloadStemTools(event as never);

    expect(lastReply(event, 'download-stem-tools')!.args[0]).toMatchObject({
      success: false,
      error: 'Unsupported platform',
    });
  });

  it('reports failure when the manifest cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    );

    const event = makeEvent();

    await downloadStemTools(event as never);

    const reply = lastReply(event, 'download-stem-tools')!.args[0] as {
      success: boolean;
      error: string;
    };

    expect(reply.success).toBe(false);
    expect(reply.error).toContain('Manifest download failed');
  });

  it('downloads, extracts, validates and installs atomically', async () => {
    const manifest = { version: '2.0.0', fileCount: 2 };

    stubFetch(
      manifest,
      archiveResponse([new Uint8Array(50), new Uint8Array(50)], 100),
    );

    const event = makeEvent();
    const done = downloadStemTools(event as never);
    const proc = await waitForProc();

    populateStaging(['demucs-split', '_internal/torch/_C.so']);
    proc.emit('close', 0, null);
    await done;

    const all = replies(event);

    expect(
      all.filter((r) => r.phase === 'downloading').map((r) => r.progress),
    ).toEqual([25, 50]);
    expect(all.some((r) => r.phase === 'extracting')).toBe(true);
    expect(lastReply(event, 'download-stem-tools')!.args[0]).toEqual({
      success: true,
    });

    expect(fs.existsSync(path.join(bundleDir(), 'demucs-split'))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir(), '_internal/torch/_C.so'))).toBe(
      true,
    );

    const installed = JSON.parse(
      fs.readFileSync(path.join(bundleDir(), 'manifest.json'), 'utf-8'),
    );

    expect(installed.version).toBe('2.0.0');
    expect(fs.existsSync(findStagingSafe())).toBe(false);
  });

  it('does not repeat identical download progress values', async () => {
    const manifest = { version: '2.0.0', fileCount: 2 };

    stubFetch(
      manifest,
      archiveResponse(
        [new Uint8Array(1), new Uint8Array(1), new Uint8Array(98)],
        100,
      ),
    );

    const event = makeEvent();
    const done = downloadStemTools(event as never);
    const proc = await waitForProc();

    populateStaging(['demucs-split', '_internal/torch/_C.so']);
    proc.emit('close', 0, null);
    await done;

    const progresses = replies(event)
      .filter((r) => r.phase === 'downloading')
      .map((r) => r.progress);

    expect(progresses).toEqual([1, 50]);
  });

  it('fails when the extraction is incomplete versus the manifest', async () => {
    const manifest = { version: '2.0.0', fileCount: 2 };

    stubFetch(manifest, archiveResponse([new Uint8Array(10)]));

    const event = makeEvent();
    const done = downloadStemTools(event as never);
    const proc = await waitForProc();

    populateStaging(['demucs-split']);
    proc.emit('close', 0, null);
    await done;

    const reply = lastReply(event, 'download-stem-tools')!.args[0] as {
      success: boolean;
      error: string;
    };

    expect(reply.success).toBe(false);
    expect(reply.error).toContain('Incomplete extraction');
    expect(fs.existsSync(bundleDir())).toBe(false);
    expect(fs.existsSync(findStagingSafe())).toBe(false);
  });

  it('reports failure when tar exits non-zero', async () => {
    stubFetch(
      { version: '2.0.0', fileCount: 1 },
      archiveResponse([new Uint8Array(10)]),
    );

    const event = makeEvent();
    const done = downloadStemTools(event as never);
    const proc = await waitForProc();

    proc.stderr.emit('data', Buffer.from('tar: path too long'));
    proc.emit('close', 2, null);
    await done;

    const reply = lastReply(event, 'download-stem-tools')!.args[0] as {
      success: boolean;
      error: string;
    };

    expect(reply.success).toBe(false);
    expect(reply.error).toContain('Extraction failed with code 2');
  });

  it('cancels mid-extraction, cleans up and keeps any prior install', async () => {
    const previous = path.join(bundleDir());

    fs.mkdirSync(previous, { recursive: true });
    fs.writeFileSync(path.join(previous, 'demucs-split'), 'old');

    stubFetch(
      { version: '2.0.0', fileCount: 1 },
      archiveResponse([new Uint8Array(10)]),
    );

    const event = makeEvent();
    const done = downloadStemTools(event as never);

    await waitForProc();
    cancelStemTools();
    await done;

    expect(lastReply(event, 'download-stem-tools')!.args[0]).toEqual({
      success: false,
      cancelled: true,
    });
    expect(fs.existsSync(findStagingSafe())).toBe(false);
    expect(fs.readFileSync(path.join(previous, 'demucs-split'), 'utf-8')).toBe(
      'old',
    );
  });
});

function findStagingSafe(): string {
  const root = path.join(userDataHolder.current, 'stem-tools');

  try {
    const entry = fs.readdirSync(root).find((e) => e.startsWith('.staging'));

    return entry ? path.join(root, entry) : path.join(root, '.staging-none');
  } catch {
    return path.join(root, '.staging-none');
  }
}
