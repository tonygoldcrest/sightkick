import { ReactElement } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotification,
  installIpcMock,
  IpcMock,
  NotificationMock,
  resetNotification,
} from './test-support';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

let ipc: IpcMock;
let notification: NotificationMock;

beforeEach(() => {
  ipc = installIpcMock();
  notification = resetNotification();
  window.open = vi.fn();
});

async function load() {
  const { useAppUpdate } = await import('./useAppUpdate');

  return renderHook(() => useAppUpdate());
}

const update = {
  version: '1.2.0',
  releaseUrl: 'https://example.com/releases/latest',
};

describe('useAppUpdate', () => {
  it('listens before requesting the cached update on mount', async () => {
    await load();

    expect(ipc.onCount('update-available')).toBe(1);
    expect(ipc.sent).toEqual([{ channel: 'check-update', args: [] }]);
  });

  it('shows a persistent keyed notification when an update arrives', async () => {
    await load();

    act(() => ipc.emit('update-available', update));

    expect(notification.info).toHaveBeenCalledTimes(1);
    expect(notification.info.mock.calls[0][0]).toMatchObject({
      key: 'app-update',
      duration: 0,
    });

    const { getByText } = render(
      notification.info.mock.calls[0][0].description as ReactElement,
    );

    expect(
      getByText('Version 1.2.0 is available to download.'),
    ).toBeInTheDocument();
  });

  it('renders release notes when provided', async () => {
    await load();

    act(() =>
      ipc.emit('update-available', {
        ...update,
        releaseNotes: 'Fixed a bug\nAdded a feature',
      }),
    );

    const { getByText } = render(
      notification.info.mock.calls[0][0].description as ReactElement,
    );

    expect(getByText(/Fixed a bug/)).toBeInTheDocument();
    expect(getByText(/Added a feature/)).toBeInTheDocument();
  });

  it('omits release notes when absent', async () => {
    await load();

    act(() => ipc.emit('update-available', update));

    const { container } = render(
      notification.info.mock.calls[0][0].description as ReactElement,
    );

    expect(container.querySelector('p')).toBeNull();
  });

  it('opens the release page and dismisses itself on download', async () => {
    await load();

    act(() => ipc.emit('update-available', update));

    const btn = notification.info.mock.calls[0][0].btn as ReactElement<{
      onClick: () => void;
    }>;

    act(() => btn.props.onClick());

    expect(window.open).toHaveBeenCalledWith(update.releaseUrl);
    expect(notification.destroy).toHaveBeenCalledWith('app-update');
  });

  it('collapses repeat deliveries onto one toast via the key', async () => {
    await load();

    act(() => ipc.emit('update-available', update));
    act(() => ipc.emit('update-available', update));

    expect(notification.info).toHaveBeenCalledTimes(2);
    expect(notification.info.mock.calls[0][0].key).toBe('app-update');
    expect(notification.info.mock.calls[1][0].key).toBe('app-update');
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = await load();

    expect(ipc.onCount('update-available')).toBe(1);

    unmount();

    expect(ipc.onCount('update-available')).toBe(0);
  });
});
