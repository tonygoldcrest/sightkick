import { describe, expect, it } from 'vitest';
import { makeListSong } from './views/test-support';
import { normalizeSearchText, searchLocalSongs } from './songSearch';

describe('normalizeSearchText', () => {
  it('folds case, diacritics and whitespace', () => {
    expect(normalizeSearchText('  BEYONCÉ   Knowles  ')).toBe(
      'beyonce knowles',
    );
  });
});

describe('searchLocalSongs', () => {
  const songs = [
    makeListSong('raging', {
      name: 'Raging',
      artist: 'Kygo feat. Kodaline',
      album: 'Cloud Nine',
      charter: '',
    }),
    makeListSong('lose', {
      name: 'Lose Somebody',
      artist: 'Kygo & OneRepublic',
      album: 'Golden Hour',
      charter: 'Human Charter',
    }),
  ];

  it.each([
    ['Kodaline', 'raging'],
    ['Cloud Nine', 'raging'],
    ['Human Charter', 'lose'],
    ['onerepublic', 'lose'],
  ])('matches %s across local metadata', (query, expectedId) => {
    expect(searchLocalSongs(songs, query).map((song) => song.id)).toEqual([
      expectedId,
    ]);
  });
});
