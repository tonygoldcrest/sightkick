import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  makeEnchorChart,
  makeListSong,
  setupSongListView,
} from './test-support';

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

describe('SongListView — loading the library', () => {
  it('requests the song list and stem-tool status on mount', () => {
    const view = setupSongListView();

    expect(view.sentChannels()).toContain('load-song-list');
    expect(view.sentChannels()).toContain('check-stem-tools');
  });

  it('shows the songs the backend returns', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a'), makeListSong('b')]);

    expect(screen.getByText('Name a')).toBeInTheDocument();
    expect(screen.getByText('Name b')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('guides to select a folder when none is chosen', () => {
    const view = setupSongListView();

    view.loadSongs([], null);

    expect(screen.getByText('Select folder')).toBeInTheDocument();
  });

  it('guides to download songs when the folder is empty', () => {
    const view = setupSongListView();

    view.loadSongs([], '/music');

    expect(screen.getByText('No songs in this folder.')).toBeInTheDocument();
    expect(screen.getByText('Download some')).toBeInTheDocument();
    expect(screen.queryByText('Select folder')).not.toBeInTheDocument();
  });

  it('reports when nothing matches the active filter', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Master of Puppets' }),
      makeListSong('b', { name: 'Enter Sandman' }),
    ]);
    view.search('nonexistent song');

    expect(screen.getByText('No songs match your filter.')).toBeInTheDocument();
    expect(screen.queryByText('Select folder')).not.toBeInTheDocument();
  });

  it('repopulates the list when the backend rescans', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    expect(screen.getByText('Name a')).toBeInTheDocument();

    view.rescanDone([makeListSong('c')], '/other');

    expect(screen.queryByText('Name a')).not.toBeInTheDocument();
    expect(screen.getByText('Name c')).toBeInTheDocument();
  });
});

describe('SongListView — filtering and sorting', () => {
  it('fuzzy-filters the list by name', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Master of Puppets' }),
      makeListSong('b', { name: 'Enter Sandman' }),
    ]);
    view.search('puppets');

    expect(screen.getByText('Master of Puppets')).toBeInTheDocument();
    expect(screen.queryByText('Enter Sandman')).not.toBeInTheDocument();
  });

  it('fuzzy-filters the list by artist', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'One', artist: 'Metallica' }),
      makeListSong('b', { name: 'Two', artist: 'Slayer' }),
    ]);
    view.search('metallica');

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
  });

  it('reorders the list when a sort option is chosen', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Charlie' }),
      makeListSong('b', { name: 'Alpha' }),
    ]);
    view.chooseSort('name');

    const rendered = screen
      .getAllByText(/Charlie|Alpha/)
      .map((el) => el.textContent);

    expect(rendered).toEqual(['Alpha', 'Charlie']);
  });
});

describe('SongListView — difficulty', () => {
  it('re-filters to songs charted at the chosen difficulty', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Expert Only', drumDifficulties: ['expert'] }),
      makeListSong('b', { name: 'Hard Only', drumDifficulties: ['hard'] }),
    ]);

    expect(screen.getByText('Expert Only')).toBeInTheDocument();
    expect(screen.queryByText('Hard Only')).not.toBeInTheDocument();

    view.selectDifficulty('hard');

    expect(screen.queryByText('Expert Only')).not.toBeInTheDocument();
    expect(screen.getByText('Hard Only')).toBeInTheDocument();
  });

  it('shows the high score for the selected difficulty', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', {
        scoreData: {
          expert: { hitNotes: 100, totalNotes: 100, falseHits: 0 },
          hard: { hitNotes: 45, totalNotes: 100, falseHits: 0 },
        },
      }),
    ]);

    expect(view.filledStars('a')).toBe(5);

    view.selectDifficulty('hard');

    expect(view.filledStars('a')).toBe(2);
  });
});

describe('SongListView — liking', () => {
  it('toggles a like and tells the backend', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a', { liked: false })]);
    view.like('a');

    expect(view.ipc.sent).toContainEqual({
      channel: 'like-song',
      args: ['a', true],
    });
  });
});

describe('SongListView — opening a song', () => {
  it('opens the perform mode selector and navigates', async () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.clickSong('a');
    view.chooseGameMode('perform');

    expect(await screen.findByTestId('song-view-stub')).toBeInTheDocument();
  });

  it('navigates into practice mode when chosen', async () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.clickSong('a');
    view.chooseGameMode('practice');

    expect(await screen.findByTestId('song-view-stub')).toBeInTheDocument();
  });
});

