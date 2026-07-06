import { describe, expect, it, vi } from 'vitest';
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

const { updateSong } = await import('./updateSong');

describe('updateSong', () => {
  it('merges the payload into the stored song and persists it', () => {
    storeHolder.current = makeStore({
      songs: { abc: { id: 'abc', name: 'Song', liked: false } },
    });

    const event = makeEvent();

    updateSong(event as never, { id: 'abc', liked: true } as never);

    expect(storeHolder.current.get('songs.abc')).toMatchObject({
      id: 'abc',
      name: 'Song',
      liked: true,
    });
    expect(lastReply(event, 'update-song')!.args[0]).toMatchObject({
      liked: true,
    });
  });

  it('deep-merges score data instead of replacing it', () => {
    storeHolder.current = makeStore({
      songs: {
        abc: { id: 'abc', scoreData: { easy: { score: 1 } } },
      },
    });

    const event = makeEvent();

    updateSong(
      event as never,
      {
        id: 'abc',
        scoreData: { expert: { score: 9 } },
      } as never,
    );

    expect(storeHolder.current.get('songs.abc')).toMatchObject({
      scoreData: { easy: { score: 1 }, expert: { score: 9 } },
    });
  });

  it('replies with an error when the song is not in the store', () => {
    storeHolder.current = makeStore({ songs: {} });

    const event = makeEvent();

    updateSong(event as never, { id: 'missing', liked: true } as never);

    expect(lastReply(event, 'update-song')!.args[0]).toEqual({
      error: 'Song "missing" not found',
    });
  });
});
