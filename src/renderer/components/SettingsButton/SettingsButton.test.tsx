import { ReactNode, useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputEvent } from '../../input/types';
import { AppProvider, useApp } from '../../context/AppContext';
import { InputProvider } from '../../context/InputContext';
import { SongViewSettingsProvider } from '../../context/SongViewSettingsContext';
import {
  installIpcMock,
  installLocalStorage,
  IpcMock,
} from '../../hooks/test-support';
import { SettingsButton } from './SettingsButton';

vi.mock('../../input', () => ({
  inputBus: {
    start: () => {},
    capture: (_listener: (event: InputEvent) => void) => () => {},
    listDevices: () =>
      Promise.resolve([
        { id: 'midi:Pad', name: 'My Pad', sourceId: 'midi', port: 1 },
      ]),
  },
  controlSource: (id: string) => id.slice(0, id.indexOf(':')),
  controlLabel: (id: string) => id.slice(id.indexOf(':') + 1),
}));

let ipc: IpcMock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <InputProvider>
        <SongViewSettingsProvider>
          <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
        </SongViewSettingsProvider>
      </InputProvider>
    </AppProvider>
  );
}

function renderSongView() {
  return render(<SettingsButton page="song-view" />, { wrapper });
}

function renderSongList(props = {}) {
  return render(<SettingsButton page="song-list" {...props} />, { wrapper });
}

function open() {
  fireEvent.click(screen.getByTestId('settings-trigger'));
}

function enableDev() {
  act(() => {
    ipc.emit('check-dev', true);
  });
}

function persisted(key: string) {
  return JSON.parse(window.localStorage.getItem(key)!);
}

beforeEach(() => {
  installLocalStorage();
  ipc = installIpcMock();
});

describe('SettingsButton — song-view parameters', () => {
  it('selects a playhead style and persists it', () => {
    renderSongView();
    open();

    fireEvent.click(screen.getByText('Measure'));

    expect(persisted('settings.playheadStyle')).toBe('Measure');
  });

  it('toggles enable colors', () => {
    renderSongView();
    open();

    const colorsRow = screen
      .getByText('Enable colors')
      .closest('.justify-between')!;

    fireEvent.click(colorsRow.querySelector('button[role="switch"]')!);

    expect(persisted('settings.enableColors')).toBe(false);
  });

  it('toggles show tempo', () => {
    renderSongView();
    open();

    const tempoRow = screen
      .getByText('Show tempo')
      .closest('.justify-between')!;

    fireEvent.click(tempoRow.querySelector('button[role="switch"]')!);

    expect(persisted('settings.showTempo')).toBe(true);
  });

  it('toggles show reference and persists it', () => {
    renderSongView();
    open();

    const referenceRow = screen
      .getByText('Show reference')
      .closest('.justify-between')!;

    fireEvent.click(referenceRow.querySelector('button[role="switch"]')!);

    expect(persisted('settings.showReference')).toBe(false);
  });

  it('hides the show-reference switch when colors are disabled', () => {
    window.localStorage.setItem('settings.enableColors', JSON.stringify(false));

    renderSongView();
    open();

    expect(screen.queryByText('Show reference')).not.toBeInTheDocument();
  });

  it('toggles count-in', () => {
    renderSongView();
    open();

    const countInRow = screen
      .getByText('Count-in')
      .closest('.justify-between')!;

    fireEvent.click(countInRow.querySelector('button[role="switch"]')!);

    expect(persisted('settings.countIn')).toBe(false);
  });

  it('hides the bar-numbers switch unless dev mode is on', () => {
    renderSongView();
    open();

    expect(screen.queryByText('Show bar numbers')).not.toBeInTheDocument();

    enableDev();

    expect(screen.getByText('Show bar numbers')).toBeInTheDocument();
  });

  it('renders the mixer sliders that were passed in', () => {
    render(
      <SettingsButton
        page="song-view"
        volumeSliders={[<div key="s" data-testid="mixer-slider" />]}
      />,
      { wrapper },
    );
    open();

    expect(screen.getByText('Mixer')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-slider')).toBeInTheDocument();
  });

  it('does not offer a difficulty selector on the song-view page', () => {
    renderSongView();
    open();

    expect(screen.queryByTestId('difficulty-expert')).not.toBeInTheDocument();
  });

  it('labels the input button with the selected device while the modal is closed', () => {
    window.localStorage.setItem(
      'settings.selectedDevice',
      JSON.stringify({
        id: 'midi:Pad',
        name: 'My Pad',
        sourceId: 'midi',
        port: 1,
      }),
    );

    renderSongView();
    open();

    expect(screen.getByText('My Pad')).toBeInTheDocument();
    expect(screen.queryByText('Setup input')).not.toBeInTheDocument();
  });
});

describe('SettingsButton — song-list parameters', () => {
  it('selects a difficulty and persists it', () => {
    renderSongList();
    open();

    fireEvent.click(screen.getByTestId('difficulty-hard'));

    expect(persisted('settings.difficulty')).toBe('hard');
  });

  it('marks the active difficulty as primary', () => {
    window.localStorage.setItem(
      'settings.difficulty',
      JSON.stringify('medium'),
    );

    renderSongList();
    open();

    expect(screen.getByTestId('difficulty-medium').className).toContain(
      'ant-btn-primary',
    );
    expect(screen.getByTestId('difficulty-easy').className).not.toContain(
      'ant-btn-primary',
    );
  });

  it('shows only the folder name for a Windows-style library path', () => {
    function SeedPath() {
      const { setCurrentPath } = useApp();

      useEffect(() => {
        setCurrentPath('C:\\Users\\me\\My Library');
      }, [setCurrentPath]);

      return undefined;
    }

    render(
      <>
        <SeedPath />
        <SettingsButton page="song-list" />
      </>,
      { wrapper },
    );
    open();

    expect(screen.getByText('My Library')).toBeInTheDocument();
    expect(screen.queryByText(/C:\\/)).not.toBeInTheDocument();
  });

  it('requests a folder picker from the Select folder button', () => {
    renderSongList();
    open();

    fireEvent.click(screen.getByText('Select folder'));

    expect(ipc.sent).toContainEqual({ channel: 'rescan-songs', args: [] });
  });

  it('opens the input setup modal', async () => {
    renderSongView();
    open();

    expect(screen.queryByText('Configure input')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Setup input'));
    });

    expect(screen.getByText('Configure input')).toBeInTheDocument();
  });
});