describe('SongListView — stem splitting', () => {
  it('queues a split, shows progress, then reports success', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.setStemTools('ready');

    view.openSongMenu('a');
    fireEvent.click(screen.getByText('Split stems'));

    expect(view.ipc.sent).toContainEqual({
      channel: 'split-song',
      args: ['a'],
    });
    expect(screen.getByText('Processing queue')).toBeInTheDocument();

    view.emit('split-song', { id: 'a', progress: 50 });
    view.emit('split-song', {
      id: 'a',
      success: true,
      song: makeListSong('a', { audio: [] }),
    });

    expect(screen.getByText(/split successfully/)).toBeInTheDocument();
    expect(screen.queryByText('Processing queue')).not.toBeInTheDocument();
  });

  it('reports a failed split', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.setStemTools('ready');

    view.openSongMenu('a');
    fireEvent.click(screen.getByText('Split stems'));

    view.emit('split-song', { id: 'a', success: false, error: 'boom' });

    expect(screen.getByText('Split failed')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('cancels a queued split', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.setStemTools('ready');

    view.openSongMenu('a');
    fireEvent.click(screen.getByText('Split stems'));

    const queueRoot = screen.getByText('Processing queue').parentElement!;

    fireEvent.click(within(queueRoot).getByRole('button'));

    expect(view.sentChannels()).toContain('cancel-split');

    view.emit('split-song', { id: 'a', cancelled: true });

    expect(screen.getByText('Split cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Processing queue')).not.toBeInTheDocument();
  });
});

describe('SongListView — online mode', () => {
  it('shows online results when switched', async () => {
    const view = setupSongListView({
      online: [makeEnchorChart('x'), makeEnchorChart('y')],
    });

    view.loadSongs([]);
    view.selectMode('online');

    expect(await screen.findByText('Name x')).toBeInTheDocument();
    expect(screen.getByText('Name y')).toBeInTheDocument();
  });

  it('downloads an online song and marks it downloaded', async () => {
    const view = setupSongListView({ online: [makeEnchorChart('x')] });

    view.loadSongs([], '/music');
    view.selectMode('online');

    await screen.findByText('Name x');
    fireEvent.click(
      within(screen.getByTestId('song-item-x')).getByTestId('download-button'),
    );

    expect(view.sentChannels()).toContain('download-song');

    view.emit('download-song', {
      success: true,
      md5: 'x',
      song: makeListSong('x'),
    });

    expect(
      within(screen.getByTestId('song-item-x')).getByTestId(
        'downloaded-indicator',
      ),
    ).toBeInTheDocument();
  });

  it('reports a failed download', async () => {
    const view = setupSongListView({ online: [makeEnchorChart('x')] });

    view.loadSongs([], '/music');
    view.selectMode('online');

    await screen.findByText('Name x');
    fireEvent.click(
      within(screen.getByTestId('song-item-x')).getByTestId('download-button'),
    );

    view.emit('download-song', { success: false, md5: 'x', error: 'no space' });

    expect(screen.getByText('Download failed')).toBeInTheDocument();
    expect(screen.getByText('no space')).toBeInTheDocument();
  });

  it('disables downloads until a folder is selected', async () => {
    const view = setupSongListView({ online: [makeEnchorChart('x')] });

    view.loadSongs([], null);
    view.selectMode('online');

    await screen.findByText('Name x');

    expect(
      within(screen.getByTestId('song-item-x')).getByTestId('download-button'),
    ).toBeDisabled();
  });
});

describe('SongListView — settings', () => {
  it('rescans the folder from settings', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')], '/music');
    view.openSettings();
    fireEvent.click(screen.getByTestId('rescan-folder'));

    expect(view.ipc.sent).toContainEqual({
      channel: 'rescan-songs',
      args: [false],
    });
  });

  it('shows live scan progress, then hides it', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')], '/music');
    view.openSettings();

    view.rescanProgress(3, 6);

    const progress = screen.getByTestId('scan-progress');

    expect(within(progress).getByText('50%')).toBeInTheDocument();

    view.rescanDone([makeListSong('a')], '/music');

    expect(screen.queryByTestId('scan-progress')).not.toBeInTheDocument();
  });

  it('offers the stem-splitter download when tools are missing but available', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.setStemTools('download');
    view.emit('check-stem-tools-update', {
      available: true,
      updateAvailable: false,
      downloadSize: 280_000_000,
      uncompressedSize: 700_000_000,
    });

    view.openSettings();
    fireEvent.click(screen.getByText(/Get stem splitter/));

    expect(view.sentChannels()).toContain('download-stem-tools');
  });

  it('shows stem-tool download progress and cancels it', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.setStemTools('download');
    view.emit('check-stem-tools-update', {
      available: true,
      updateAvailable: false,
      downloadSize: 280_000_000,
      uncompressedSize: 700_000_000,
    });

    view.openSettings();
    fireEvent.click(screen.getByText(/Get stem splitter/));
    view.emit('download-stem-tools', { progress: 40 });

    expect(screen.getByTestId('stem-tools-progress')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-stem-tools'));

    expect(view.sentChannels()).toContain('cancel-stem-tools');
  });
});

