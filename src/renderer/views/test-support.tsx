import { ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import { vi } from 'vitest';
import { IpcLoadSongResponse, Song } from '../../types';
import { antdTheme } from '../antdTheme';
import { AppProvider } from '../context/AppContext';
import { InputProvider } from '../context/InputContext';
import { SongViewSettingsProvider } from '../context/SongViewSettingsContext';
import {
  installIpcMock,
  installLocalStorage,
  IpcMock,
} from '../hooks/test-support';
import {
  FakeAudioContext,
  FakeBufferSource,
  installFetchByByteLength,
  installWebAudio,
} from '../services/audio-player/test-support';
import { SongView } from './SongView';
import { SongListView } from './SongListView';
import App from '../App';

export const DRUM_CHART = `[Song]
{
  Name = "Fixture"
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[Events]
{
}
[ExpertDrums]
{
  0 = N 1 0
  192 = N 1 0
  384 = N 1 0
  576 = N 1 0
  768 = N 1 0
  960 = N 1 0
  1152 = N 1 0
  1344 = N 1 0
}
`;

export const GUITAR_ONLY_CHART = `[Song]
{
  Name = "Fixture"
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[Events]
{
}
[ExpertSingle]
{
  0 = N 0 0
}
`;

export const SINGLE_NOTE_CHART = `[Song]
{
  Name = "Fixture"
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
}
[Events]
{
}
[ExpertDrums]
{
  0 = N 1 0
}
`;

export const COUNT_IN_BEATS = 4;

export const BEAT_SECONDS = 0.5;

export function makeSong(extra: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    dir: '/songs/song-1',
    name: 'Master of Puppets',
    artist: 'Metallica',
    album: 'Master of Puppets',
    charter: 'Charter',
    genre: 'Metal',
    year: '1986',
    fiveLaneDrums: false,
    proDrums: true,
    delaySeconds: 0,
    drumDifficulty: 5,
    format: 'chart',
    audio: [{ src: 'song.ogg', name: 'song' }],
    ...extra,
  };
}

export interface KeyboardSeed {
  kit?: Record<string, string[]>;
  controls?: Record<string, string[]>;
}

export interface SongViewOptions {
  route?: string;
  settings?: Record<string, unknown>;
  keyboard?: KeyboardSeed;
}

export interface SongViewHarness {
  ipc: IpcMock;
  audio: FakeAudioContext;
  loadSong(song?: Song, chartText?: string): Promise<void>;
  clickPlay(): void;
  pressKey(code: string): Promise<void>;
  openSettings(): void;
  openMoreSettings(): void;
  toggleSetting(label: string): void;
  clickTestId(testId: string): void;
  clickTrackMuteToggle(): HTMLElement;
  completeCountIn(): Promise<void>;
  finishSong(): Promise<void>;
  startedSources(): FakeBufferSource[];
  sentChannels(): string[];
  updateSongPayloads(): unknown[];
  measureHighlights(): HTMLElement[];
  playheadCursor(): HTMLElement;
  mixerControls(name: string): {
    mute: HTMLElement;
    solo: HTMLElement;
  };
  masterMuteButton(): HTMLElement;
  mutedGainCount(): number;
  currentTimeText(): string | undefined;
  seekToEnd(): void;
  unmount(): void;
}

function shimSvgBBox() {
  (
    globalThis.SVGElement.prototype as unknown as { getBBox: () => DOMRect }
  ).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}

function seedSettings(settings: Record<string, unknown>) {
  Object.entries(settings).forEach(([key, value]) => {
    window.localStorage.setItem(`settings.${key}`, JSON.stringify(value));
  });
}

function seedKeyboardDevice({ kit = {}, controls = {} }: KeyboardSeed) {
  seedSettings({
    selectedDevice: { id: 'keyboard', name: 'Keyboard', sourceId: 'keyboard' },
    inputMappings: { keyboard: kit },
    controlMappings: { keyboard: controls },
  });
}

