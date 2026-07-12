import { describe, expect, it } from 'vitest';
import {
  nextDifficulty,
  nextSongIndex,
  sortForFocusedIndex,
  sortIndexForKey,
  toggledSortForIndex,
  wrapSortIndex,
} from './helpers';
import { SortState } from '../../components/SortButton';
import { ALL_DIFFICULTIES } from '../../../constants';

describe('nextSongIndex', () => {
  it('starts at the end going up from no selection', () => {
    expect(nextSongIndex(undefined, 5, -1)).toBe(4);
  });

  it('starts at the top going down from no selection', () => {
    expect(nextSongIndex(undefined, 5, 1)).toBe(0);
  });

  it('wraps past the end going down', () => {
    expect(nextSongIndex(4, 5, 1)).toBe(0);
  });

  it('wraps past the start going up', () => {
    expect(nextSongIndex(0, 5, -1)).toBe(4);
  });

  it('returns 0 for an empty list', () => {
    expect(nextSongIndex(undefined, 0, 1)).toBe(0);
    expect(nextSongIndex(3, 0, -1)).toBe(0);
  });
});

describe('wrapSortIndex', () => {
  it('wraps within the sort options', () => {
    expect(wrapSortIndex(0, -1)).toBe(3);
    expect(wrapSortIndex(3, 1)).toBe(0);
    expect(wrapSortIndex(1, 1)).toBe(2);
  });
});

describe('sortForFocusedIndex', () => {
  it('forces ascending for favorite', () => {
    const current: SortState = { key: 'name', direction: 'desc' };

    expect(sortForFocusedIndex(1, current)).toEqual({
      key: 'favorite',
      direction: 'asc',
    });
  });

  it('keeps the direction when re-selecting the same key', () => {
    const current: SortState = { key: 'name', direction: 'desc' };

    expect(sortForFocusedIndex(0, current)).toEqual({
      key: 'name',
      direction: 'desc',
    });
  });

  it('resets to ascending when moving to a different key', () => {
    const current: SortState = { key: 'name', direction: 'desc' };

    expect(sortForFocusedIndex(2, current)).toEqual({
      key: 'lastAdded',
      direction: 'asc',
    });
  });
});

describe('toggledSortForIndex', () => {
  it('flips the direction for a directional key', () => {
    const current: SortState = { key: 'name', direction: 'asc' };

    expect(toggledSortForIndex(0, current)).toEqual({
      key: 'name',
      direction: 'desc',
    });
  });

  it('returns undefined for a non-directional key (favorite)', () => {
    const current: SortState = { key: 'favorite', direction: 'asc' };

    expect(toggledSortForIndex(1, current)).toBeUndefined();
  });
});

describe('sortIndexForKey', () => {
  it('finds the index of a key', () => {
    expect(sortIndexForKey('lastAdded')).toBe(2);
  });

  it('falls back to 0 for an unknown key', () => {
    expect(sortIndexForKey(null)).toBe(0);
  });
});

describe('nextDifficulty', () => {
  it('advances to the next difficulty', () => {
    expect(nextDifficulty(ALL_DIFFICULTIES[0])).toBe(ALL_DIFFICULTIES[1]);
  });

  it('wraps from the last back to the first', () => {
    const last = ALL_DIFFICULTIES[ALL_DIFFICULTIES.length - 1];

    expect(nextDifficulty(last)).toBe(ALL_DIFFICULTIES[0]);
  });
});
