import { useEffect, useState } from 'react';
import { App } from 'antd';
import {
  IpcCheckStemToolsResponse,
  IpcDeleteStemToolsResponse,
  IpcDownloadStemToolsResponse,
  IpcStemToolsRemoteResponse,
  StemToolsPhase,
  StemToolsStatus,
} from '../../types';

export function useStemTools() {
  const { notification } = App.useApp();
  const [stemToolsStatus, setStemToolsStatus] =
    useState<StemToolsStatus>('ready');
  const [stemToolsLoading, setStemToolsLoading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | undefined>();
  const [phase, setPhase] = useState<StemToolsPhase | undefined>();
  const [installedVersion, setInstalledVersion] = useState<
    string | undefined
  >();
  const [latestVersion, setLatestVersion] = useState<string | undefined>();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [available, setAvailable] = useState<boolean | undefined>();
  const [downloadSize, setDownloadSize] = useState<number | undefined>();
  const [uncompressedSize, setUncompressedSize] = useState<
    number | undefined
  >();

  useEffect(() => {
    let offRecheck: (() => void) | undefined;
    const applyStatus = (response: IpcCheckStemToolsResponse) => {
      setStemToolsStatus(response.status);
      setInstalledVersion(response.installedVersion);

      if (response.status !== 'unsupported') {
        window.electron.ipcRenderer.sendMessage('check-stem-tools-update');
      }
    };

    window.electron.ipcRenderer.sendMessage('check-stem-tools');

    const offCheck =
      window.electron.ipcRenderer.once<IpcCheckStemToolsResponse>(
        'check-stem-tools',
        applyStatus,
      );
    const offUpdate =
      window.electron.ipcRenderer.on<IpcStemToolsRemoteResponse>(
        'check-stem-tools-update',
        (response) => {
          setAvailable(response.available);
          setLatestVersion(response.latestVersion);
          setUpdateAvailable(response.updateAvailable);
          setDownloadSize(response.downloadSize);
          setUncompressedSize(response.uncompressedSize);
        },
      );
    const offDownload =
      window.electron.ipcRenderer.on<IpcDownloadStemToolsResponse>(
        'download-stem-tools',
        (status) => {
          if (status.progress !== undefined) {
            setDownloadPercent(status.progress);
            setPhase(status.phase);

            return;
          }

          setDownloadPercent(undefined);
          setPhase(undefined);
          setStemToolsLoading(false);

          if (status.cancelled) {
            return;
          }

          if (status.error) {
            notification.error({
              message: 'Error downloading stem tools',
              description: status.error,
              placement: 'bottomRight',
            });
          } else if (status.success) {
            setStemToolsStatus('ready');
            setUpdateAvailable(false);
            window.electron.ipcRenderer.sendMessage('check-stem-tools');
            offRecheck?.();
            offRecheck =
              window.electron.ipcRenderer.once<IpcCheckStemToolsResponse>(
                'check-stem-tools',
                applyStatus,
              );
          }
        },
      );
    const offDelete =
      window.electron.ipcRenderer.on<IpcDeleteStemToolsResponse>(
        'delete-stem-tools',
        (response) => {
          if (response.success) {
            setStemToolsStatus('download');
            setInstalledVersion(undefined);
            setLatestVersion(undefined);
            setUpdateAvailable(false);

            return;
          }

          if (response.error) {
            notification.error({
              message: 'Error deleting stem tools',
              description: response.error,
              placement: 'bottomRight',
            });
          }
        },
      );

    return () => {
      offCheck();
      offRecheck?.();
      offUpdate();
      offDownload();
      offDelete();
    };
  }, [notification]);

  function download() {
    window.electron.ipcRenderer.sendMessage('download-stem-tools');
    setStemToolsLoading(true);
  }

  function cancel() {
    window.electron.ipcRenderer.sendMessage('cancel-stem-tools');
  }

  function deleteTools() {
    window.electron.ipcRenderer.sendMessage('delete-stem-tools');
  }

  return {
    stemToolsStatus,
    stemToolsLoading,
    downloadPercent,
    phase,
    installedVersion,
    latestVersion,
    updateAvailable,
    available,
    downloadSize,
    uncompressedSize,
    download,
    cancel,
    deleteTools,
  };
}
