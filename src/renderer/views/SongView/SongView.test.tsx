import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BEAT_SECONDS,
  COUNT_IN_BEATS,
  GUITAR_ONLY_CHART,
  SINGLE_NOTE_CHART,
  makeSong,
  setupSongView,
} from '../test-support';

const MULTI_STEM = {
  audio: [
    { src: 'drums.ogg', name: 'drums' },
    { src: 'guitar.ogg', name: 'guitar' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('opening a song', () => {
  it('shows the song header and real rendered sheet music', async () => {
    const view = setupSongView();

    await view.loadSong();

    expect(screen.getAllByText('Master of Puppets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Metallica').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(document.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });

  it('prevents display sleep while open and releases it on leave', () => {
    const view = setupSongView();

    expect(view.sentChannels()).toContain('prevent-sleep');
  });

  it('reports a load failure and returns to the library', async () => {
    const view = setupSongView();

    await act(async () => {
      view.ipc.emit('load-song', { error: 'missing' });
    });

    expect(screen.getByText("Couldn't open this song")).toBeInTheDocument();
    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });

  it('reports a chart that has no parsable drum track', async () => {
    const view = setupSongView();

    await view.loadSong(makeSong(), GUITAR_ONLY_CHART);

    expect(screen.getByText('Chart parse failed')).toBeInTheDocument();
  });

  it('shows the difficulty selected in app settings', async () => {
    const view = setupSongView({ settings: { difficulty: 'hard' } });

    await view.loadSong();

    expect(screen.getByText('hard')).toBeInTheDocument();
  });
});

describe('playing with count-in', () => {
  it('counts a full measure in, schedules the music at the count-in end, then plays', async () => {
    vi.useFakeTimers();

    try {
      const view = setupSongView();

      await view.loadSong();
      view.clickPlay();

      expect(screen.getByText('1')).toBeInTheDocument();

      const songStart = COUNT_IN_BEATS * BEAT_SECONDS;
      const scheduled = view.audio.bufferSources.flatMap((s) => s.starts);

      expect(scheduled.some((start) => start.at === songStart)).toBe(true);

      await view.completeCountIn();

      expect(screen.queryByText('1')).not.toBeInTheDocument();
      expect(view.startedSources().length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the count-in when the play button is pressed again', async () => {
    vi.useFakeTimers();

    try {
      const view = setupSongView();

      await view.loadSong();
      view.clickPlay();

      expect(screen.getByText('1')).toBeInTheDocument();

      view.clickPlay();
      await view.completeCountIn();

      expect(screen.queryByText('1')).not.toBeInTheDocument();
      expect(view.startedSources()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('disabling the count-in from settings', () => {
  it('starts playback immediately after the count-in switch is turned off', async () => {
    const view = setupSongView();

    await view.loadSong();

    view.openSettings();
    view.openMoreSettings();
    view.toggleSetting('count-in');
    view.clickPlay();

    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(view.startedSources().length).toBeGreaterThan(0);
  });

  it('pauses and resumes from the play button', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.clickPlay();
    expect(view.startedSources().length).toBeGreaterThan(0);

    view.clickPlay();
    expect(view.audio.state).toBe('suspended');
  });
});

describe('metronome', () => {
  it('unmuting the click track in settings makes the clicks audible on the beat grid', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.openSettings();
    view.clickTrackMuteToggle();
    view.clickPlay();

    const clickGainRaised = view.audio.gainNodes.some((node) =>
      node.gain.calls.some((call) => call.value === 0.8),
    );

    expect(clickGainRaised).toBe(true);
  });
});

describe('playhead', () => {
  it('shows a cursor over the sheet by default', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    expect(view.playheadCursor().style.display).not.toBe('none');

    view.clickPlay();

    expect(view.playheadCursor().style.display).not.toBe('none');
  });

  it('highlights the current measure instead when Measure style is chosen', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.openSettings();
    view.clickTestId('playhead-Measure');
    view.clickPlay();

    const [firstMeasure] = view.measureHighlights();

    expect(firstMeasure).toHaveAttribute('data-current');
    expect(view.playheadCursor().style.display).toBe('none');
  });
});

describe('sheet appearance', () => {
  it('renders drum-colored noteheads until colors are switched off in settings', async () => {
    const view = setupSongView();

    await view.loadSong();

    expect(document.querySelectorAll('.vf-note-snare').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.vf-note-uncolored')).toHaveLength(0);

    view.openSettings();
    view.openMoreSettings();
    view.toggleSetting('colors');

    await waitFor(() => {
      expect(
        document.querySelectorAll('.vf-note-uncolored').length,
      ).toBeGreaterThan(0);
      expect(document.querySelectorAll('.vf-note-snare')).toHaveLength(0);
    });
  });
});

describe('drumming and scoring', () => {
  it('persists a high score after a hit lands on a charted note', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: { kit: { snare: ['keyboard:KeyJ'] } },
    });

    await view.loadSong();

    view.clickPlay();
    await view.pressKey('KeyJ');
    await view.finishSong();

    expect(screen.getByTestId('score-modal')).toBeInTheDocument();
    expect(view.updateSongPayloads()).toEqual([
      {
        id: 'song-1',
        scoreData: { expert: { hitNotes: 1, totalNotes: 8, falseHits: 0 } },
      },
    ]);
  });

  it('counts a hit on the wrong drum against the score', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: {
        kit: { snare: ['keyboard:KeyJ'], kick: ['keyboard:KeyK'] },
      },
    });

    await view.loadSong();

    view.clickPlay();
    await view.pressKey('KeyJ');
    await view.pressKey('KeyK');
    await view.finishSong();

    expect(view.updateSongPayloads()).toEqual([
      {
        id: 'song-1',
        scoreData: { expert: { hitNotes: 1, totalNotes: 8, falseHits: 1 } },
      },
    ]);
  });

  it('shows the score modal but persists nothing for a run with no hits', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.clickPlay();
    await view.finishSong();

    expect(screen.getByTestId('score-modal')).toBeInTheDocument();
    expect(view.sentChannels()).not.toContain('update-song');
  });

  it('does not persist a run that fails to beat the previous high score', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: { kit: { snare: ['keyboard:KeyJ'] } },
    });

    await view.loadSong(
      makeSong({
        scoreData: { expert: { hitNotes: 8, totalNotes: 8, falseHits: 0 } },
      }),
    );

    view.clickPlay();
    await view.pressKey('KeyJ');
    await view.finishSong();

    expect(screen.getByTestId('score-modal')).toBeInTheDocument();
    expect(view.sentChannels()).not.toContain('update-song');
  });

  it('treats a kit key that doubles as the pause control as a drum while playing', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: {
        kit: { snare: ['keyboard:KeyJ'] },
        controls: { pause: ['keyboard:KeyJ'] },
      },
    });

    await view.loadSong();

    view.clickPlay();
    await view.pressKey('KeyJ');

    expect(view.audio.state).toBe('running');

    await view.finishSong();

    expect(view.updateSongPayloads()).toEqual([
      {
        id: 'song-1',
        scoreData: { expert: { hitNotes: 1, totalNotes: 8, falseHits: 0 } },
      },
    ]);
  });

  it('restarts the song from the top on retry', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.clickPlay();
    await view.finishSong();

    view.clickTestId('score-retry');

    expect(view.startedSources().length).toBeGreaterThan(0);
  });

  it('returns to the library on next song', async () => {
    const view = setupSongView({ settings: { countIn: false } });

    await view.loadSong();

    view.clickPlay();
    await view.finishSong();

    view.clickTestId('score-next');

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });

  it('advances from the score modal to the library with the confirm control', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: { controls: { confirm: ['keyboard:Enter'] } },
    });

    await view.loadSong();

    view.clickPlay();
    await view.finishSong();
    await view.pressKey('Enter');

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });
});

