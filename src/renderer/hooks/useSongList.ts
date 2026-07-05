import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import {
  IpcLoadSongListResponse,
  IpcScanProgressResponse,
  IpcSplitSongResponse,
  SongData,
} from '../../types';
import { useApp } from '../context/AppContext';

export function useSongList() {
  const [songList, setSongList] = useState<SongData[]>([]);
  const [splittingIds, setSplittingIds] = useState<Set<string>>(new Set());
  const [splitProgress, setSplitProgress] = useState<Map<string, number>>(
    new Map(),
  );
  const [scanProgress, setScanProgress] = useState<IpcScanProgressResponse>();
  const { notification } = App.useApp();
  const { setCurrentPath } = useApp();

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('load-song-list');
    window.electron.ipcRenderer.once<IpcLoadSongListResponse>(
      'load-song-list',
      ({ songs, lastOpenedPath }) => {
        setSongList(songs);
        setCurrentPath(lastOpenedPath);
      },
    );
  }, [setCurrentPath]);
  useEffect(() => {
    return window.electron.ipcRenderer.on<
      IpcLoadSongListResponse | IpcScanProgressResponse
    >('rescan-songs', (payload) => {
      if ('total' in payload) {
        setScanProgress(payload);

        return;
      }

      setSongList(payload.songs);
      setCurrentPath(payload.lastOpenedPath);
      setScanProgress(undefined);
    });
  }, [setCurrentPath]);
  useEffect(() => {
    return window.electron.ipcRenderer.on<SongData>('update-song', (song) => {
      setSongList((prev) => prev.map((s) => (s.id === song.id ? song : s)));
    });
  }, []);
  useEffect(() => {
    return window.electron.ipcRenderer.on<IpcSplitSongResponse>(
      'split-song',
      ({ id, progress, success, song, error, cancelled }) => {
        if (progress !== undefined) {
          setSplitProgress((prev) => new Map(prev).set(id, progress));

          return;
        }

        setSplittingIds((prev) => {
          const next = new Set(prev);

          next.delete(id);

          return next;
        });
        setSplitProgress((prev) => {
          const next = new Map(prev);

          next.delete(id);

          return next;
        });

        if (success && song) {
          setSongList((prev) => prev.map((s) => (s.id === id ? song : s)));
          notification.success({
            title: `"${song.name}" split successfully`,
            placement: 'bottomRight',
          });
        } else if (cancelled) {
          notification.info({
            message: 'Split cancelled',
            placement: 'bottomRight',
          });
        } else {
          notification.error({
            message: 'Split failed',
            description: error,
            placement: 'bottomRight',
          });
        }
      },
    );
  }, [notification]);

  const handleSplit = useCallback(
    (id: string) => {
      setSplittingIds((prev) => new Set(prev).add(id));
      window.electron.ipcRenderer.sendMessage('split-song', id);
      notification.info({
        message: `Splitting "${songList.find((s) => s.id === id)?.name}"`,
        description: "You will be notified when it's done",
        placement: 'bottomRight',
      });
    },
    [songList, notification],
  );
  const handleLikeChange = useCallback(
    (id: string, liked: boolean) => {
      const song = songList.find((s) => s.id === id);

      if (!song) {
        return;
      }

      window.electron.ipcRenderer.sendMessage('like-song', id, liked);
      setSongList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, liked } : s)),
      );
    },
    [songList],
  );
  const addSong = useCallback((song: SongData) => {
    setSongList((prev) => [...prev, song]);
  }, []);

  return {
    songList,
    splittingIds,
    splitProgress,
    scanProgress,
    handleSplit,
    handleLikeChange,
    addSong,
  };
}
