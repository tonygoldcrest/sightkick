import fs from 'fs';
import { StorageSchema } from '../../types';
import { appState } from '../AppState';
import { isUnderDirectory } from '../util';

export function deleteSong(event: Electron.IpcMainEvent, id: string) {
  try {
    const root = appState.store.get('lastOpenedPath') as string | undefined;
    const songs =
      (appState.store.get('songs') as StorageSchema['songs'] | undefined) ?? {};
    const song = songs[id];

    if (!song) {
      throw new Error('Song is not in your library');
    }

    if (!root || !isUnderDirectory(song.dir, root)) {
      throw new Error('Song is outside the library folder');
    }

    fs.rmSync(song.dir, { recursive: true, force: true });

    const next = { ...songs };

    delete next[id];
    appState.store.set('songs', next);
    event.reply('delete-song', { success: true, id });
  } catch (error) {
    event.reply('delete-song', {
      success: false,
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