describe('transport controls', () => {
  it('starts and pauses playback from mapped keys', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: {
        controls: { confirm: ['keyboard:Enter'], pause: ['keyboard:Space'] },
      },
    });

    await view.loadSong();

    await view.pressKey('Enter');
    expect(view.startedSources().length).toBeGreaterThan(0);

    await view.pressKey('Space');
    expect(view.audio.state).toBe('suspended');
  });

  it('returns to the library from the back control while stopped', async () => {
    const view = setupSongView({
      keyboard: { controls: { back: ['keyboard:Escape'] } },
    });

    await view.loadSong();
    await view.pressKey('Escape');

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });

  it('navigates back to the library from the back button', async () => {
    const view = setupSongView();

    await view.loadSong();
    view.clickTestId('back-button');

    expect(screen.getByTestId('song-list-stub')).toBeInTheDocument();
  });
});

describe('exporting a PDF', () => {
  it('sends the rendered sheet to main and reports success', async () => {
    const view = setupSongView();

    await view.loadSong();

    view.openSettings();
    view.clickTestId('export-pdf');

    const request = view.ipc.sent.find((s) => s.channel === 'export-pdf');

    expect(request?.args[0]).toMatchObject({
      fileName: 'Master of Puppets - Metallica.pdf',
    });

    await act(async () => {
      view.ipc.emit('export-pdf', { ok: true, filePath: '/tmp/out.pdf' });
    });

    expect(screen.getByText('PDF exported')).toBeInTheDocument();
  });
});

describe('practice mode', () => {
  it('offers speed and loop controls instead of scoring', async () => {
    const view = setupSongView({ route: '/song-1?gameMode=practice' });

    await view.loadSong();

    expect(screen.getByText('Speed:')).toBeInTheDocument();
    expect(screen.getByText('Loop:')).toBeInTheDocument();
  });

  it('shows no speed or loop controls when performing', async () => {
    const view = setupSongView();

    await view.loadSong();

    expect(screen.queryByText('Speed:')).toBeNull();
    expect(screen.queryByText('Loop:')).toBeNull();
  });

  it('moves the measure focus with the mapped navigation keys', async () => {
    const view = setupSongView({
      route: '/song-1?gameMode=practice',
      keyboard: {
        controls: { right: ['keyboard:ArrowRight'] },
      },
    });

    await view.loadSong();

    expect(
      view.measureHighlights().some((el) => el.hasAttribute('data-focused')),
    ).toBe(false);

    await view.pressKey('ArrowRight');

    expect(
      view.measureHighlights().some((el) => el.hasAttribute('data-focused')),
    ).toBe(true);
  });
});

