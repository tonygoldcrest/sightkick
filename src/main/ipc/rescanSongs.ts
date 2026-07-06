import { IpcMainEvent, dialog } from 'electron';
import { SongData, StorageSchema } from '../../types';
import { appState } from '../AppState';
import { buildSongFromDir, chartGlobPattern, isUnderDirectory } from '../util';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

export async function rescanSongs(event: IpcMainEvent, newDir = true) {
  try {
    await runRescan(event, newDir);
  } catch (error) {
    event.reply('rescan-songs', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runRescan(event: IpcMainEvent, newDir: boolean) {
  let selectedPath: string;

  if (newDir) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose your Clone Hero library',
      message: 'Choose your Clone Hero library',
    });

    if (result.canceled) {
      return;
    }

    selectedPath = result.filePaths[0];

    appState.store.set('lastOpenedPath', selectedPath);
  } else {
    selectedPath = appState.store.get('lastOpenedPath') as string;
  }

  const existingSongs =
    (appState.store.get('songs') as StorageSchema['songs']) ?? {};
  const existingByDir = new Map<string, StorageSchema['songs'][string]>();

  for (const song of Object.values(existingSongs)) {
    if (isUnderDirectory(song.dir, selectedPath)) {
      existingByDir.set(song.dir, song);
    }
  }

  const otherSongs = Object.fromEntries(
    Object.entries(existingSongs).filter(
      ([, s]) => !isUnderDirectory(s.dir, selectedPath),
    ),
  );
  const files = await glob(chartGlobPattern(selectedPath));
  const dirToFile = new Map<string, string>();

  for (const file of files) {
    const normalized = path.normalize(file);
    const dir = path.dirname(normalized);

    if (!dirToFile.has(dir) || path.extname(normalized) === '.mid') {
      dirToFile.set(dir, normalized);
    }
  }

  const dirs = [...dirToFile.keys()];
  const total = dirs.length;
  const step = Math.max(1, Math.floor(total / 100));
  const songList: SongData[] = [];

  event.reply('rescan-songs', { current: 0, total });

  for (let i = 0; i < total; i += 1) {
    const built = buildSongFromDir(dirs[i], existingByDir.get(dirs[i]));

    if (built) {
      songList.push(built);
    }

    if (i % step === 0 || i === total - 1) {
      event.reply('rescan-songs', { current: i + 1, total });
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
    }
  }

  const rescannedSongs = songList.reduce(
    (acc, song) => {
      acc[song.id] = song;

      return acc;
    },
    {} as StorageSchema['songs'],
  );

  appState.store.set('songs', { ...otherSongs, ...rescannedSongs });

  event.reply('rescan-songs', {
    songs: Object.values(rescannedSongs).map((s) => ({
      ...s,
      updatedAt: fs.statSync(s.dir).mtime.toISOString(),
    })),
    lastOpenedPath: selectedPath,
  });
}
