import { Difficulty } from 'scan-chart';
import { ALL_DIFFICULTIES } from '../../../constants';
import { OnlineSong } from '../../types';
import { Song } from '../../../types';
import {
  defaultDirectionForKey,
  DIRECTIONAL_KEYS,
  SORT_OPTIONS,
  SortState,
} from '../../components/SortButton';

export function nextSongIndex(
  current: number | undefined,
  length: number,
  direction: 1 | -1,
): number {
  if (length === 0) {
    return 0;
  }

  if (current === undefined) {
    return direction === -1 ? length - 1 : 0;
  }

  return (current + direction + length) % length;
}

export function wrapSortIndex(current: number, delta: number): number {
  return (current + delta + SORT_OPTIONS.length) % SORT_OPTIONS.length;
}

export function sortForFocusedIndex(
  index: number,
  currentSort: SortState,
): SortState {
  const { key } = SORT_OPTIONS[index];

  if (key === 'favorite') {
    return { key: 'favorite', direction: 'asc' };
  }

  return {
    key,
    direction:
      currentSort.key === key
        ? currentSort.direction
        : defaultDirectionForKey(key),
  };
}

export function toggledSortForIndex(
  index: number,
  currentSort: SortState,
): SortState | undefined {
  const { key } = SORT_OPTIONS[index];

  if (!DIRECTIONAL_KEYS.includes(key)) {
    return undefined;
  }

  return {
    key,
    direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
  };
}

export function sortIndexForKey(key: SortState['key']): number {
  const index = SORT_OPTIONS.findIndex((option) => option.key === key);

  return index === -1 ? 0 : index;
}

export function nextDifficulty(current: Difficulty): Difficulty {
  const index = ALL_DIFFICULTIES.indexOf(current);

  return ALL_DIFFICULTIES[(index + 1) % ALL_DIFFICULTIES.length];
}

// The full mix when the song has one, otherwise every stem played together.
// Online results have no local audio and cannot be previewed.
export function previewSources(song: Song | OnlineSong | undefined): string[] {
  if (!song || !('audio' in song) || song.audio.length === 0) {
    return [];
  }

  const mix = song.audio.find((track) => track.name === 'song');

  return mix ? [mix.src] : song.audio.map((track) => track.src);
}
