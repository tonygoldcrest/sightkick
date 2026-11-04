import fs from 'fs';
import { SongData, StorageSchema } from '../../types';
import { buildSongFromDir, isUnderDirectory, toSong } from '../util';
import { appState } from '../AppState';

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
    const allSongs = repairTruncatedColorTags(lastOpenedPath, stored);
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
