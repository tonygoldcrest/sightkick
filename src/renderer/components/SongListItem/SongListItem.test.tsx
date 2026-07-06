import { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScoreData, SongData } from '../../../types';
import themedark from '../../theme';
import { installIpcMock } from '../../hooks/test-support';
import { SongListItem } from './SongListItem';

function makeSong(extra: Partial<SongData> = {}): SongData {
  return {
    id: 'song-1',
    dir: '/songs/song-1',
    albumCover: null,
    name: 'Master of Puppets',
    artist: 'Metallica',
    charter: 'Charter',
    diff_drums: '4',
    drumDifficulties: ['easy', 'medium', 'hard', 'expert'],
    audio: [{ src: 'song.ogg', name: 'song' }],
    ...extra,
  } as SongData;
}

function score(hitNotes: number, totalNotes = 100, falseHits = 0): ScoreData {
  return { hitNotes, totalNotes, falseHits };
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function renderItem(props: Partial<Parameters<typeof SongListItem>[0]> = {}) {
  return render(
    <SongListItem
      songData={makeSong()}
      onLikeChange={vi.fn()}
      onDownload={vi.fn()}
      onSplit={vi.fn()}
      onClick={vi.fn()}
      difficulty="expert"
      splitting={false}
      libraryMode="local"
      downloadingDisabled={false}
      {...props}
    />,
    { wrapper },
  );
}

function filledStars() {
  return document.querySelectorAll('svg[data-prefix="fas"][data-icon="star"]')
    .length;
}

beforeEach(() => {
  installIpcMock();
});

describe('SongListItem high score display', () => {
  it('fills a star for every rating band the difficulty score crosses', () => {
    renderItem({
      difficulty: 'expert',
      songData: makeSong({
        scoreData: { expert: score(70) } as SongData['scoreData'],
      }),
    });

    expect(filledStars()).toBe(3);
  });

  it('shows no filled stars when there is no score for the difficulty', () => {
    renderItem({
      difficulty: 'expert',
      songData: makeSong({ scoreData: undefined }),
    });

    expect(filledStars()).toBe(0);
  });

  it('reflects the score of the selected difficulty, not another', () => {
    const songData = makeSong({
      scoreData: {
        hard: score(100),
        expert: score(45),
      } as SongData['scoreData'],
    });
    const { rerender } = renderItem({ difficulty: 'expert', songData });

    expect(filledStars()).toBe(2);

    rerender(
      <SongListItem
        songData={songData}
        onLikeChange={vi.fn()}
        onDownload={vi.fn()}
        onSplit={vi.fn()}
        onClick={vi.fn()}
        difficulty="hard"
        splitting={false}
        libraryMode="local"
        downloadingDisabled={false}
      />,
    );

    expect(filledStars()).toBe(5);
  });

  it('paints a perfect score with the perfect star colour, not the regular one', () => {
    renderItem({
      difficulty: 'expert',
      songData: makeSong({
        scoreData: { expert: score(100) } as SongData['scoreData'],
      }),
    });

    const perfect = render(
      <span style={{ color: themedark.color.starPerfect }} />,
    ).container.firstElementChild as HTMLElement;
    const regular = render(<span style={{ color: themedark.color.star }} />)
      .container.firstElementChild as HTMLElement;
    const stars = document.querySelectorAll(
      'svg[data-prefix="fas"][data-icon="star"]',
    );

    expect(stars.length).toBe(5);
    stars.forEach((star) => {
      expect((star as SVGElement).style.color).toBe(perfect.style.color);
      expect((star as SVGElement).style.color).not.toBe(regular.style.color);
    });
  });

  it('renders the difficulty label next to the rating', () => {
    renderItem({ difficulty: 'hard' });

    expect(screen.getByText('hard')).toBeInTheDocument();
  });
});

describe('SongListItem indicators', () => {
  it('shows the like toggle in local mode and reports toggles', () => {
    const onLikeChange = vi.fn();

    renderItem({
      libraryMode: 'local',
      onLikeChange,
      songData: makeSong({ liked: false }),
    });

    fireEvent.click(screen.getByTestId('like-toggle'));

    expect(onLikeChange).toHaveBeenCalledWith('song-1', true);
  });

  it('shows an enabled download button in online mode', () => {
    renderItem({ libraryMode: 'online', downloadingDisabled: false });

    expect(screen.getByTestId('download-button')).toBeEnabled();
  });

  it('disables the download button until a library folder is selected', () => {
    renderItem({ libraryMode: 'online', downloadingDisabled: true });

    expect(screen.getByTestId('download-button')).toBeDisabled();
  });

  it('shows a downloaded indicator instead of a button once downloaded', () => {
    renderItem({ libraryMode: 'online', downloaded: true });

    expect(screen.getByTestId('downloaded-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('download-button')).not.toBeInTheDocument();
  });

  it('calls onClick when the item is clicked in local mode', () => {
    const onClick = vi.fn();

    renderItem({ libraryMode: 'local', onClick });

    fireEvent.click(screen.getByTestId('song-item-song-1'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when clicking a song menu item', () => {
    const onClick = vi.fn();

    renderItem({ libraryMode: 'local', onClick });

    fireEvent.click(screen.getByTestId('song-menu-trigger'));
    fireEvent.click(screen.getByText('Open song directory'));

    expect(onClick).not.toHaveBeenCalled();
  });
});