describe('the stem mixer', () => {
  it('shows a volume control for each stem in the mix', async () => {
    const view = setupSongView();

    await view.loadSong(makeSong(MULTI_STEM));
    view.openSettings();

    await waitFor(() => {
      expect(screen.getByText('drums')).toBeInTheDocument();
    });
    expect(screen.getByText('guitar')).toBeInTheDocument();
  });

  it('soloing a stem silences the others at the audio boundary', async () => {
    const view = setupSongView();

    await view.loadSong(makeSong(MULTI_STEM));
    view.openSettings();

    await waitFor(() => {
      expect(screen.getByText('drums')).toBeInTheDocument();
    });

    const silentBefore = view.mutedGainCount();

    fireEvent.click(view.mixerControls('drums').solo);

    expect(view.mutedGainCount()).toBeGreaterThan(silentBefore);
    expect(view.mixerControls('guitar').mute.className).toContain(
      'ant-btn-primary',
    );
  });

  it('muting then unmuting a stem restores its previous level', async () => {
    const view = setupSongView();

    await view.loadSong(makeSong(MULTI_STEM));
    view.openSettings();

    await waitFor(() => {
      expect(screen.getByText('drums')).toBeInTheDocument();
    });

    const silentBefore = view.mutedGainCount();

    fireEvent.click(view.mixerControls('drums').mute);
    expect(view.mixerControls('drums').mute.className).toContain(
      'ant-btn-primary',
    );
    expect(view.mutedGainCount()).toBeGreaterThan(silentBefore);

    fireEvent.click(view.mixerControls('drums').mute);
    expect(view.mixerControls('drums').mute.className).not.toContain(
      'ant-btn-primary',
    );
    expect(view.mutedGainCount()).toBe(silentBefore);
  });

  it('mutes and unmutes the master output', async () => {
    const view = setupSongView();

    await view.loadSong(makeSong(MULTI_STEM));
    view.openSettings();

    await waitFor(() => {
      expect(screen.getByText('Master')).toBeInTheDocument();
    });

    const silentBefore = view.mutedGainCount();

    fireEvent.click(view.masterMuteButton());
    expect(view.masterMuteButton().className).toContain('ant-btn-primary');
    expect(view.mutedGainCount()).toBeGreaterThan(silentBefore);

    fireEvent.click(view.masterMuteButton());
    expect(view.masterMuteButton().className).not.toContain('ant-btn-primary');
    expect(view.mutedGainCount()).toBe(silentBefore);
  });
});

describe('the score summary', () => {
  it('reports the accuracy and note counts of a run', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: { kit: { snare: ['keyboard:KeyJ'] } },
    });

    await view.loadSong();

    view.clickPlay();
    await view.pressKey('KeyJ');
    await view.finishSong();

    const modal = screen.getByTestId('score-modal');

    expect(within(modal).getByText('13% accuracy')).toBeInTheDocument();
    expect(within(modal).getByText('8 notes hit')).toBeInTheDocument();
    expect(within(modal).getByText('0 false hits')).toBeInTheDocument();
  });

  it('celebrates a flawless run with Perfect and five stars', async () => {
    const view = setupSongView({
      settings: { countIn: false },
      keyboard: { kit: { snare: ['keyboard:KeyJ'] } },
    });

    await view.loadSong(makeSong(), SINGLE_NOTE_CHART);

    view.clickPlay();
    await view.pressKey('KeyJ');
    await view.finishSong();

    const modal = screen.getByTestId('score-modal');

    expect(within(modal).getByText('Perfect')).toBeInTheDocument();
    expect(
      modal.querySelectorAll('svg[data-prefix="fas"][data-icon="star"]'),
    ).toHaveLength(5);
  });
});

describe('the playback time display', () => {
  it('reflects a seek in the elapsed-time readout', async () => {
    const view = setupSongView({ route: '/song-1?gameMode=practice' });

    await view.loadSong();

    expect(view.currentTimeText()).toBe('00:00');

    view.seekToEnd();

    await waitFor(() => {
      expect(view.currentTimeText()).toBe('00:04');
    });
  });
});

describe('the reference legend', () => {
  it('shows the drum reference and hides it when switched off', async () => {
    const view = setupSongView();

    await view.loadSong();

    expect(screen.getByText('Snare')).toBeInTheDocument();
    expect(screen.getByText('Kick')).toBeInTheDocument();

    view.openSettings();
    view.openMoreSettings();
    view.toggleSetting('reference');

    await waitFor(() => {
      expect(screen.queryByText('Snare')).not.toBeInTheDocument();
    });
  });
});
