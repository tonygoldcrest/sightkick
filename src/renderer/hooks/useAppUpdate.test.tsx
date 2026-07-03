import { ReactElement } from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  within,
} from '@testing-library/react';
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
  phase: 'available',
  version: '1.2.0',
  releaseUrl: 'https://example.com/releases/latest',
};

function currentToast() {
  const { calls } = notification.info.mock;

  return calls[calls.length - 1][0];
}

function renderBtn() {
  const { container } = render(currentToast().btn as ReactElement);

  return within(container);
}

function renderDescription() {
  const { container } = render(currentToast().description as ReactElement);

  return { ...within(container), container };
}

describe('useAppUpdate', () => {
  it('listens before requesting the cached update on mount', async () => {
    await load();

    expect(ipc.onCount('update-status')).toBe(1);
    expect(ipc.sent).toEqual([{ channel: 'check-update', args: [] }]);
  });

  it('shows a persistent keyed notification when an update arrives', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    expect(notification.info).toHaveBeenCalledTimes(1);
    expect(currentToast()).toMatchObject({ key: 'app-update', duration: 0 });

    const { getByText } = renderDescription();

    expect(
      getByText('Version 1.2.0 is available to download.'),
    ).toBeInTheDocument();
  });

  it('renders release notes as sanitized HTML', async () => {
    await load();

    act(() =>
      ipc.emit('update-status', {
        ...update,
        releaseNotes: '<h3>Bug Fixes</h3><ul><li>Fix scoring</li></ul>',
      }),
    );

    const { getByText, container } = renderDescription();

    expect(getByText('Bug Fixes')).toBeInTheDocument();
    expect(getByText('Fix scoring')).toBeInTheDocument();
    expect(container.querySelector('h3')).not.toBeNull();
    expect(container.querySelector('li')).not.toBeNull();
  });

  it('strips dangerous handlers from release notes', async () => {
    await load();

    act(() =>
      ipc.emit('update-status', {
        ...update,
        releaseNotes: '<img src="x" onerror="alert(1)">Notes',
      }),
    );

    const { container } = renderDescription();

    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('omits the release notes block when there are none', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    const { container } = renderDescription();

    expect(container.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('opens the release page from the fallback button', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    const { getByText } = renderBtn();

    act(() => {
      fireEvent.click(getByText('Release page'));
    });

    expect(window.open).toHaveBeenCalledWith(update.releaseUrl);
  });

  it('requests the download and shows progress on Update', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    fireEvent.click(renderBtn().getByText('Update'));

    expect(ipc.sent).toContainEqual({ channel: 'download-update', args: [] });

    act(() => ipc.emit('update-status', { phase: 'downloading', percent: 40 }));

    expect(renderDescription().container.textContent).toContain('40');
  });

  it('swaps to a restart button once downloaded and installs on click', async () => {
    await load();

    act(() => ipc.emit('update-status', update));
    act(() =>
      ipc.emit('update-status', { phase: 'downloaded', version: '1.2.0' }),
    );

    expect(currentToast().message).toBe('Update ready');

    fireEvent.click(renderBtn().getByText('Restart to update'));

    expect(ipc.sent).toContainEqual({ channel: 'install-update', args: [] });
  });

  it('surfaces a download error and returns to the Update button', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    fireEvent.click(renderBtn().getByText('Update'));

    act(() =>
      ipc.emit('update-status', { phase: 'error', message: 'Network is down' }),
    );

    expect(
      renderDescription().getByText('Network is down'),
    ).toBeInTheDocument();
    expect(renderBtn().getByText('Update')).toBeInTheDocument();
  });

  it('ignores errors when not downloading', async () => {
    await load();

    act(() => ipc.emit('update-status', update));

    const before = notification.info.mock.calls.length;

    act(() =>
      ipc.emit('update-status', { phase: 'error', message: 'stray error' }),
    );

    expect(notification.info.mock.calls.length).toBe(before);
  });

  it('collapses repeat deliveries onto one toast via the key', async () => {
    await load();

    act(() => ipc.emit('update-status', update));
    act(() => ipc.emit('update-status', update));

    expect(notification.info.mock.calls[0][0].key).toBe('app-update');
    expect(notification.info.mock.calls[1][0].key).toBe('app-update');
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = await load();

    expect(ipc.onCount('update-status')).toBe(1);

    unmount();

    expect(ipc.onCount('update-status')).toBe(0);
  });
});
