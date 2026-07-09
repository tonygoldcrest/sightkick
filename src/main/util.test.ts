import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assetUrlToFilePath,
  buildSongFromDir,
  chartGlobPattern,
  isUnderDirectory,
  resolveHtmlPath,
  toAssetUrl,
  toSong,
} from './util';
import { SongData } from '../types';

const CHART_WITH_HARD_AND_EXPERT = `[Song]
{
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[ExpertDrums]
{
  0 = N 0 0
  0 = N 1 0
  192 = N 2 0
}
[HardDrums]
{
  0 = N 0 0
  192 = N 1 0
}
`;
const CHART_WITHOUT_DRUMS = `[Song]
{
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[ExpertSingle]
{
  0 = N 0 0
}
`;
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'song-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeSong(
  chart: string,
  ini = '[Song]\nname = Test\npro_drums = True\n',
) {
  fs.writeFileSync(path.join(dir, 'song.ini'), ini);
  fs.writeFileSync(path.join(dir, 'notes.chart'), chart);
}

describe('buildSongFromDir drum difficulties', () => {
  it('extracts the charted drum difficulties in easy→expert order', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);

    const song = buildSongFromDir(dir);

    expect(song?.drumDifficulties).toEqual(['hard', 'expert']);
  });

  it('returns an empty list when no drums are charted', () => {
    writeSong(CHART_WITHOUT_DRUMS);

    const song = buildSongFromDir(dir);

    expect(song?.drumDifficulties).toEqual([]);
  });

  it('returns an empty list when the chart fails to parse', () => {
    fs.writeFileSync(
      path.join(dir, 'song.ini'),
      '[Song]\nname = Test\npro_drums = True\n',
    );
    fs.writeFileSync(path.join(dir, 'notes.mid'), 'not a real midi file');

    const song = buildSongFromDir(dir);

    expect(song?.drumDifficulties).toEqual([]);
    expect(song?.format).toBe('mid');
  });

  it('reuses existing drum difficulties without reparsing the chart', () => {
    writeSong(CHART_WITHOUT_DRUMS);

    const song = buildSongFromDir(dir, {
      drumDifficulties: ['expert'],
    });

    expect(song?.drumDifficulties).toEqual(['expert']);
  });

  it('reparses when existing drum difficulties are empty', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);

    const song = buildSongFromDir(dir, {
      drumDifficulties: [],
    });

    expect(song?.drumDifficulties).toEqual(['hard', 'expert']);
  });
});

describe('buildSongFromDir guards', () => {
  it('returns null when there is no song.ini', () => {
    expect(buildSongFromDir(dir)).toBeNull();
  });

  it('returns null when neither notes.mid nor notes.chart exists', () => {
    fs.writeFileSync(path.join(dir, 'song.ini'), '[Song]\nname = Test\n');

    expect(buildSongFromDir(dir)).toBeNull();
  });
});

describe('buildSongFromDir metadata', () => {
  it('keeps crowd stems and skips preview tracks in any format', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);
    fs.writeFileSync(path.join(dir, 'drums.ogg'), '');
    fs.writeFileSync(path.join(dir, 'song.mp3'), '');
    fs.writeFileSync(path.join(dir, 'crowd.ogg'), '');
    fs.writeFileSync(path.join(dir, 'crowd.opus'), '');
    fs.writeFileSync(path.join(dir, 'preview.ogg'), '');
    fs.writeFileSync(path.join(dir, 'preview.opus'), '');
    fs.writeFileSync(path.join(dir, 'preview.mp3'), '');

    const song = buildSongFromDir(dir);
    const names = song?.audio.map((a) => a.name).sort();

    expect(names).toEqual(['crowd', 'crowd', 'drums', 'song']);
    expect(song?.audio.every((a) => a.src.startsWith('sightkick://'))).toBe(
      true,
    );
  });

  it('detects the album cover and carries existing persisted fields', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);
    fs.writeFileSync(path.join(dir, 'album.jpg'), '');

    const song = buildSongFromDir(dir, {
      id: 'fixed-id',
      liked: true,
      scoreData: { expert: { score: 10 } } as never,
    });

    expect(song?.id).toBe('fixed-id');
    expect(song?.liked).toBe(true);
    expect(song?.scoreData).toEqual({ expert: { score: 10 } });
    expect(song?.albumCover).toBe(toAssetUrl(path.join(dir, 'album.jpg')));
  });

  it('reports no album cover when no image is present', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);

    expect(buildSongFromDir(dir)?.albumCover).toBeNull();
  });

  it('recovers the id from a .sightkick file when none is passed in', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);
    fs.writeFileSync(
      path.join(dir, '.sightkick'),
      JSON.stringify({ id: 'downloaded-md5' }),
    );

    expect(buildSongFromDir(dir)?.id).toBe('downloaded-md5');
  });

  it('prefers an explicit existing id over the .sightkick file', () => {
    writeSong(CHART_WITH_HARD_AND_EXPERT);
    fs.writeFileSync(
      path.join(dir, '.sightkick'),
      JSON.stringify({ id: 'sidecar-md5' }),
    );

    expect(buildSongFromDir(dir, { id: 'explicit' })?.id).toBe('explicit');
  });

  it('does not let song.ini override the app-controlled id and dir', () => {
    writeSong(
      CHART_WITH_HARD_AND_EXPERT,
      '[Song]\nname = Test\nid = evil-id\ndir = /evil/path\n',
    );

    const song = buildSongFromDir(dir, { id: 'fixed-id' });

    expect(song?.id).toBe('fixed-id');
    expect(song?.dir).toBe(dir);
    expect(song?.name).toBe('Test');
  });
});

