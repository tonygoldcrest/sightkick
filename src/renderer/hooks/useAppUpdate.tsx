import { useEffect } from 'react';
import { App, Button } from 'antd';
import { IpcUpdateAvailableResponse } from '../../types';

export function useAppUpdate() {
  const { notification } = App.useApp();

  useEffect(() => {
    const off = window.electron.ipcRenderer.on<IpcUpdateAvailableResponse>(
      'update-available',
      ({ version, releaseUrl, releaseNotes }) => {
        notification.info({
          key: 'app-update',
          message: 'Update available',
          description: (
            <div>
              <div>Version {version} is available to download.</div>

              {releaseNotes ? (
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">
                  {releaseNotes}
                </p>
              ) : undefined}
            </div>
          ),
          placement: 'bottomRight',
          duration: 0,
          btn: (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                window.open(releaseUrl);
                notification.destroy('app-update');
              }}
            >
              Download
            </Button>
          ),
        });
      },
    );

    window.electron.ipcRenderer.sendMessage('check-update');

    return off;
  }, [notification]);
}
