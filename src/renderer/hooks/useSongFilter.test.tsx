import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongData } from '../../types';
import { Difficulty } from 'scan-chart';
import { installLocalStorage } from './test-support';

const onlineState = vi.hoisted(() => ({
  current: {
    results: [] as SongData[],
    total: undefined as number | undefined,
    loading: false,
    loadMore: () => {},
  },
  calls: [] as { active: boolean; search: string; difficulty: Difficulty }[],
}));

vi.mock('./useOnlineSearch', () => ({
  useOnlineSearch: (
    active: boolean,
    search: string,
    difficulty: Difficulty,
  ) => {
    onlineState.calls.push({ active, search, difficulty });

    return onlineState.current;
  },
}));

import { useSongFilter } from './useSongFilter';

function song(id: string, extra: Partial<SongData> = {}): SongData {
  return {
    id,
    name: id,
    artist: '',
    charter: '',
    diff_drums: '',
    drumDifficulties: ['easy', 'medium', 'hard', 'expert'],
    ...extra,
  } as SongData;
}

beforeEach(() => {
  installLocalStorage();
  onlineState.calls.length = 0;
  onlineState.current = {
    results: [],
    total: undefined,
    loading: false,
    loadMore: () => {},
  };
});

function ids(list: SongData[]) {
  return list.map((s) => s.id);
}

describe('useSongFilter', () => {
  it('sorts favourites first regardless of direction', () => {
    const list = [
      song('a', { liked: false }),
      song('b', { liked: true }),
      song('c', { liked: false }),
    ];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    expect(result.current.filteredSongList[0].id).toBe('b');

    act(() => result.current.setSort({ key: 'favorite', direction: 'desc' }));

    expect(result.current.filteredSongList[0].id).toBe('b');
  });

  it('sorts by name ascending and descending', () => {
    const list = [song('Charlie'), song('alpha'), song('Bravo')];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    act(() => result.current.setSort({ key: 'name', direction: 'asc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'alpha',
      'Bravo',
      'Charlie',
    ]);

    act(() => result.current.setSort({ key: 'name', direction: 'desc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'Charlie',
      'Bravo',
      'alpha',
    ]);
  });

  it('sorts by last added, treating missing dates as oldest', () => {
    const list = [
      song('old', { updatedAt: '2020-01-01T00:00:00.000Z' }),
      song('new', { updatedAt: '2024-01-01T00:00:00.000Z' }),
      song('none'),
    ];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    act(() => result.current.setSort({ key: 'lastAdded', direction: 'desc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'new',
      'old',
      'none',
    ]);

    act(() => result.current.setSort({ key: 'lastAdded', direction: 'asc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'none',
      'old',
      'new',
    ]);
  });

  it('sorts by difficulty, treating empty strings as unranked', () => {
    const list = [
      song('hard', { diff_drums: '5' }),
      song('blank', { diff_drums: '' }),
      song('easy', { diff_drums: '0' }),
    ];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    act(() => result.current.setSort({ key: 'difficulty', direction: 'asc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'blank',
      'easy',
      'hard',
    ]);

    act(() => result.current.setSort({ key: 'difficulty', direction: 'desc' }));
    expect(ids(result.current.filteredSongList)).toEqual([
      'hard',
      'easy',
      'blank',
    ]);
  });

  it('fuzzy-filters by name when a name filter is set', () => {
    const list = [
      song('Master of Puppets', { artist: 'Metallica' }),
      song('Enter Sandman', { artist: 'Metallica' }),
      song('Painkiller', { artist: 'Judas Priest' }),
    ];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    act(() => result.current.setNameFilter('puppets'));

    expect(ids(result.current.filteredSongList)).toContain('Master of Puppets');
    expect(ids(result.current.filteredSongList)).not.toContain('Painkiller');
  });

  it('hides local songs that lack the selected difficulty', () => {
    const list = [
      song('full'),
      song('expert-only', { drumDifficulties: ['expert'] }),
      song('easy-only', { drumDifficulties: ['easy'] }),
    ];
    const { result, rerender } = renderHook(
      ({ d }: { d: Difficulty }) => useSongFilter(list, d),
      { initialProps: { d: 'easy' as Difficulty } },
    );

    expect(ids(result.current.filteredSongList).sort()).toEqual([
      'easy-only',
      'full',
    ]);

    rerender({ d: 'expert' });

    expect(ids(result.current.filteredSongList).sort()).toEqual([
      'expert-only',
      'full',
    ]);
  });

  it('hides local songs whose difficulties are unknown', () => {
    const list = [
      song('known'),
      song('legacy', { drumDifficulties: undefined }),
    ];
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    expect(ids(result.current.filteredSongList)).toEqual(['known']);
  });

  it('passes the selected difficulty to the online search', () => {
    renderHook(() => useSongFilter([], 'hard'));

    expect(onlineState.calls.at(-1)).toMatchObject({ difficulty: 'hard' });
  });

  it('returns online results when in online mode', () => {
    onlineState.current.results = [song('online-1'), song('online-2')];

    const { result } = renderHook(() =>
      useSongFilter([song('local')], 'expert'),
    );

    act(() => result.current.setLibraryMode('online'));

    expect(ids(result.current.filteredSongList)).toEqual([
      'online-1',
      'online-2',
    ]);
  });

  it('activates online search only in online mode', () => {
    const { result } = renderHook(() => useSongFilter([], 'expert'));

    expect(onlineState.calls.at(-1)).toMatchObject({ active: false });

    act(() => result.current.setLibraryMode('online'));

    expect(onlineState.calls.at(-1)).toMatchObject({ active: true });
  });

  it('persists the chosen sort across remounts', () => {
    const list = [song('Charlie'), song('alpha'), song('Bravo')];
    const first = renderHook(() => useSongFilter(list, 'expert'));

    act(() => first.result.current.setSort({ key: 'name', direction: 'desc' }));
    first.unmount();

    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    expect(result.current.sort).toEqual({ key: 'name', direction: 'desc' });
    expect(ids(result.current.filteredSongList)).toEqual([
      'Charlie',
      'Bravo',
      'alpha',
    ]);
  });

  it('does not mutate the input song list while sorting', () => {
    const list = [song('b'), song('a'), song('c')];
    const snapshot = ids(list);
    const { result } = renderHook(() => useSongFilter(list, 'expert'));

    act(() => result.current.setSort({ key: 'name', direction: 'asc' }));

    expect(ids(list)).toEqual(snapshot);
  });
});