describe('toSong', () => {
  function stored(extra: Partial<SongData> = {}): SongData {
    return {
      id: 'id-1',
      dir: '/songs/song-1',
      albumCover: null,
      name: 'Master of Puppets',
      artist: 'Metallica',
      album: 'Master of Puppets',
      charter: 'Charter',
      genre: 'Metal',
      year: '1986',
      delay: '480',
      five_lane_drums: 'True',
      pro_drums: 'True',
      diff_drums: '5',
      format: 'chart',
      audio: [{ src: 'song.ogg', name: 'song' }],
      ...extra,
    } as SongData;
  }

  it('converts delay milliseconds into seconds', () => {
    expect(toSong(stored({ delay: '480' })).delaySeconds).toBe(0.48);
    expect(toSong(stored({ delay: '-1000' })).delaySeconds).toBe(-1);
  });

  it('defaults delay to zero when missing or unparseable', () => {
    expect(toSong(stored({ delay: undefined as never })).delaySeconds).toBe(0);
    expect(toSong(stored({ delay: 'nope' })).delaySeconds).toBe(0);
  });

  it('turns the Clone Hero True/False strings into booleans', () => {
    const song = toSong(
      stored({ five_lane_drums: 'True', pro_drums: 'False' }),
    );

    expect(song.fiveLaneDrums).toBe(true);
    expect(song.proDrums).toBe(false);
  });

  it('parses the drum difficulty rating and clamps blanks and negatives to zero', () => {
    expect(toSong(stored({ diff_drums: '5' })).drumDifficulty).toBe(5);
    expect(toSong(stored({ diff_drums: '0' })).drumDifficulty).toBe(0);
    expect(toSong(stored({ diff_drums: '' })).drumDifficulty).toBe(0);
    expect(toSong(stored({ diff_drums: '-1' })).drumDifficulty).toBe(0);
  });

  it('normalizes a missing album cover to undefined', () => {
    expect(toSong(stored({ albumCover: null })).albumCover).toBeUndefined();
    expect(toSong(stored({ albumCover: 'cover.png' })).albumCover).toBe(
      'cover.png',
    );
  });

  it('passes persisted fields through untouched', () => {
    const scoreData = { expert: { totalNotes: 10, falseHits: 0, hitNotes: 8 } };
    const song = toSong(
      stored({
        liked: true,
        updatedAt: '2024-01-01T00:00:00.000Z',
        drumDifficulties: ['hard', 'expert'],
        scoreData,
      }),
    );

    expect(song.liked).toBe(true);
    expect(song.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(song.drumDifficulties).toEqual(['hard', 'expert']);
    expect(song.scoreData).toEqual(scoreData);
  });
});

describe('chartGlobPattern', () => {
  it('keeps forward-slash roots intact', () => {
    expect(chartGlobPattern('/songs/rock')).toBe(
      '/songs/rock/**/{notes.mid,notes.chart}',
    );
  });

  it('converts Windows backslash roots to forward slashes', () => {
    expect(chartGlobPattern('D:\\a\\sightkick\\library')).toBe(
      'D:/a/sightkick/library/**/{notes.mid,notes.chart}',
    );
  });
});

describe('sightkick:// urls', () => {
  const POSIX = '/songs/My Song/drums.ogg';
  const WINDOWS = 'C:\\Users\\me\\My Song\\drums.ogg';

  it('fully percent-encodes the absolute path behind a host', () => {
    expect(toAssetUrl(POSIX)).toBe(
      'sightkick://local/%2Fsongs%2FMy%20Song%2Fdrums.ogg',
    );
    expect(toAssetUrl(WINDOWS)).toBe(
      'sightkick://local/C%3A%5CUsers%5Cme%5CMy%20Song%5Cdrums.ogg',
    );
  });

  it('round-trips through browser url canonicalization', () => {
    for (const original of [POSIX, WINDOWS]) {
      const canonical = new URL(toAssetUrl(original)).href;

      expect(canonical).toBe(toAssetUrl(original));
      expect(assetUrlToFilePath(canonical)).toBe(original);
    }
  });
});

describe('isUnderDirectory', () => {
  it('accepts a directory nested inside the root', () => {
    expect(isUnderDirectory('/songs/rock/track', '/songs')).toBe(true);
  });

  it('accepts the root directory itself', () => {
    expect(isUnderDirectory('/songs', '/songs')).toBe(true);
  });

  it('rejects a sibling escaping via ..', () => {
    expect(isUnderDirectory('/other/track', '/songs')).toBe(false);
  });
});

describe('resolveHtmlPath', () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('uses the dev renderer URL in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:1234';

    expect(resolveHtmlPath('index.html')).toBe('http://localhost:1234');
  });

  it('resolves a file URL outside development', () => {
    process.env.NODE_ENV = 'production';

    expect(resolveHtmlPath('index.html')).toMatch(
      /^file:\/\/.*renderer\/index\.html$/,
    );
  });
});
