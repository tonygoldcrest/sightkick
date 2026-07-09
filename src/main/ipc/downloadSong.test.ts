import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStore, lastReply, makeEvent, makeStore } from './test-support';

const storeHolder = vi.hoisted(() => ({
  current: undefined as FakeStore | undefined,
}));
const sngHolder = vi.hoisted(() => ({
  files: [] as { name: string; data: string }[],
  shouldError: false,
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

vi.mock('@eliwhite/parse-sng', () => ({
  SngStream: class {
    private handlers = new Map<string, (...args: unknown[]) => void>();

    on(event: string, cb: (...args: unknown[]) => void) {
      this.handlers.set(event, cb);
    }

    start() {
      if (sngHolder.shouldError) {
        this.handlers.get('error')?.(new Error('bad sng'));

        return;
      }

      const fileCb = this.handlers.get('file')!;
      let index = 0;
      const emitNext = () => {
        const file = sngHolder.files[index];

        index += 1;

        const data = new TextEncoder().encode(file.data);
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(data);
            controller.close();
          },
        });
        const nextFile = index < sngHolder.files.length ? emitNext : null;

        fileCb(file.name, stream, nextFile);
      };

      if (sngHolder.files.length) {
        emitNext();
      }
    }
  },
}));

const { downloadSong } = await import('./downloadSong');
const VALID_SONG = [
  { name: 'song.ini', data: '[Song]\nname = Test\n' },
  {
    name: 'notes.chart',
    data: '[Song]\n{\n  Resolution = 192\n}\n[ExpertDrums]\n{\n  0 = N 0 0\n}\n',
  },
];

function okFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      }),
    ),
  );
}

const baseProps = {
  url: 'https://example.com/song.sng',
  md5: 'hash123',
  name: 'Song',
  artist: 'Artist',
  charter: 'Charter',
};

describe('downloadSong', () => {
  let library: string;

  beforeEach(() => {
    library = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-library-'));
    sngHolder.files = VALID_SONG;
    sngHolder.shouldError = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(library, { recursive: true, force: true });
  });

  it('fails when no library folder has been selected', async () => {
    storeHolder.current = makeStore({});
    okFetch();

    const event = makeEvent();

    await downloadSong(event as never, baseProps);

    expect(lastReply(event, 'download-song')!.args[0]).toMatchObject({
      success: false,
      md5: 'hash123',
      error: 'No folder selected',
    });
  });

  it('reports failure when the download response is not ok', async () => {
    storeHolder.current = makeStore({ lastOpenedPath: library });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    );

    const event = makeEvent();

    await downloadSong(event as never, baseProps);

    const reply = lastReply(event, 'download-song')!.args[0] as {
      success: boolean;
      error: string;
    };

    expect(reply.success).toBe(false);
    expect(reply.error).toContain('404');
  });

  it('writes the unpacked song, persists it and replies success', async () => {
    storeHolder.current = makeStore({ lastOpenedPath: library });
    okFetch();

    const event = makeEvent();

    await downloadSong(event as never, baseProps);

    const outputDir = path.join(library, 'Artist - Song (Charter)');

    expect(fs.existsSync(path.join(outputDir, 'song.ini'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'notes.chart'))).toBe(true);

    const stored = storeHolder.current.get('songs.hash123') as { id: string };

    expect(stored.id).toBe('hash123');

    const reply = lastReply(event, 'download-song')!.args[0] as {
      success: boolean;
      song: { id: string; updatedAt: string };
    };

    expect(reply.success).toBe(true);
    expect(reply.song.id).toBe('hash123');
    expect(reply.song.updatedAt).toMatch(/^\d{4}-/);
  });

  it('strips filesystem-illegal characters from the folder name', async () => {
    storeHolder.current = makeStore({ lastOpenedPath: library });
    okFetch();

    const event = makeEvent();

    await downloadSong(event as never, {
      ...baseProps,
      artist: 'AC/DC',
      name: 'Hells: Bells?',
      charter: 'X*Y',
    });

    expect(fs.existsSync(path.join(library, 'ACDC - Hells Bells (XY)'))).toBe(
      true,
    );
  });

  it('rejects an archive entry that escapes the output directory', async () => {
    storeHolder.current = makeStore({ lastOpenedPath: library });
    sngHolder.files = [
      ...VALID_SONG,
      { name: '../escaped.txt', data: 'pwned' },
    ];
    okFetch();

    const event = makeEvent();

    await downloadSong(event as never, baseProps);

    expect(fs.existsSync(path.join(library, 'escaped.txt'))).toBe(false);
    expect(lastReply(event, 'download-song')!.args[0]).toMatchObject({
      success: false,
      md5: 'hash123',
    });
  });

  it('reports failure when the SNG stream errors', async () => {
    storeHolder.current = makeStore({ lastOpenedPath: library });
    sngHolder.shouldError = true;
    okFetch();

    const event = makeEvent();

    await downloadSong(event as never, baseProps);

    expect(lastReply(event, 'download-song')!.args[0]).toMatchObject({
      success: false,
      md5: 'hash123',
    });
  });
});
