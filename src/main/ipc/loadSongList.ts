import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { SongData, StorageSchema } from '../../types';
import {
  buildSongFromDir,
  chartGlobPattern,
  isUnderDirectory,
  toSong,
} from '../util';
import { appState } from '../AppState';

// Each copy of the app keeps its own index over one shared folder. A download
// from the installed app (or a folder left behind after a failed save) is on
// disk but missing here until something reads the folder again.
async function indexChartsMissingFromStore(
  root: string,
  songs: StorageSchema['songs'],
): Promise<StorageSchema['songs']> {
  const knownDirs = new Set(
    Object.values(songs)
      .filter((song) => isUnderDirectory(song.dir, root))
      .map((song) => path.normalize(song.dir)),
  );
  const files = await glob(chartGlobPattern(root));
  const added: StorageSchema['songs'] = {};

  for (const file of files) {
    const dir = path.normalize(path.dirname(file));

    if (knownDirs.has(dir)) {
      continue;
    }

    knownDirs.add(dir);

    const built = buildSongFromDir(dir);

    if (built && !songs[built.id] && !added[built.id]) {
      added[built.id] = built;
    }
  }

  if (Object.keys(added).length === 0) {
    return songs;
  }

  const next = { ...songs, ...added };

  appState.store.set('songs', next);

  return next;
}

function colorTagWasTruncated(song: SongData): boolean {
  return [song.name, song.artist, song.album, song.charter].some(
    (value) => typeof value === 'string' && value.includes('<color'),
  );
}

// song.ini color tags contain `#`, which the ini parser treats as a comment,
// so the stored charter was cut down to `<color=`. Read the file again now
// that those tags are removed before parsing.
function repairTruncatedColorTags(
  root: string,
  songs: StorageSchema['songs'],
): StorageSchema['songs'] {
  let changed = false;
  const next = { ...songs };

  for (const song of Object.values(songs)) {
    if (
      !colorTagWasTruncated(song) ||
      !isUnderDirectory(song.dir, root) ||
      !fs.existsSync(song.dir)
    ) {
      continue;
    }

    const built = buildSongFromDir(song.dir, {
      id: song.id,
      liked: song.liked,
      scoreData: song.scoreData,
      drumDifficulties: song.drumDifficulties,
    });

    if (!built) {
      continue;
    }

    next[song.id] = { ...built, updatedAt: song.updatedAt };
    changed = true;
  }

  if (changed) {
    appState.store.set('songs', next);
  }

  return next;
}

export async function loadSongList(event: Electron.IpcMainEvent) {
  try {
    const lastOpenedPath = appState.store.get('lastOpenedPath') as
      | string
      | undefined;

    if (!lastOpenedPath || !fs.existsSync(lastOpenedPath)) {
      event.reply('load-song-list', { songs: [], lastOpenedPath: null });

      return;
    }

    const stored =
      (appState.store.get('songs') as StorageSchema['songs'] | undefined) ?? {};
    const indexed = await indexChartsMissingFromStore(lastOpenedPath, stored);
    const allSongs = repairTruncatedColorTags(lastOpenedPath, indexed);
    const songs = Object.values(allSongs)
      .filter((s) => isUnderDirectory(s.dir, lastOpenedPath))
      .filter((s) => fs.existsSync(s.dir))
      .map((s) => toSong(s));

    event.reply('load-song-list', { songs, lastOpenedPath });
  } catch (error) {
    event.reply('load-song-list', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