export function setupSongView({
  route = '/song-1',
  settings,
  keyboard,
}: SongViewOptions = {}): SongViewHarness {
  shimSvgBBox();
  installLocalStorage();

  const ipc = installIpcMock();
  const audio = installWebAudio();

  installFetchByByteLength(() => 8);

  if (settings) {
    seedSettings(settings);
  }

  if (keyboard) {
    seedKeyboardDevice(keyboard);
  }

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <AppProvider>
            <InputProvider>
              <SongViewSettingsProvider>
                <MemoryRouter initialEntries={[route]}>
                  <Routes>
                    <Route
                      path="/"
                      element={<div data-testid="song-list-stub" />}
                    />
                    <Route path=":id" element={children} />
                  </Routes>
                </MemoryRouter>
              </SongViewSettingsProvider>
            </InputProvider>
          </AppProvider>
        </AntdApp>
      </ConfigProvider>
    );
  }

  const { unmount } = render(<SongView />, { wrapper });

  return {
    ipc,
    audio,
    unmount,

    async loadSong(song = makeSong(), chartText = DRUM_CHART) {
      const response: IpcLoadSongResponse = {
        data: song,
        fileData: new TextEncoder().encode(chartText) as unknown as Buffer,
      };

      await act(async () => {
        ipc.emit('midi-device-list', []);
        ipc.emit('load-song', response);
      });
    },

    clickPlay() {
      fireEvent.click(screen.getByTestId('play-toggle'));
    },

    async pressKey(code: string) {
      await act(async () => {
        fireEvent.keyDown(window, { code });
      });
    },

    openSettings() {
      fireEvent.click(screen.getByTestId('settings-trigger'));
    },

    openMoreSettings() {
      fireEvent.click(screen.getByTestId('more-settings'));
    },

    toggleSetting(key: string) {
      fireEvent.click(screen.getByTestId(`setting-${key}`));
    },

    clickTestId(testId: string) {
      fireEvent.click(screen.getByTestId(testId));
    },

    clickTrackMuteToggle() {
      const button = screen.getByTestId('mute-Volume');

      fireEvent.click(button);

      return button;
    },

    async completeCountIn() {
      await act(async () => {
        audio.currentTime = COUNT_IN_BEATS * BEAT_SECONDS + 0.01;
        await vi.advanceTimersByTimeAsync(50);
      });
    },

    async finishSong() {
      await act(async () => {
        audio.bufferSources
          .filter((source) => source.starts.length > 0)
          .forEach((source) => source.emitEnded());
      });
    },

    startedSources() {
      return audio.bufferSources.filter(
        (source) => source.starts.length > 0 && !source.stopped,
      );
    },

    sentChannels() {
      return ipc.sent.map((s) => s.channel);
    },

    updateSongPayloads() {
      return ipc.sent
        .filter((s) => s.channel === 'update-song')
        .map((s) => s.args[0]);
    },

    measureHighlights() {
      return screen.getAllByTestId('measure-overlay');
    },

    playheadCursor() {
      return screen.getByTestId('playhead-cursor');
    },

    mixerControls(name: string) {
      return {
        mute: screen.getByTestId(`mute-${name}`),
        solo: screen.getByTestId(`solo-${name}`),
      };
    },

    masterMuteButton() {
      return screen.getByTestId('mute-Master');
    },

    mutedGainCount() {
      return audio.gainNodes.filter((node) => node.gain.value === 0).length;
    },

    currentTimeText() {
      const readout = document.querySelector('.text-xs.text-text-muted');

      return readout?.textContent ?? undefined;
    },

    seekToEnd() {
      const slider = document.querySelector('[role="slider"]');

      if (!(slider instanceof HTMLElement)) {
        throw new Error('No scrubbing slider found');
      }

      fireEvent.keyDown(slider, { key: 'End', keyCode: 35 });
    },
  };
}

