import { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseChartFile } from 'scan-chart';
import { ChartParser } from '../../chart-parser/parser';
import { renderMusic } from '../../chart-parser/renderer';
import { IpcLoadSongResponse, SongData } from '../../types';
import { InputEvent } from '../input/types';
import { TrackConfig } from '../services/audio-player/types';
import { AppProvider } from '../context/AppContext';
import {
  getNotification,
  installIpcMock,
  installLocalStorage,
  IpcMock,
  resetNotification,
} from '../hooks/test-support';
import { SongView } from './SongView';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

vi.mock('scan-chart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('scan-chart')>()),
  parseChartFile: vi.fn(),
}));
vi.mock('../../chart-parser/parser', () => ({ ChartParser: vi.fn() }));
vi.mock('../../chart-parser/renderer', () => ({ renderMusic: vi.fn() }));

const { busListeners } = vi.hoisted(() => ({
  busListeners: new Set<(event: InputEvent) => void>(),
}));

vi.mock('../input', () => ({
  inputBus: {
    start: () => {},
    subscribe: (listener: (event: InputEvent) => void) => {
      busListeners.add(listener);

      return () => {
        busListeners.delete(listener);
      };
    },
    listDevices: () =>
      Promise.resolve([
        { id: 'midi:Pad', name: 'Pad', sourceId: 'midi', port: 1 },
      ]),
  },
  controlSource: (id: string) => id.slice(0, id.indexOf(':')),
  controlLabel: (id: string) => id.slice(id.indexOf(':') + 1),
}));

function pressInput(controlId: string) {
  busListeners.forEach((listener) => listener({ controlId, value: 100 }));
}

vi.mock('../services/audio-player/player', () => {
  class MockAudioPlayer {
    static instances: MockAudioPlayer[] = [];

    trackData: TrackConfig[];

    onEnded: () => void;

    ready = Promise.resolve([]);

    currentTime = 0;

    duration = 100;

    isInitialised = false;

    audioTracks: { name: string; setVolume: () => void }[] = [];

    start = vi.fn(() => {
      this.isInitialised = true;
    });

    resume = vi.fn();

    pause = vi.fn();

    stop = vi.fn();

    destroy = vi.fn();

    constructor(trackData: TrackConfig[], onEnded: () => void) {
      this.trackData = trackData;
      this.onEnded = onEnded;
      MockAudioPlayer.instances.push(this);
    }
  }

  return { AudioPlayer: MockAudioPlayer };
});

const parseChartFileMock = vi.mocked(parseChartFile);
const ChartParserMock = vi.mocked(ChartParser);
const renderMusicMock = vi.mocked(renderMusic);
const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
  trackData: [
    { instrument: 'drums', difficulty: 'hard' },
    { instrument: 'drums', difficulty: 'expert' },
  ],
};
let ipc: IpcMock;

