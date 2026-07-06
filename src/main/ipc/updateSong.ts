import { IpcUpdateSongPayload, StorageSchema } from '../../types';
import { appState } from '../AppState';
import { toSong } from '../util';

export function updateSong(
  event: Electron.IpcMainEvent,
  payload: IpcUpdateSongPayload,
) {
  try {
    const { id, ...update } = payload;
    const songs = appState.store.get('songs') as StorageSchema['songs'];
    const prev = songs[id];

    if (!prev) {
      throw new Error(`Song "${id}" not found`);
    }

    const next = {
      ...prev,
      ...update,
      scoreData: { ...prev.scoreData, ...update.scoreData },
    };

    appState.store.set(`songs.${id}`, next);
    event.reply('update-song', toSong(next));
  } catch (error) {
    event.reply('update-song', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
