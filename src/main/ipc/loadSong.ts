import { StorageSchema } from '../../types';
import path from 'path';
import fs from 'fs';
import { appState } from '../AppState';
import { toSong } from '../util';

export function loadSong(event: Electron.IpcMainEvent, id: string) {
  try {
    const songData = (appState.store.get('songs') as StorageSchema['songs'])[
      id
    ];

    if (!songData) {
      throw new Error(`Song "${id}" not found`);
    }

    const notesFile = path.join(
      songData.dir,
      songData.format === 'mid' ? 'notes.mid' : 'notes.chart',
    );
    const fileData = fs.readFileSync(notesFile);

    event.reply('load-song', { data: toSong(songData), fileData });
  } catch (error) {
    event.reply('load-song', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
