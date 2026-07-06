import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { Song } from '../../types';

interface DownloadReply {
  success: boolean;
  md5: string;
  song?: Song;
  error?: string;
}

export function useDownload(
  onlineResults: Song[],
  onSongAdded: (song: Song) => void,
) {
  const { notification } = App.useApp();
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const downloadingRef = useRef<Set<string>>(new Set());
  const onSongAddedRef = useRef(onSongAdded);

  useEffect(() => {
    onSongAddedRef.current = onSongAdded;
  }, [onSongAdded]);

  useEffect(() => {
    return window.electron.ipcRenderer.on<DownloadReply>(
      'download-song',
      ({ success, md5, song: newSong, error }) => {
        if (!downloadingRef.current.has(md5)) {
          return;
        }

        downloadingRef.current.delete(md5);
        setDownloadingIds(new Set(downloadingRef.current));

        if (success && newSong) {
          onSongAddedRef.current(newSong);
        } else {
          notification.error({
            message: 'Download failed',
            description: error,
            placement: 'bottomRight',
          });
        }
      },
    );
  }, [notification]);

  const handleDownload = useCallback(
    (id: string) => {
      const song = onlineResults.find((s) => s.id === id);

      if (!song || downloadingRef.current.has(id)) {
        return;
      }

      downloadingRef.current.add(id);
      setDownloadingIds(new Set(downloadingRef.current));
      window.electron.ipcRenderer.sendMessage('download-song', {
        url: song.dir,
        md5: song.id,
        name: song.name,
        artist: song.artist,
        charter: song.charter,
      });
    },
    [onlineResults],
  );

  return { downloadingIds, handleDownload };
}
