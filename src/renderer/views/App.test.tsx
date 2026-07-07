import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupApp } from './test-support';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 85,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 85,
        size: 85,
      })),
    measureElement: () => {},
    scrollToIndex: () => {},
    options: { scrollMargin: 0 },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const AVAILABLE = {
  phase: 'available',
  version: '1.2.0',
  releaseUrl: 'https://example.com/release',
};

describe('app update flow', () => {
  it('checks for an update on launch', () => {
    const app = setupApp();

    expect(app.sentChannels()).toContain('check-update');
  });

  it('walks from an available update through download to install', async () => {
    const app = setupApp();

    app.emit('update-status', AVAILABLE);

    expect(await screen.findByText('Update available')).toBeInTheDocument();
    expect(
      screen.getByText('Version 1.2.0 is available to download.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Update'));

    expect(app.sentChannels()).toContain('download-update');

    app.emit('update-status', { phase: 'downloading', percent: 40 });
    app.emit('update-status', { phase: 'downloaded', version: '1.2.0' });

    expect(await screen.findByText('Update ready')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Restart to update'));

    expect(app.sentChannels()).toContain('install-update');
  });

  it('surfaces a download error and returns to the Update button', async () => {
    const app = setupApp();

    app.emit('update-status', AVAILABLE);
    await screen.findByText('Update available');

    fireEvent.click(screen.getByText('Update'));
    app.emit('update-status', { phase: 'error', message: 'Network is down' });

    expect(await screen.findByText('Network is down')).toBeInTheDocument();
    expect(screen.getAllByText('Update').length).toBeGreaterThan(0);
  });

  it('renders release notes as sanitized HTML', async () => {
    const app = setupApp();

    app.emit('update-status', {
      ...AVAILABLE,
      releaseNotes: '<h2>Bug Fixes</h2><img src="x" onerror="alert(1)">',
    });

    expect(await screen.findByText('Bug Fixes')).toBeInTheDocument();

    await waitFor(() => {
      const img = document.querySelector('.ant-notification img');

      expect(img).not.toBeNull();
      expect(img?.getAttribute('onerror')).toBeNull();
    });
  });
});
