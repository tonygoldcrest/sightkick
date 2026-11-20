import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSongPreview } from './useSongPreview';

class FakeAudio {
  static instances: FakeAudio[] = [];

  src: string;
  duration = 180;
  paused = true;
  readyState = 1;
  preload = 'none';
  #time = 0;
  #listeners = new Map<string, Set<() => void>>();

  constructor(src?: string) {
    this.src = src ?? '';
    FakeAudio.instances.push(this);
  }

  get currentTime() {
    return this.#time;
  }

  set currentTime(value: number) {
    this.#time = value;
    this.#listeners.get('seeked')?.forEach((cb) => cb());
  }

  addEventListener(type: string, cb: () => void) {
    const set = this.#listeners.get(type) ?? new Set();

    set.add(cb);
    this.#listeners.set(type, set);
  }

  emit(type: string) {
    this.#listeners.get(type)?.forEach((cb) => cb());
  }

  removeEventListener(type: string, cb: () => void) {
    this.#listeners.get(type)?.delete(cb);
  }

  play() {
    this.paused = false;

    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  removeAttribute() {}

  load() {}
}

describe('useSongPreview', () => {
  afterEach(() => {
    FakeAudio.instances = [];
    vi.unstubAllGlobals();
  });

  it('starts playback from the middle of the song', async () => {
    vi.stubGlobal('Audio', FakeAudio);

    const { result } = renderHook(() => useSongPreview());

    await act(async () => {
      result.current.playPreview('a', ['song.ogg']);
    });

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].currentTime).toBe(90);
    expect(FakeAudio.instances[0].paused).toBe(false);
    expect(result.current.previewingId).toBe('a');
  });

  it('keeps playing when the same song is asked for again', async () => {
    vi.stubGlobal('Audio', FakeAudio);

    const { result } = renderHook(() => useSongPreview());

    await act(async () => {
      result.current.playPreview('a', ['song.ogg']);
    });
    await act(async () => {
      result.current.playPreview('a', ['song.ogg']);
    });

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].paused).toBe(false);
    expect(result.current.previewingId).toBe('a');
  });

  it('stops the previous song when another one is previewed', async () => {
    vi.stubGlobal('Audio', FakeAudio);

    const { result } = renderHook(() => useSongPreview());

    await act(async () => {
      result.current.playPreview('a', ['a.ogg']);
    });
    await act(async () => {
      result.current.playPreview('b', ['b.ogg']);
    });

    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances[1].paused).toBe(false);
    expect(result.current.previewingId).toBe('b');
  });

  it('stops playback when asked to', async () => {
    vi.stubGlobal('Audio', FakeAudio);

    const { result } = renderHook(() => useSongPreview());

    await act(async () => {
      result.current.playPreview('a', ['song.ogg']);
    });
    act(() => {
      result.current.stopPreview();
    });

    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(result.current.previewingId).toBeNull();
  });

  it('seeks to the middle once the duration becomes known', async () => {
    class LateDuration extends FakeAudio {
      duration = Number.NaN;
    }

    vi.stubGlobal('Audio', LateDuration);

    const { result } = renderHook(() => useSongPreview());

    await act(async () => {
      result.current.playPreview('a', ['late.ogg']);
      await Promise.resolve();
      await Promise.resolve();
    });

    const audio = FakeAudio.instances[0] as LateDuration;

    await act(async () => {
      audio.duration = 200;
      audio.emit('durationchange');
      await Promise.resolve();
    });

    expect(audio.currentTime).toBe(100);
    expect(result.current.previewingId).toBe('a');
  });

  it('puts a library file back in the middle when playback resets to the start', async () => {
    class ResetOnPlay extends FakeAudio {
      play() {
        this.paused = false;
        this.currentTime = 0;

        return Promise.resolve();
      }
    }

    vi.stubGlobal('Audio', ResetOnPlay);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['audio']),
      })),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:song');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const { result } = renderHook(() => useSongPreview());

    act(() => {
      result.current.playPreview('a', ['sightkick://local/song']);
    });

    await waitFor(() => {
      expect(result.current.previewingId).toBe('a');
    });

    expect(FakeAudio.instances[0].src).toBe('blob:song');
    expect(FakeAudio.instances[0].currentTime).toBe(90);
  });
});
