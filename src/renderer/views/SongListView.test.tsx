import { ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongData } from '../../types';
import { AppProvider } from '../context/AppContext';
import { InputProvider } from '../context/InputContext';
import {
  getNotification,
  installIpcMock,
  installLocalStorage,
  IpcMock,
  NotificationMock,
  resetNotification,
} from '../hooks/test-support';
import { SongListView } from './SongListView';
import { useInputControls } from '../hooks/useInputControls';

vi.mock('../hooks/useInputControls', () => ({ useInputControls: vi.fn() }));

const useInputControlsMock = vi.mocked(useInputControls);

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

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

const online = vi.hoisted(() => ({
  results: [] as SongData[],
  total: undefined as number | undefined,
  loading: false,
  loadMore: vi.fn(),
  calls: [] as { active: boolean; search: string }[],
}));

vi.mock('../hooks/useOnlineSearch', () => ({
  useOnlineSearch: (active: boolean, search: string) => {
    online.calls.push({ active, search });

    return {
      results: online.results,
      total: online.total,
      loading: online.loading,
      loadMore: online.loadMore,
    };
  },
}));

let ipc: IpcMock;
let notification: NotificationMock;

function makeSong(id: string, extra: Partial<SongData> = {}): SongData {
  return {
    id,
    dir: `/songs/${id}`,
    albumCover: null,
    name: `Name ${id}`,
    artist: `Artist ${id}`,
    charter: `Charter ${id}`,
    diff_drums: '3',
    format: 'mid',
    drumDifficulties: ['easy', 'medium', 'hard', 'expert'],
    audio: [{ src: 'song.ogg', name: 'song' }],
    ...extra,
  } as SongData;
}

