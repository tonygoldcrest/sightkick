import { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputEvent } from '../../input/types';
import { InputProvider } from '../../context/InputContext';
import { installIpcMock, installLocalStorage } from '../../hooks/test-support';
import { ScoreData, SongData } from '../../../types';
import { ScoreSummary } from './ScoreSummary';

vi.mock('../../input', () => ({
  inputBus: {
    start: () => {},
    capture: (_listener: (event: InputEvent) => void) => () => {},
    listDevices: () =>
      Promise.resolve([
        { id: 'keyboard', name: 'Keyboard', sourceId: 'keyboard' },
      ]),
  },
  controlSource: (id: string) => id.slice(0, id.indexOf(':')),
  controlLabel: (id: string) => id.slice(id.indexOf(':') + 1),
}));

const songData = {
  name: 'Master of Puppets',
  artist: 'Metallica',
} as SongData;

function selectKeyboardDevice() {
  localStorage.setItem(
    'settings.selectedDevice',
    JSON.stringify({ id: 'keyboard', name: 'Keyboard', sourceId: 'keyboard' }),
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <InputProvider>
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    </InputProvider>
  );
}

function filledStars() {
  return document.querySelectorAll('svg[data-prefix="fas"][data-icon="star"]')
    .length;
}

function mappingHints() {
  return document.querySelectorAll('svg[style*="sk-mapping-hint-pulse"]');
}

function renderSummary(
  scoreData: ScoreData,
  overrides: Partial<Parameters<typeof ScoreSummary>[0]> = {},
) {
  const onRetry = vi.fn();
  const onNextSong = vi.fn();

  render(
    <ScoreSummary
      isOpen
      onRetry={onRetry}
      onNextSong={onNextSong}
      songData={songData}
      difficulty="expert"
      scoreData={scoreData}
      {...overrides}
    />,
    { wrapper },
  );

  return { onRetry, onNextSong };
}

describe('ScoreSummary', () => {
  beforeEach(() => {
    installLocalStorage();
    installIpcMock();
  });

  it('shows the song, artist and difficulty', () => {
    renderSummary({ hitNotes: 70, totalNotes: 100, falseHits: 0 });

    expect(screen.getByText('Master of Puppets')).toBeInTheDocument();
    expect(screen.getByText('Metallica')).toBeInTheDocument();
    expect(screen.getByText('expert')).toBeInTheDocument();
  });

  it('fills a star per rating band and shows the accuracy percentage', () => {
    renderSummary({ hitNotes: 70, totalNotes: 100, falseHits: 0 });

    expect(filledStars()).toBe(3);
    expect(screen.getByText('70% accuracy')).toBeInTheDocument();
  });

  it('shows Perfect and five stars for a flawless run', () => {
    renderSummary({ hitNotes: 100, totalNotes: 100, falseHits: 0 });

    expect(filledStars()).toBe(5);
    expect(screen.getByText('Perfect')).toBeInTheDocument();
  });

  it('reports notes hit and false hits', () => {
    renderSummary({ hitNotes: 42, totalNotes: 100, falseHits: 7 });

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('100 notes hit')).toBeInTheDocument();
    expect(screen.getByText('7 false hits')).toBeInTheDocument();
  });

  it('calls onRetry and onNextSong from the footer buttons', () => {
    const { onRetry, onNextSong } = renderSummary({
      hitNotes: 50,
      totalNotes: 100,
      falseHits: 0,
    });

    fireEvent.click(screen.getByText('Retry'));
    fireEvent.click(screen.getByText('Next song'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onNextSong).toHaveBeenCalledTimes(1);
  });

  it('hides the footer mapping hints when no device is selected', () => {
    renderSummary({ hitNotes: 50, totalNotes: 100, falseHits: 0 });

    expect(mappingHints()).toHaveLength(0);
  });

  it('shows footer mapping hints when a device is selected', () => {
    selectKeyboardDevice();

    renderSummary({ hitNotes: 50, totalNotes: 100, falseHits: 0 });

    expect(mappingHints()).toHaveLength(2);
  });
});