const ALL_DRUM_DIFFICULTIES: Song['drumDifficulties'] = [
  'easy',
  'medium',
  'hard',
  'expert',
];

export function makeListSong(id: string, extra: Partial<Song> = {}): Song {
  return {
    id,
    dir: `/songs/${id}`,
    name: `Name ${id}`,
    artist: `Artist ${id}`,
    album: `Album ${id}`,
    charter: `Charter ${id}`,
    genre: 'Metal',
    year: '1986',
    fiveLaneDrums: false,
    proDrums: true,
    delaySeconds: 0,
    drumDifficulty: 3,
    format: 'mid',
    audio: [{ src: 'song.ogg', name: 'song' }],
    drumDifficulties: ALL_DRUM_DIFFICULTIES,
    ...extra,
  };
}

export interface EnchorChart {
  md5: string;
  name: string;
  artist: string;
  charter: string;
  noteCounts: { instrument: string; difficulty: string; count: number }[];
}

export function makeEnchorChart(
  id: string,
  extra: Partial<EnchorChart> = {},
): EnchorChart {
  return {
    md5: id,
    name: `Name ${id}`,
    artist: `Artist ${id}`,
    charter: `Charter ${id}`,
    noteCounts: [{ instrument: 'drums', difficulty: 'expert', count: 100 }],
    ...extra,
  };
}

function installOnlineFetch(getResults: () => EnchorChart[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      const charts = getResults();

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            data: charts.map(({ noteCounts, ...chart }) => ({
              ...chart,
              notesData: { noteCounts },
            })),
            found: charts.length,
          }),
      });
    }),
  );
}

const NAV_CONTROLS: Record<string, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  confirm: 'Enter',
  back: 'Escape',
  sort: 'KeyS',
  library: 'KeyL',
  difficulty: 'KeyD',
};

function navControlMappings(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(NAV_CONTROLS).map(([element, code]) => [
      element,
      [`keyboard:${code}`],
    ]),
  );
}

export interface SongListOptions {
  route?: string;
  settings?: Record<string, unknown>;
  online?: EnchorChart[];
}

export interface SongListHarness {
  ipc: IpcMock;
  loadSongs(songs?: Song[], lastOpenedPath?: string | null): void;
  rescanProgress(current: number, total: number): void;
  rescanDone(songs: Song[], lastOpenedPath?: string | null): void;
  emit(channel: string, ...args: unknown[]): void;
  setStemTools(status: 'ready' | 'download' | 'unsupported'): void;
  setOnline(charts: EnchorChart[]): void;
  search(text: string): void;
  selectMode(mode: 'local' | 'online'): void;
  openSettings(): void;
  selectDifficulty(difficulty: string): void;
  openSort(): void;
  chooseSort(label: string): void;
  like(id: string): void;
  clickSong(id: string): void;
  chooseGameMode(mode: 'perform' | 'practice'): void;
  openSongMenu(id: string): void;
  press(control: keyof typeof NAV_CONTROLS): void;
  typeKey(code: string): void;
  openInputConfig(): void;
  inputRow(displayName: string): HTMLElement;
  learnControl(displayName: string): void;
  row(id: string): ReturnType<typeof within>;
  filledStars(id: string): number;
  isFocused(id: string): boolean;
  sentChannels(): string[];
}