function SongViewStub() {
  const navigate = useNavigate();

  return (
    <div data-testid="song-view-stub">
      <button
        type="button"
        data-testid="song-view-back"
        onClick={() => navigate('/')}
      >
        back
      </button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <InputProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={children}>
              <Route path=":id" element={<SongViewStub />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </InputProvider>
    </AppProvider>
  );
}

function renderView() {
  return render(<SongListView />, { wrapper });
}

function emit(channel: string, ...args: unknown[]) {
  act(() => {
    ipc.emit(channel, ...args);
  });
}

function loadSongs(
  songs: SongData[],
  lastOpenedPath: string | null = '/music',
) {
  emit('load-song-list', { songs, lastOpenedPath });
}

function setStemTools(status: 'ready' | 'download' | 'unsupported') {
  emit('check-stem-tools', { status });
}

function row(id: string) {
  return within(screen.getByTestId(`song-item-${id}`));
}

function filledStarsIn(id: string) {
  return screen
    .getByTestId(`song-item-${id}`)
    .querySelectorAll('svg[data-prefix="fas"][data-icon="star"]').length;
}

function selectDifficulty(difficulty: string) {
  fireEvent.click(screen.getByTestId('settings-trigger'));
  fireEvent.click(screen.getByTestId(`difficulty-${difficulty}`));
}

beforeEach(() => {
  installLocalStorage();
  ipc = installIpcMock();
  notification = resetNotification();
  online.results = [];
  online.total = undefined;
  online.loading = false;
  online.loadMore = vi.fn();
  online.calls = [];
});

describe('SongListView — loading', () => {
  it('requests the song list and stem-tool status on mount', () => {
    renderView();

    const channels = ipc.sent.map((s) => s.channel);

    expect(channels).toContain('load-song-list');
    expect(channels).toContain('check-stem-tools');
  });

  it('renders the songs returned by the backend', () => {
    renderView();

    loadSongs([makeSong('a'), makeSong('b')]);

    expect(screen.getByText('Name a')).toBeInTheDocument();
    expect(screen.getByText('Name b')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('guides to select a folder when none is selected', () => {
    renderView();

    loadSongs([], null);

    expect(screen.getByText('Select folder')).toBeInTheDocument();
  });

  it('guides to download songs when the selected folder is empty', () => {
    renderView();

    loadSongs([], '/music');

    expect(screen.getByText('No songs in this folder.')).toBeInTheDocument();
    expect(screen.getByText('Download some')).toBeInTheDocument();
    expect(screen.queryByText('Select folder')).not.toBeInTheDocument();
  });

  it('reports when no songs match the active filter', () => {
    renderView();

    loadSongs([
      makeSong('a', { name: 'Master of Puppets' }),
      makeSong('b', { name: 'Enter Sandman' }),
    ]);

    fireEvent.change(screen.getByPlaceholderText('Enter song name'), {
      target: { value: 'nonexistent song' },
    });

    expect(screen.getByText('No songs match your filter.')).toBeInTheDocument();
    expect(screen.queryByText('Select folder')).not.toBeInTheDocument();
  });

  it('repopulates the list when the backend rescans the folder', () => {
    renderView();

    loadSongs([makeSong('a')]);
    expect(screen.getByText('Name a')).toBeInTheDocument();

    emit('rescan-songs', {
      songs: [makeSong('c')],
      lastOpenedPath: '/other',
    });

    expect(screen.queryByText('Name a')).not.toBeInTheDocument();
    expect(screen.getByText('Name c')).toBeInTheDocument();
  });
});

describe('SongListView — filtering and sorting', () => {
  it('fuzzy-filters the local list by name', () => {
    renderView();

    loadSongs([
      makeSong('a', { name: 'Master of Puppets' }),
      makeSong('b', { name: 'Enter Sandman' }),
    ]);

    fireEvent.change(screen.getByPlaceholderText('Enter song name'), {
      target: { value: 'puppets' },
    });

    expect(screen.getByText('Master of Puppets')).toBeInTheDocument();
    expect(screen.queryByText('Enter Sandman')).not.toBeInTheDocument();
  });

  it('reorders the list when a sort option is chosen', () => {
    renderView();

    loadSongs([
      makeSong('a', { name: 'Charlie' }),
      makeSong('b', { name: 'Alpha' }),
    ]);

    fireEvent.click(screen.getByTestId('sort-trigger'));
    fireEvent.click(screen.getByText('Name').closest('button')!);

    const rendered = screen
      .getAllByText(/Charlie|Alpha/)
      .map((el) => el.textContent);

    expect(rendered).toEqual(['Alpha', 'Charlie']);
  });
});

describe('SongListView — difficulty selection', () => {
  it('re-filters the list to songs charted at the chosen difficulty', () => {
    renderView();

    loadSongs([
      makeSong('a', { name: 'Expert Only', drumDifficulties: ['expert'] }),
      makeSong('b', { name: 'Hard Only', drumDifficulties: ['hard'] }),
    ]);

    expect(screen.getByText('Expert Only')).toBeInTheDocument();
    expect(screen.queryByText('Hard Only')).not.toBeInTheDocument();

    selectDifficulty('hard');

    expect(screen.queryByText('Expert Only')).not.toBeInTheDocument();
    expect(screen.getByText('Hard Only')).toBeInTheDocument();
  });

  it('shows the high score for the selected difficulty', () => {
    renderView();

    loadSongs([
      makeSong('a', {
        scoreData: {
          expert: { hitNotes: 100, totalNotes: 100, falseHits: 0 },
          hard: { hitNotes: 45, totalNotes: 100, falseHits: 0 },
        },
      } as Partial<SongData>),
    ]);

    expect(filledStarsIn('a')).toBe(5);

    selectDifficulty('hard');

    expect(filledStarsIn('a')).toBe(2);
  });

  it('persists the selected difficulty', () => {
    renderView();

    selectDifficulty('hard');

    expect(
      JSON.parse(window.localStorage.getItem('settings.difficulty')!),
    ).toBe('hard');
  });

  it('marks the active difficulty as primary', () => {
    window.localStorage.setItem(
      'settings.difficulty',
      JSON.stringify('medium'),
    );

    renderView();

    expect(screen.getByTestId('difficulty-medium').className).toContain(
      'ant-btn-primary',
    );
    expect(screen.getByTestId('difficulty-easy').className).not.toContain(
      'ant-btn-primary',
    );
  });
});

describe('SongListView — liking', () => {
  it('toggles a like and notifies the backend', () => {
    renderView();

    loadSongs([makeSong('a', { liked: false })]);

    fireEvent.click(row('a').getByTestId('like-toggle'));

    expect(ipc.sent).toContainEqual({
      channel: 'like-song',
      args: ['a', true],
    });
  });
});

describe('SongListView — navigation', () => {
  it('opens the song view when a local song row is clicked', () => {
    renderView();

    loadSongs([makeSong('a')]);

    fireEvent.click(screen.getByText('Name a'));

    expect(screen.getByTestId('song-view-stub')).toBeInTheDocument();
  });
});

describe('SongListView — stem splitting', () => {
  it('queues a split, shows progress, then reports success', () => {
    renderView();

    loadSongs([makeSong('a')]);
    setStemTools('ready');

    fireEvent.click(row('a').getByTestId('song-menu-trigger'));
    fireEvent.click(screen.getByText('Split stems'));

    expect(ipc.sent).toContainEqual({ channel: 'split-song', args: ['a'] });
    expect(notification.info).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Processing queue')).toBeInTheDocument();

    emit('split-song', { id: 'a', progress: 50 });

    const split = makeSong('a', { name: 'Name a', audio: [] });

    emit('split-song', { id: 'a', success: true, song: split });

    expect(notification.success).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Processing queue')).not.toBeInTheDocument();
  });

  it('reports a failed split', () => {
    renderView();

    loadSongs([makeSong('a')]);
    setStemTools('ready');

    fireEvent.click(row('a').getByTestId('song-menu-trigger'));
    fireEvent.click(screen.getByText('Split stems'));

    emit('split-song', { id: 'a', success: false, error: 'boom' });

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      description: 'boom',
    });
  });
});

describe('SongListView — online mode', () => {
  it('activates online search and shows the results when switched', () => {
    online.results = [makeSong('x'), makeSong('y')];
    online.total = 2;

    renderView();
    loadSongs([]);

    fireEvent.click(screen.getByTestId('mode-online'));

    expect(online.calls.at(-1)).toMatchObject({ active: true });
    expect(screen.getByText('Name x')).toBeInTheDocument();
    expect(screen.getByText('Name y')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('downloads an online song and marks it as downloaded', () => {
    online.results = [makeSong('x')];

    renderView();
    loadSongs([], '/music');

    fireEvent.click(screen.getByTestId('mode-online'));
    fireEvent.click(row('x').getByTestId('download-button'));

    expect(ipc.sent).toContainEqual({
      channel: 'download-song',
      args: [
        {
          url: '/songs/x',
          md5: 'x',
          name: 'Name x',
          artist: 'Artist x',
          charter: 'Charter x',
        },
      ],
    });

    emit('download-song', { success: true, md5: 'x', song: makeSong('x') });

    expect(row('x').getByTestId('downloaded-indicator')).toBeInTheDocument();
  });

  it('disables downloads until a library folder is selected', () => {
    online.results = [makeSong('x')];

    renderView();
    loadSongs([], null);

    fireEvent.click(screen.getByTestId('mode-online'));

    expect(row('x').getByTestId('download-button')).toBeDisabled();
  });
});

describe('SongListView — settings', () => {
  it('rescans the folder from the settings menu', () => {
    renderView();
    loadSongs([makeSong('a')], '/music');

    fireEvent.click(screen.getByTestId('settings-trigger'));
    fireEvent.click(screen.getByTestId('rescan-folder'));

    expect(ipc.sent).toContainEqual({
      channel: 'rescan-songs',
      args: [false],
    });
  });

  it('shows live scan progress under the folder buttons, then hides it', () => {
    renderView();
    loadSongs([makeSong('a')], '/music');

    fireEvent.click(screen.getByTestId('settings-trigger'));

    emit('rescan-songs', { current: 3, total: 6 });

    const progress = screen.getByTestId('scan-progress');

    expect(progress).toBeInTheDocument();
    expect(within(progress).getByText('50%')).toBeInTheDocument();

    emit('rescan-songs', { songs: [makeSong('a')], lastOpenedPath: '/music' });

    expect(screen.queryByTestId('scan-progress')).not.toBeInTheDocument();
  });

  it('offers the stem-splitter download when tools are missing and available', () => {
    renderView();
    loadSongs([makeSong('a')]);
    setStemTools('download');
    emit('check-stem-tools-update', {
      available: true,
      updateAvailable: false,
      downloadSize: 280_000_000,
      uncompressedSize: 700_000_000,
    });

    fireEvent.click(screen.getByTestId('settings-trigger'));
    fireEvent.click(screen.getByText(/Get stem splitter/));

    expect(ipc.sent.map((s) => s.channel)).toContain('download-stem-tools');
  });
});

describe('SongListView input control gating', () => {
  function renderAt(path: string) {
    return render(
      <AppProvider>
        <InputProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<SongListView />}>
                <Route
                  path=":id"
                  element={<div data-testid="song-view-stub" />}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </InputProvider>
      </AppProvider>,
    );
  }

  function lastEnabled() {
    return useInputControlsMock.mock.calls.at(-1)?.[2];
  }

  it('enables controls on the list', () => {
    renderAt('/');

    expect(lastEnabled()).toBe(true);
  });

  it('disables controls while a song is open in the outlet', () => {
    renderAt('/song-1');

    expect(lastEnabled()).toBe(false);
  });

  it('selects the first focused song with the green tom', () => {
    renderView();
    loadSongs([makeSong('a')]);

    function handlers() {
      return useInputControlsMock.mock.calls.at(-1)?.[1] as Record<
        string,
        () => void
      >;
    }

    act(() => handlers().tom2());
    act(() => handlers().tom3());

    expect(screen.getByTestId('song-view-stub')).toBeInTheDocument();
  });
});

describe('SongListView — input navigation', () => {
  function handlers() {
    return useInputControlsMock.mock.calls.at(-1)?.[1] as Record<
      string,
      () => void
    >;
  }

  function focused(id: string) {
    return screen.getByTestId(`song-item-${id}`).className.includes('outline');
  }

  it('moves focus forward and backward through the list', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b'), makeSong('c')]);

    act(() => handlers().tom2());
    expect(focused('a')).toBe(true);

    act(() => handlers().tom2());
    expect(focused('b')).toBe(true);
    expect(focused('a')).toBe(false);

    act(() => handlers().tom1());
    expect(focused('a')).toBe(true);
  });

  it('keeps the focused song after returning from the song view', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b'), makeSong('c')]);

    act(() => handlers().tom2());
    act(() => handlers().tom2());
    expect(focused('b')).toBe(true);

    act(() => handlers().tom3());
    expect(screen.getByTestId('song-view-stub')).toBeInTheDocument();

    emit('update-song', makeSong('b'));

    fireEvent.click(screen.getByTestId('song-view-back'));

    expect(screen.queryByTestId('song-view-stub')).toBeNull();
    expect(focused('b')).toBe(true);
  });

  it('clears focus when the name filter changes', () => {
    renderView();
    loadSongs([
      makeSong('a', { name: 'Alpha' }),
      makeSong('b', { name: 'Beta' }),
    ]);

    act(() => handlers().tom2());
    expect(focused('a')).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Enter song name'), {
      target: { value: 'Alpha' },
    });

    expect(focused('a')).toBe(false);
  });

  it('clears focus when the sort changes', () => {
    renderView();
    loadSongs([
      makeSong('a', { name: 'Alpha' }),
      makeSong('b', { name: 'Beta' }),
    ]);

    act(() => handlers().tom2());
    expect(focused('a')).toBe(true);

    fireEvent.click(screen.getByTestId('sort-trigger'));
    fireEvent.click(screen.getByText('Name').closest('button')!);

    expect(focused('a')).toBe(false);
  });

  it('clears focus when the mode changes', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    act(() => handlers().tom2());
    expect(focused('a')).toBe(true);

    act(() => handlers().ride());
    act(() => handlers().ride());

    expect(focused('a')).toBe(false);
  });

  it('toggles online mode with the ride cymbal', () => {
    renderView();
    loadSongs([]);

    act(() => handlers().ride());

    expect(online.calls.at(-1)).toMatchObject({ active: true });
  });

  it('cycles the difficulty filter with the crash cymbal', () => {
    renderView();
    loadSongs([
      makeSong('a', { name: 'Easy Only', drumDifficulties: ['easy'] }),
      makeSong('b', { name: 'Expert Only', drumDifficulties: ['expert'] }),
    ]);

    expect(screen.getByText('Expert Only')).toBeInTheDocument();
    expect(screen.queryByText('Easy Only')).not.toBeInTheDocument();

    act(() => handlers().crash());

    expect(screen.getByText('Easy Only')).toBeInTheDocument();
    expect(screen.queryByText('Expert Only')).not.toBeInTheDocument();
  });

  it('wraps back to the original difficulty after a full cycle', () => {
    renderView();
    loadSongs([
      makeSong('a', { name: 'Easy Only', drumDifficulties: ['easy'] }),
      makeSong('b', { name: 'Expert Only', drumDifficulties: ['expert'] }),
    ]);

    for (let i = 0; i < 4; i += 1) {
      act(() => handlers().crash());
    }

    expect(screen.getByText('Expert Only')).toBeInTheDocument();
    expect(screen.queryByText('Easy Only')).not.toBeInTheDocument();
  });

  it('downloads the focused song with the green tom in online mode', () => {
    online.results = [makeSong('x')];

    renderView();
    loadSongs([], '/music');

    fireEvent.click(screen.getByTestId('mode-online'));

    act(() => handlers().tom2());
    act(() => handlers().tom3());

    expect(ipc.sent.map((s) => s.channel)).toContain('download-song');
  });
});

