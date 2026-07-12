import fs from 'fs';
import { StorageSchema } from '../../types';
import { isUnderDirectory, toSong } from '../util';
import { appState } from '../AppState';

export async function loadSongList(event: Electron.IpcMainEvent) {
  try {
    const lastOpenedPath = appState.store.get('lastOpenedPath') as
      | string
      | undefined;

    if (!lastOpenedPath || !fs.existsSync(lastOpenedPath)) {
      event.reply('load-song-list', { songs: [], lastOpenedPath: null });

      return;
    }

    const allSongs = appState.store.get('songs') as
      | StorageSchema['songs']
      | undefined;
    const songs = allSongs
      ? Object.values(allSongs)
          .filter((s) => isUnderDirectory(s.dir, lastOpenedPath))
          .filter((s) => fs.existsSync(s.dir))
          .map((s) => toSong(s))
      : [];

    event.reply('load-song-list', { songs, lastOpenedPath });
  } catch (error) {
    event.reply('load-song-list', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
