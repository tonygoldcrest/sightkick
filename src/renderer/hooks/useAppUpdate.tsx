import { useEffect } from 'react';
import { App, Button, Progress, Space } from 'antd';
import DOMPurify from 'dompurify';
import { IpcUpdateAvailable, IpcUpdateStatus } from '../../types';

type UpdatePhase = 'available' | 'downloading' | 'downloaded';

export function useAppUpdate() {
  const { notification } = App.useApp();

  useEffect(() => {
    const ipc = window.electron.ipcRenderer;
    let info: IpcUpdateAvailable | undefined;
    let phase: UpdatePhase = 'available';
    let percent = 0;
    let errorMessage: string | undefined;
    const render = () => {
      if (!info) {
        return;
      }

      const current = info;

      notification.info({
        key: 'app-update',
        message: phase === 'downloaded' ? 'Update ready' : 'Update available',
        description: (
          <div>
            <div>
              {phase === 'downloaded'
                ? `Version ${current.version} is ready to install.`
                : `Version ${current.version} is available to download.`}
            </div>

            {current.releaseNotes ? (
              <div
                className="mt-2 max-h-40 overflow-y-auto text-xs [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-4"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(current.releaseNotes),
                }}
              />
            ) : undefined}

            {phase === 'downloading' ? (
              <Progress
                className="mt-2"
                percent={Math.round(percent)}
                size="small"
              />
            ) : undefined}

            {errorMessage ? (
              <div className="mt-2 text-xs text-red-400">{errorMessage}</div>
            ) : undefined}
          </div>
        ),
        placement: 'bottomRight',
        duration: 0,
        btn: (
          <Space>
            <Button
              size="small"
              onClick={() => window.open(current.releaseUrl)}
            >
              Release page
            </Button>

            {phase === 'downloaded' ? (
              <Button
                type="primary"
                size="small"
                onClick={() => ipc.sendMessage('install-update')}
              >
                Restart to update
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                loading={phase === 'downloading'}
                onClick={() => {
                  phase = 'downloading';
                  percent = 0;
                  errorMessage = undefined;
                  ipc.sendMessage('download-update');
                  render();
                }}
              >
                {phase === 'downloading' ? 'Downloading' : 'Update'}
              </Button>
            )}
          </Space>
        ),
      });
    };
    const offStatus = ipc.on<IpcUpdateStatus>('update-status', (status) => {
      switch (status.phase) {
        case 'available':
          info = status;

          if (phase === 'available') {
            render();
          }

          break;

        case 'downloading':
          percent = status.percent;

          if (phase === 'downloading') {
            render();
          }

          break;

        case 'downloaded':
          phase = 'downloaded';
          render();

          break;

        case 'error':
          if (phase !== 'downloading') {
            return;
          }

          phase = 'available';
          errorMessage = status.message;
          render();

          break;

        default:
          break;
      }
    });

    ipc.sendMessage('check-update');

    return () => {
      offStatus();
    };
  }, [notification]);
}