function makeSong(extra: Partial<SongData> = {}): SongData {
  return {
    id: 'song-1',
    name: 'Master of Puppets',
    artist: 'Metallica',
    charter: 'Charter',
    format: 'mid',
    delay: '0',
    five_lane_drums: 'False',
    pro_drums: 'True',
    audio: [{ src: 'song.ogg', name: 'song' }],
    ...extra,
  } as SongData;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <MemoryRouter initialEntries={['/song-1']}>
        <Routes>
          <Route path="/" element={<div data-testid="song-list-stub" />} />
          <Route path=":id" element={children} />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

async function getInstances() {
  const mod = await import('../services/audio-player/player');

  return (
    mod.AudioPlayer as unknown as { instances: { onEnded: () => void }[] }
  ).instances;
}

async function loadSong(song: SongData = makeSong()) {
  const response: IpcLoadSongResponse = {
    data: song,
    fileData: new Uint8Array([1, 2, 3]) as unknown as Buffer,
  };

  await act(async () => {
    ipc.emit('load-song', response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  installLocalStorage();
  ipc = installIpcMock();
  resetNotification();
  parseChartFileMock.mockReset().mockReturnValue(CHART as never);
  ChartParserMock.mockReset().mockImplementation(function ChartParserStub() {
    return { parsed: true } as never;
  } as never);
  renderMusicMock.mockReset().mockReturnValue([]);
  busListeners.clear();
  (await getInstances()).length = 0;
});

function renderView() {
  return render(<SongView />, { wrapper });
}

describe('SongView — loading', () => {
  it('requests the song and prevents sleep on mount', () => {
    renderView();

    const channels = ipc.sent.map((s) => s.channel);

    expect(ipc.sent).toContainEqual({ channel: 'load-song', args: ['song-1'] });
    expect(channels).toContain('prevent-sleep');
    expect(channels).toContain('check-dev');
  });

  it('renders song metadata and the sheet once the song loads', async () => {
    renderView();

    await loadSong();

    expect(screen.getAllByText('Master of Puppets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Metallica').length).toBeGreaterThan(0);
    expect(parseChartFileMock).toHaveBeenCalledTimes(1);
    expect(ChartParserMock).toHaveBeenLastCalledWith(CHART, false, 'expert');
  });

  it('resumes sleep when the view unmounts', () => {
    const { unmount } = renderView();

    unmount();

    expect(ipc.sent.map((s) => s.channel)).toContain('resume-sleep');
  });
});

describe('SongView — playback', () => {
  async function runCountIn() {
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }
  }

  it('counts in before starting, then pauses, from the play button', async () => {
    vi.useFakeTimers();

    try {
      renderView();
      await loadSong();

      const [player] = await getInstances();
      const start = (player as unknown as { start: ReturnType<typeof vi.fn> })
        .start;

      fireEvent.click(screen.getByTestId('play-toggle'));

      expect(start).not.toHaveBeenCalled();
      expect(screen.getByText('1')).toBeInTheDocument();

      await runCountIn();

      expect(start).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('play-toggle'));
      expect(
        (player as unknown as { pause: ReturnType<typeof vi.fn> }).pause,
      ).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the count-in when the play button is pressed again', async () => {
    vi.useFakeTimers();

    try {
      renderView();
      await loadSong();

      const [player] = await getInstances();
      const start = (player as unknown as { start: ReturnType<typeof vi.fn> })
        .start;

      fireEvent.click(screen.getByTestId('play-toggle'));
      expect(screen.getByText('1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('play-toggle'));

      await runCountIn();

      expect(start).not.toHaveBeenCalled();
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts immediately when the count-in is disabled in settings', async () => {
    localStorage.setItem('settings.countIn', 'false');

    renderView();
    await loadSong();

    const [player] = await getInstances();
    const start = (player as unknown as { start: ReturnType<typeof vi.fn> })
      .start;

    fireEvent.click(screen.getByTestId('play-toggle'));

    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('navigates back to the song list', async () => {
    renderView();
    await loadSong();

    fireEvent.click(screen.getByTestId('back-button'));

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });
});

describe('SongView — drum navigation', () => {
  function mapDevice(mapping: Record<string, string[]>) {
    window.localStorage.setItem('settings.countIn', JSON.stringify(false));
    window.localStorage.setItem(
      'settings.selectedDevice',
      JSON.stringify({
        id: 'midi:Pad',
        name: 'Pad',
        sourceId: 'midi',
        port: 1,
      }),
    );
    window.localStorage.setItem(
      'settings.inputMappings',
      JSON.stringify({ 'midi:Pad': mapping }),
    );
  }

  it('starts playback when the green tom is struck', async () => {
    mapDevice({ tom3: ['midi:38'] });

    renderView();
    await loadSong();

    const [player] = await getInstances();
    const start = (player as unknown as { start: ReturnType<typeof vi.fn> })
      .start;

    await act(async () => {
      pressInput('midi:38');
    });

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('pauses playback when the pause control is struck mid-play', async () => {
    mapDevice({ tom3: ['midi:38'], pause: ['midi:39'] });

    renderView();
    await loadSong();

    const [player] = await getInstances();
    const pause = (player as unknown as { pause: ReturnType<typeof vi.fn> })
      .pause;

    await act(async () => {
      pressInput('midi:38');
    });
    await act(async () => {
      pressInput('midi:39');
    });

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('returns to the song list when the snare is struck while stopped', async () => {
    mapDevice({ snare: ['midi:40'] });

    renderView();
    await loadSong();

    await act(async () => {
      pressInput('midi:40');
    });

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });
});

describe('SongView — difficulty', () => {
  it('parses at the difficulty selected in app settings', async () => {
    localStorage.setItem('settings.difficulty', JSON.stringify('hard'));

    renderView();
    await loadSong();

    expect(ChartParserMock).toHaveBeenLastCalledWith(CHART, false, 'hard');
  });

  it('has no difficulty selector in the song-view settings popover', async () => {
    renderView();
    await loadSong();

    fireEvent.click(screen.getByTestId('settings-trigger'));

    expect(screen.queryByTestId('difficulty-hard')).not.toBeInTheDocument();
  });
});

describe('SongView — bar numbers', () => {
  function lastShowBarNumbers() {
    return renderMusicMock.mock.calls.at(-1)?.[2];
  }

  it('ignores a persisted showBarNumbers outside dev mode', async () => {
    localStorage.setItem('settings.showBarNumbers', JSON.stringify(true));

    renderView();
    await loadSong();

    expect(renderMusicMock).toHaveBeenCalled();
    expect(lastShowBarNumbers()).toBe(false);
  });

  it('renders bar numbers once dev mode is enabled', async () => {
    localStorage.setItem('settings.showBarNumbers', JSON.stringify(true));

    renderView();
    await loadSong();

    expect(lastShowBarNumbers()).toBe(false);

    await act(async () => {
      ipc.emit('check-dev', true);
    });

    expect(lastShowBarNumbers()).toBe(true);
  });
});

describe('SongView — score', () => {
  async function finishSong() {
    const [player] = await getInstances();

    await act(async () => {
      (player as unknown as { onEnded: () => void }).onEnded();
    });
  }

  it('shows the score modal but does not persist a scrub-through with no hits', async () => {
    renderView();
    await loadSong();

    expect(screen.queryByTestId('score-modal')).toBeNull();

    await finishSong();

    expect(screen.getByTestId('score-modal')).toBeInTheDocument();
    expect(ipc.sent.map((s) => s.channel)).not.toContain('update-song');
  });

  it('persists a new high score when notes were actually hit', async () => {
    window.localStorage.setItem(
      'settings.playheadStyle',
      JSON.stringify('Cursor'),
    );
    window.localStorage.setItem('settings.countIn', JSON.stringify(false));
    window.localStorage.setItem(
      'settings.selectedDevice',
      JSON.stringify({
        id: 'midi:Pad',
        name: 'Pad',
        sourceId: 'midi',
        port: 1,
      }),
    );
    window.localStorage.setItem(
      'settings.inputMappings',
      JSON.stringify({ 'midi:Pad': { snare: ['midi:38'] } }),
    );
    renderMusicMock.mockReturnValue([
      {
        stave: {
          getX: () => 0,
          getY: () => 0,
          getWidth: () => 100,
          getHeight: () => 40,
        },
        measure: {
          startTick: 0,
          endTick: 1920,
          notes: [{ isRest: false, notes: ['c/5'] }],
        },
        renderedNotes: [
          {
            tick: 0,
            note: {
              isRest: () => false,
              getKeys: () => ['c/5'],
              getAbsoluteX: () => 0,
              noteHeads: [],
            },
          },
        ],
        yOffset: 0,
      },
    ] as never);

    renderView();
    await loadSong();

    fireEvent.click(screen.getByTestId('play-toggle'));

    await act(async () => {
      pressInput('midi:38');
    });

    await finishSong();

    expect(ipc.sent.map((s) => s.channel)).toContain('update-song');
  });

  it('closes the modal on retry', async () => {
    renderView();
    await loadSong();
    await finishSong();

    fireEvent.click(screen.getByText('Retry'));

    expect(
      screen.getByTestId('score-modal').querySelector('.ant-modal'),
    ).toHaveClass('ant-zoom-leave');
  });

  it('returns to the song list on next song', async () => {
    renderView();
    await loadSong();
    await finishSong();

    fireEvent.click(screen.getByText('Next song'));

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });
});