export function setupSongListView({
  route = '/',
  settings,
  online = [],
}: SongListOptions = {}): SongListHarness {
  shimSvgBBox();
  installLocalStorage();

  const ipc = installIpcMock();
  let onlineResults = online;

  installOnlineFetch(() => onlineResults);

  seedSettings({
    selectedDevice: { id: 'keyboard', name: 'Keyboard', sourceId: 'keyboard' },
    controlMappings: { keyboard: navControlMappings() },
    ...settings,
  });

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
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <AppProvider>
            <InputProvider>
              <MemoryRouter initialEntries={[route]}>
                <Routes>
                  <Route path="/" element={children}>
                    <Route path=":id" element={<SongViewStub />} />
                  </Route>
                </Routes>
              </MemoryRouter>
            </InputProvider>
          </AppProvider>
        </AntdApp>
      </ConfigProvider>
    );
  }

  render(<SongListView />, { wrapper });

  function emit(channel: string, ...args: unknown[]) {
    act(() => {
      ipc.emit(channel, ...args);
    });
  }

  function row(id: string) {
    return within(screen.getByTestId(`song-item-${id}`));
  }

  return {
    ipc,
    emit,
    row,

    loadSongs(songs = [], lastOpenedPath = '/music') {
      emit('load-song-list', { songs, lastOpenedPath });
    },

    rescanProgress(current: number, total: number) {
      emit('rescan-songs', { current, total });
    },

    rescanDone(songs: Song[], lastOpenedPath = '/music') {
      emit('rescan-songs', { songs, lastOpenedPath });
    },

    setStemTools(status) {
      emit('check-stem-tools', { status });
    },

    setOnline(charts: EnchorChart[]) {
      onlineResults = charts;
    },

    search(text: string) {
      fireEvent.change(screen.getByTestId('song-search'), {
        target: { value: text },
      });
    },

    selectMode(mode) {
      fireEvent.click(screen.getByTestId(`mode-${mode}`));
    },

    openSettings() {
      fireEvent.click(screen.getByTestId('settings-trigger'));
    },

    selectDifficulty(difficulty: string) {
      fireEvent.click(screen.getByTestId('settings-trigger'));
      fireEvent.click(screen.getByTestId(`difficulty-${difficulty}`));
    },

    openSort() {
      fireEvent.click(screen.getByTestId('sort-trigger'));
    },

    chooseSort(key: string) {
      fireEvent.click(screen.getByTestId('sort-trigger'));
      fireEvent.click(screen.getByTestId(`sort-option-${key}`));
    },

    like(id: string) {
      fireEvent.click(row(id).getByTestId('like-toggle'));
    },

    clickSong(id: string) {
      fireEvent.click(screen.getByTestId(`song-item-${id}`));
    },

    chooseGameMode(mode) {
      fireEvent.click(screen.getByTestId(`game-mode-${mode}`));
    },

    openSongMenu(id: string) {
      fireEvent.click(row(id).getByTestId('song-menu-trigger'));
    },

    press(control) {
      act(() => {
        fireEvent.keyDown(window, { code: NAV_CONTROLS[control] });
      });
    },

    typeKey(code: string) {
      act(() => {
        fireEvent.keyDown(window, { code });
      });
    },

    openInputConfig() {
      fireEvent.click(screen.getByTestId('settings-trigger'));
      fireEvent.click(screen.getByTestId('setup-input'));
    },

    inputRow(element: string) {
      return screen.getByTestId(`input-row-${element}`);
    },

    learnControl(element: string) {
      fireEvent.click(screen.getByTestId(`learn-${element}`));
    },

    filledStars(id: string) {
      return screen
        .getByTestId(`song-item-${id}`)
        .querySelectorAll('[data-filled]').length;
    },

    isFocused(id: string) {
      return screen.getByTestId(`song-item-${id}`).hasAttribute('data-focused');
    },

    sentChannels() {
      return ipc.sent.map((s) => s.channel);
    },
  };
}

export interface AppHarness {
  ipc: IpcMock;
  emit(channel: string, ...args: unknown[]): void;
  sentChannels(): string[];
}

export function setupApp(): AppHarness {
  shimSvgBBox();
  installLocalStorage();

  const ipc = installIpcMock();

  installOnlineFetch(() => []);
  installWebAudio();

  render(<App />);

  return {
    ipc,

    emit(channel: string, ...args: unknown[]) {
      act(() => {
        ipc.emit(channel, ...args);
      });
    },

    sentChannels() {
      return ipc.sent.map((s) => s.channel);
    },
  };
}
