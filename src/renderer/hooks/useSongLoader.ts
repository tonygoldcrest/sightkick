import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AudioData,
  IpcLoadSongResponse,
  IpcResult,
  isIpcError,
  Song,
} from '../../types';
import { TrackConfig } from '../services/audio-player/types';

interface SongLoaderResult {
  fileData: Buffer | undefined;
  format: 'mid' | 'chart';
  songData: Song | undefined;
  trackData: TrackConfig[];
}

export function useSongLoader(id: string | undefined): SongLoaderResult {
  const [fileData, setFileData] = useState<Buffer>();
  const [format, setFormat] = useState<'mid' | 'chart'>('mid');
  const [songData, setSongData] = useState<Song>();
  const [trackData, setTrackData] = useState<TrackConfig[]>([]);
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const loadSong = useCallback(() => {
    window.electron.ipcRenderer.once<IpcResult<IpcLoadSongResponse>>(
      'load-song',
      (payload) => {
        if (isIpcError(payload)) {
          notification.error({
            message: "Couldn't open this song",
            description:
              'The chart file may have been moved or deleted. Rescan your library from the song list to refresh it.',
            placement: 'bottomRight',
          });
          navigate('/');

          return;
        }

        const { data, fileData: fd } = payload;

        setFileData(fd);
        setFormat(data.format);
        setSongData(data);

        const drums = data.audio
          .filter((file: AudioData) => file.name.includes('drums'))
          .map((file: AudioData) => file.src);
        const other = data.audio
          .filter((file: AudioData) => !file.name.includes('drums'))
          .map((file: AudioData) => ({ urls: [file.src], name: file.name }));

        setTrackData([
          ...(drums.length ? [{ name: 'drums', urls: drums }] : []),
          ...other,
        ]);
      },
    );
    window.electron.ipcRenderer.sendMessage('load-song', id);
  }, [id, notification, navigate]);

  useEffect(() => {
    loadSong();
  }, [loadSong]);

  return { fileData, format, songData, trackData };
}