describe('SongListView — keyboard navigation', () => {
  it('moves focus forward and backward through the list', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a'), makeListSong('b'), makeListSong('c')]);

    view.press('down');
    expect(view.isFocused('a')).toBe(true);

    view.press('down');
    expect(view.isFocused('b')).toBe(true);
    expect(view.isFocused('a')).toBe(false);

    view.press('up');
    expect(view.isFocused('a')).toBe(true);
  });

  it('opens the focused song with confirm', async () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);

    view.press('down');
    view.press('confirm');
    view.chooseGameMode('perform');

    expect(await screen.findByTestId('song-view-stub')).toBeInTheDocument();
  });

  it('does nothing when confirming with no focused song', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')]);
    view.press('confirm');

    expect(screen.queryByTestId('song-view-stub')).not.toBeInTheDocument();
    expect(screen.queryByText('perform')).not.toBeInTheDocument();
  });

  it('tolerates focus moves on an empty list', () => {
    const view = setupSongListView();

    view.loadSongs([]);

    expect(() => {
      view.press('up');
      view.press('down');
    }).not.toThrow();
  });

  it('clears focus when the filter changes', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Alpha' }),
      makeListSong('b', { name: 'Beta' }),
    ]);

    view.press('down');
    expect(view.isFocused('a')).toBe(true);

    view.search('Alpha');

    expect(view.isFocused('a')).toBe(false);
  });

  it('toggles online mode with the library control', async () => {
    const view = setupSongListView({ online: [makeEnchorChart('x')] });

    view.loadSongs([]);
    view.press('library');

    expect(await screen.findByText('Name x')).toBeInTheDocument();
  });

  it('cycles the difficulty filter with the difficulty control', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Easy Only', drumDifficulties: ['easy'] }),
      makeListSong('b', { name: 'Expert Only', drumDifficulties: ['expert'] }),
    ]);

    expect(screen.getByText('Expert Only')).toBeInTheDocument();
    expect(screen.queryByText('Easy Only')).not.toBeInTheDocument();

    view.press('difficulty');

    expect(screen.getByText('Easy Only')).toBeInTheDocument();
    expect(screen.queryByText('Expert Only')).not.toBeInTheDocument();
  });
});

describe('SongListView — sort menu navigation', () => {
  it('opens the sort menu with the sort control', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a'), makeListSong('b')]);

    expect(screen.queryByText('Last added')).not.toBeInTheDocument();

    view.press('sort');

    expect(screen.getByText('Last added')).toBeInTheDocument();
  });

  it('reorders the list by navigating the sort menu', () => {
    const view = setupSongListView();

    view.loadSongs([
      makeListSong('a', { name: 'Charlie', liked: true }),
      makeListSong('b', { name: 'Alpha', liked: false }),
    ]);

    expect(
      screen.getAllByText(/Charlie|Alpha/).map((el) => el.textContent),
    ).toEqual(['Charlie', 'Alpha']);

    view.press('sort');
    view.press('up');

    expect(
      screen.getAllByText(/Charlie|Alpha/).map((el) => el.textContent),
    ).toEqual(['Alpha', 'Charlie']);
  });

  it('does not open the sort menu in online mode', () => {
    const view = setupSongListView();

    view.loadSongs([], '/music');
    view.selectMode('online');
    view.press('sort');

    expect(screen.queryByText('Last added')).not.toBeInTheDocument();
  });
});

describe('SongListView — waiting on results', () => {
  it('keeps the list stable across a rescan with no changes', async () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')], '/music');
    view.rescanDone([makeListSong('a')], '/music');

    await waitFor(() => {
      expect(screen.getByText('Name a')).toBeInTheDocument();
    });
  });
});

describe('SongListView — input configuration', () => {
  it('opens the input configuration from settings', () => {
    const view = setupSongListView();

    view.loadSongs([]);
    view.openInputConfig();

    expect(screen.getByText('Configure input')).toBeInTheDocument();
  });

  it('binds a keyboard control by listening for a key', () => {
    const view = setupSongListView();

    view.loadSongs([]);
    view.openInputConfig();
    view.learnControl('snare');

    expect(
      within(view.inputRow('snare')).getByText('Listening'),
    ).toBeInTheDocument();

    view.typeKey('KeyJ');

    expect(
      within(view.inputRow('snare')).getByText('KeyJ'),
    ).toBeInTheDocument();
  });

  it('moves a control to a new element, clearing the old binding', () => {
    const view = setupSongListView();

    view.loadSongs([]);
    view.openInputConfig();

    view.learnControl('snare');
    view.typeKey('KeyJ');
    expect(
      within(view.inputRow('snare')).getByText('KeyJ'),
    ).toBeInTheDocument();

    view.learnControl('kick');
    view.typeKey('KeyJ');

    expect(within(view.inputRow('kick')).getByText('KeyJ')).toBeInTheDocument();
    expect(
      within(view.inputRow('snare')).queryByText('KeyJ'),
    ).not.toBeInTheDocument();
  });
});

describe('SongListView — library folder', () => {
  it('shows the folder basename and requests a picker when clicked', () => {
    const view = setupSongListView();

    view.loadSongs([makeListSong('a')], 'C:\\Music\\Rock\\Songs');
    view.openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }));

    expect(view.ipc.sent).toContainEqual({
      channel: 'rescan-songs',
      args: [],
    });
  });
});
