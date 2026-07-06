import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Song } from '../../../types';
import { SongSplitProgress } from './SongSplitProgress';

const song = {
  id: 's1',
  name: 'Enter Sandman',
  albumCover: 'sightkick:///cover.png',
} as Song;

function renderProgress(overrides: Partial<Song> = {}, progress = 40) {
  const onCancel = vi.fn();

  render(
    <SongSplitProgress
      songData={{ ...song, ...overrides }}
      progress={progress}
      onCancel={onCancel}
    />,
  );

  return { onCancel };
}

describe('SongSplitProgress', () => {
  it('shows the song name and the progress bar width', () => {
    renderProgress({}, 65);

    expect(screen.getByText('Enter Sandman')).toBeInTheDocument();

    const bar = document.querySelector('[style*="width"]') as HTMLElement;

    expect(bar.style.width).toBe('65%');
  });

  it('uses the album cover when present', () => {
    renderProgress();

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'sightkick:///cover.png',
    );
  });

  it('falls back to the app icon when there is no album cover', () => {
    renderProgress({ albumCover: undefined });

    const img = screen.getByRole('img') as HTMLImageElement;

    expect(img.getAttribute('src')).not.toBe('sightkick:///cover.png');
  });

  it('swaps to the app icon when the cover fails to load', () => {
    renderProgress();

    const img = screen.getByRole('img') as HTMLImageElement;
    const fallback = img.src.replace('sightkick:///cover.png', '');

    fireEvent.error(img);

    expect(img.getAttribute('src')).not.toBe('sightkick:///cover.png');
    expect(fallback).toBeDefined();
  });

  it('invokes onCancel when the cancel button is clicked', () => {
    const { onCancel } = renderProgress();

    fireEvent.click(screen.getByRole('button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
