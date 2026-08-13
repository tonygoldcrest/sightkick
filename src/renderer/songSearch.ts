import Fuse from 'fuse.js';
import { Song } from '../types';

type SearchableSong = Pick<Song, 'name' | 'artist' | 'charter'> &
  Partial<Pick<Song, 'album'>>;

const DIACRITICS = /\p{Diacritic}/gu;
const WHITESPACE = /\s+/g;

export function normalizeSearchText(value = ''): string {
  return value
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLocaleLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
}

function fields(song: SearchableSong): string[] {
  return [song.name, song.artist, song.album ?? '', song.charter]
    .map(normalizeSearchText)
    .filter(Boolean);
}

function matchRank(song: SearchableSong, query: string): number {
  const values = fields(song);

  if (values.some((value) => value === query)) {
    return 0;
  }

  if (values.some((value) => value.startsWith(query))) {
    return 1;
  }

  if (values.some((value) => value.includes(query))) {
    return 2;
  }

  return 3;
}

export function searchLocalSongs(songs: Song[], input: string): Song[] {
  const query = normalizeSearchText(input);

  if (!query) {
    return [...songs];
  }

  const indexed = songs.map((song, index) => ({
    song,
    index,
    searchText: fields(song).join(' '),
  }));
  const fuse = new Fuse(indexed, {
    keys: ['searchText'],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.35,
  });

  return fuse
    .search(query)
    .sort((a, b) => {
      const rank =
        matchRank(a.item.song, query) - matchRank(b.item.song, query);

      if (rank !== 0) {
        return rank;
      }

      const score = (a.score ?? 1) - (b.score ?? 1);

      return score !== 0 ? score : a.item.index - b.item.index;
    })
    .map((result) => result.item.song);
}