describe('SongListView — sort menu navigation', () => {
  const SORT_LABELS = ['Name', 'Favorite', 'Last added', 'Difficulty'];

  function handlers() {
    return useInputControlsMock.mock.calls.at(-1)?.[1] as Record<
      string,
      () => void
    >;
  }

  function sortButton(label: string) {
    return screen
      .getAllByText(label, { exact: true })
      .map((el) => el.closest('button'))
      .find(
        (button): button is HTMLButtonElement =>
          !!button && button.className.includes('justify-start'),
      )!;
  }

  function outlinedSort() {
    return SORT_LABELS.find((label) =>
      sortButton(label).className.includes('outline-accent'),
    );
  }

  function focusSort(label: string) {
    for (let i = 0; i < SORT_LABELS.length; i += 1) {
      if (outlinedSort() === label) {
        return;
      }

      act(() => handlers().tom2());
    }
  }

  it('opens the sort menu with the kick and swaps to the sort control map', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    expect(handlers().kick).toBeTypeOf('function');

    act(() => handlers().kick());

    expect(handlers().snare).toBeTypeOf('function');
  });

  it('moves the sort focus back and forth with the toms', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    act(() => handlers().kick());

    const before = outlinedSort();

    act(() => handlers().tom2());

    const after = outlinedSort();

    expect(after).not.toBe(before);

    act(() => handlers().tom1());

    expect(outlinedSort()).toBe(before);
  });

  it('toggles the direction of a directional key with the blue tom', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    act(() => handlers().kick());
    focusSort('Name');
    act(() => handlers().tom3());

    expect(
      sortButton('Name').querySelector('[data-icon="arrow-down"]'),
    ).not.toBeNull();
  });

  it('ignores the direction toggle on the non-directional favorite key', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    act(() => handlers().kick());
    focusSort('Favorite');

    expect(() => act(() => handlers().tom3())).not.toThrow();
    expect(outlinedSort()).toBe('Favorite');
  });

  it('closes the sort menu with the snare and restores the list control map', () => {
    renderView();
    loadSongs([makeSong('a'), makeSong('b')]);

    act(() => handlers().kick());

    expect(handlers().snare).toBeTypeOf('function');

    act(() => handlers().snare());

    expect(handlers().kick).toBeTypeOf('function');
    expect(handlers().snare).toBeUndefined();
  });

  it('does not open the sort menu in online mode', () => {
    renderView();
    loadSongs([], '/music');
    fireEvent.click(screen.getByTestId('mode-online'));

    expect(() => act(() => handlers().kick())).not.toThrow();
    expect(handlers().snare).toBeUndefined();
  });
});

describe('SongListView — input navigation edge cases', () => {
  function handlers() {
    return useInputControlsMock.mock.calls.at(-1)?.[1] as Record<
      string,
      () => void
    >;
  }

  it('tolerates focus moves when the list is empty', () => {
    renderView();
    loadSongs([]);

    expect(() => {
      act(() => handlers().tom1());
      act(() => handlers().tom2());
    }).not.toThrow();
  });

  it('does nothing when activating with no focused song', () => {
    renderView();
    loadSongs([makeSong('a')]);

    act(() => handlers().tom3());

    expect(screen.queryByTestId('song-view-stub')).toBeNull();
  });
});
