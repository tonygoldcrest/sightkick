import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Stave, StaveNote } from 'vexflow';
import { TrackConfig } from '../audio-player';
import {
  Measure,
  Note,
  ParsedChart,
  RenderData,
  RenderedNote,
} from '../../../chart-parser/types';
import { InputEvent } from '../../input/types';
import { Engine } from './engine';
import { EngineContext } from './types';

vi.mock('../click-track/metronome', () => ({
  renderClickBuffers: vi.fn(() => ({ downbeat: {}, beat: {} })),
}));

const { MockAudioPlayer } = vi.hoisted(() => {
  const fakeContext = () => ({
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: () => {},
        cancelScheduledValues: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    }),
    createBufferSource: () => ({
      buffer: undefined,
      connect: () => {},
      start: () => {},
      stop: () => {},
      addEventListener: () => {},
    }),
  });

  class MockAudioPlayerImpl {
    static instances: MockAudioPlayerImpl[] = [];
    onEnded: () => void;
    ready = Promise.resolve([]);
    context = fakeContext();
    audioTracks: { name: string; setVolume: () => void }[] = [];
    currentTime = 0;
    duration = 100;
    isInitialised = false;
    startedAt = -1;
    offset = 0;
    start = vi.fn((offset = 0, startAt?: number) => {
      this.isInitialised = true;
      this.offset = offset;
      this.startedAt = startAt ?? this.context.currentTime;
      this.currentTime = offset;
    });
    pause = vi.fn();
    stop = vi.fn();
    setMasterVolume = vi.fn();
    setPlaybackSpeed = vi.fn();
    destroy = vi.fn();

    contextTimeForSongTime(songTime: number) {
      return this.startedAt < 0
        ? this.context.currentTime
        : this.startedAt + (songTime - this.offset);
    }

    constructor(_trackData: unknown, onEnded: () => void) {
      this.onEnded = onEnded;
      MockAudioPlayerImpl.instances.push(this);
    }
  }

  return { MockAudioPlayer: MockAudioPlayerImpl };
});

vi.mock('../audio-player/factories', () => ({
  playerFactoryForMode: () => (trackData: unknown, onEnded: () => void) =>
    new MockAudioPlayer(trackData, onEnded),
}));

type MockPlayer = {
  onEnded: () => void;
  context: { currentTime: number };
  currentTime: number;
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  setMasterVolume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const TRACKS: TrackConfig[] = [{ name: 'drums', urls: ['d.ogg'] }];
const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
} as unknown as ParsedChart;

function svgEl(): SVGElement {
  return document.createElementNS(
    'http://www.w3.org/2000/svg',
    'path',
  ) as SVGElement;
}

function staveNote(keys: string[], isRest = false): StaveNote {
  const noteHeads = keys.map(() => {
    const el = svgEl();

    el.style.fill = '';

    return { getSVGElement: () => el };
  });

  return {
    isRest: () => isRest,
    getKeys: () => keys,
    getAbsoluteX: () => 0,
    noteHeads,
  } as unknown as StaveNote;
}

function fakeStave(): Stave {
  return {
    getX: () => 0,
    getY: () => 10,
    getWidth: () => 100,
    getHeight: () => 40,
  } as unknown as Stave;
}

function rendered(tick: number, note: StaveNote): RenderedNote {
  return { tick, note };
}

function measureData(
  startTick: number,
  endTick: number,
  notes: RenderedNote[],
  modelNotes: Note[] = [],
): RenderData {
  return {
    stave: fakeStave(),
    measure: {
      startTick,
      endTick,
      notes: modelNotes,
      timeSig: [4, 4],
    } as unknown as Measure,
    renderedNotes: notes,
    yOffset: 0,
  };
}

function hasClass(note: StaveNote, cls: string, head = 0): boolean {
  return (
    note.noteHeads[head].getSVGElement() as SVGElement
  ).classList.contains(cls);
}

function uncolored(note: StaveNote, head = 0): boolean {
  return (
    !hasClass(note, 'vf-note-hit', head) &&
    !hasClass(note, 'vf-note-missed', head)
  );
}

function getPlayerInstances(): MockPlayer[] {
  return MockAudioPlayer.instances as unknown as MockPlayer[];
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

let inputListeners: Set<(event: InputEvent) => void>;

function emitInput(controlId: string, value = 100) {
  inputListeners.forEach((listener) => listener({ controlId, value }));
}

async function setup(over: Partial<EngineContext> = {}) {
  const onEnded = vi.fn();
  const onError = vi.fn();
  const engine = new Engine({
    trackData: TRACKS,
    isDev: false,
    subscribeInput: (listener) => {
      inputListeners.add(listener);

      return () => {
        inputListeners.delete(listener);
      };
    },
    onEnded,
    onError,
  });
  const renderData = over.renderData ?? [];

  engine.setSettings({ playheadStyle: 'Cursor' });
  engine.setContext({
    chart: CHART,
    measures: renderData.map((rd) => rd.measure),
    renderData,
    delaySeconds: 0,
    minDurationSeconds: 0,
    countInEnabled: false,
    ...over,
  });

  await flush();

  const [player] = getPlayerInstances();

  return { engine, onEnded, player };
}

let frameQueue: FrameRequestCallback[] = [];

function flushFrame() {
  const callbacks = frameQueue;

  frameQueue = [];
  callbacks.forEach((cb) => cb(0));
}

function advanceClockTo(
  player: { context: { currentTime: number } },
  t: number,
) {
  player.context.currentTime = t;
  flushFrame();
}

beforeEach(() => {
  inputListeners = new Set();
  frameQueue = [];
  MockAudioPlayer.instances.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameQueue.push(cb);

    return frameQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Engine', () => {
  it('delegates transport to playback and reflects state', async () => {
    const { engine, player } = await setup({
      renderData: [measureData(0, 1920, [])],
    });

    engine.playFromTick(0);

    expect(player.start).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it('forwards master volume changes to the player', async () => {
    const { engine, player } = await setup({
      renderData: [measureData(0, 1920, [])],
    });

    engine.setMasterVolume(0.6);

    expect(player.setMasterVolume).toHaveBeenCalledWith(0.6);
  });

  it('forwards the score on ended, counting only non-rest model notes', async () => {
    const { onEnded, player } = await setup({
      renderData: [
        measureData(
          0,
          1920,
          [],
          [
            { isRest: false, notes: ['c/5', 'g/5'] } as Note,
            { isRest: true, notes: ['x'] } as Note,
            { isRest: false, notes: ['f/4'] } as Note,
          ],
        ),
      ],
    });

    player.onEnded();

    expect(onEnded).toHaveBeenCalledWith({
      hitNotes: 0,
      falseHits: 0,
      totalNotes: 3,
    });
  });

  it('positions the cursor element from the current time', async () => {
    const note = staveNote(['c/5'], true);
    const { engine } = await setup({
      renderData: [measureData(0, 1920, [rendered(0, note)])],
    });
    const cursorEl = document.createElement('div');

    engine.setRendererRefs({ cursorEl, highlightEls: [] });
    engine.timeStore.set(1);

    expect(cursorEl.style.display).toBe('');
    expect(cursorEl.style.transform).toBe(
      'translate3d(50px, 10px, 0) translateX(-50%)',
    );
    expect(cursorEl.style.height).toBe('70px');
  });

  it('hides the cursor when the playhead style is not Cursor', async () => {
    const note = staveNote(['c/5'], true);
    const { engine } = await setup({
      renderData: [measureData(0, 1920, [rendered(0, note)])],
    });

    engine.setSettings({ playheadStyle: 'Measure' });

    const cursorEl = document.createElement('div');

    engine.setRendererRefs({ cursorEl, highlightEls: [] });
    engine.timeStore.set(1);

    expect(cursorEl.style.display).toBe('none');
  });

  it('toggles the active measure highlight in Measure mode', async () => {
    const { engine } = await setup({
      renderData: [
        measureData(0, 1920, [rendered(0, staveNote(['c/5'], true))]),
        measureData(1920, 3840, [rendered(1920, staveNote(['c/5'], true))]),
      ],
    });

    engine.setSettings({ playheadStyle: 'Measure' });

    const a = document.createElement('div');
    const b = document.createElement('div');

    engine.setRendererRefs({ cursorEl: undefined, highlightEls: [a, b] });
    engine.timeStore.set(2.1);

    expect(b.style.border).toContain('var(--color-accent-bright)');
    expect(b.style.backgroundColor).toBe('var(--color-accent-soft-bg)');
    expect(a.style.backgroundColor).toBe('');
  });

  it('progress-colours notes before the active note', async () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const n2 = staveNote(['e/5']);
    const { engine } = await setup({
      renderData: [
        measureData(0, 1920, [
          rendered(0, n0),
          rendered(240, n1),
          rendered(480, n2),
        ]),
      ],
    });

    engine.setSettings({ playheadStyle: 'Cursor' });
    engine.setRendererRefs({
      cursorEl: document.createElement('div'),
      highlightEls: [],
    });
    engine.timeStore.set(0.5);

    expect(hasClass(n0, 'vf-note-missed')).toBe(true);
    expect(hasClass(n1, 'vf-note-missed')).toBe(true);
    expect(uncolored(n2)).toBe(true);
  });

  it('registers an input hit and hides the struck note head', async () => {
    const note = staveNote(['c/5']);
    const { engine, onEnded, player } = await setup({
      renderData: [
        measureData(
          0,
          1920,
          [rendered(480, note)],
          [{ isRest: false, notes: ['c/5'] } as Note],
        ),
      ],
    });

    engine.setSettings({ playheadStyle: 'Cursor' });
    engine.setRendererRefs({
      cursorEl: document.createElement('div'),
      highlightEls: [],
    });
    engine.setMapping({ snare: ['midi:38'] });
    engine.seekSeconds(0.5);

    emitInput('midi:38');

    expect(hasClass(note, 'vf-note-hit')).toBe(true);

    player.onEnded();
    expect(onEnded).toHaveBeenCalledWith(
      expect.objectContaining({ hitNotes: 1, falseHits: 0 }),
    );
  });

  it('prunes a false hit made ahead of a seek when seeking back', async () => {
    const note = staveNote(['c/5']);
    const { engine, onEnded, player } = await setup({
      renderData: [
        measureData(
          0,
          1920,
          [rendered(480, note)],
          [{ isRest: false, notes: ['c/5'] } as Note],
        ),
      ],
    });

    engine.setMapping({ crash: ['midi:49'] });
    engine.seekSeconds(0.5);
    emitInput('midi:49');
    engine.seekSeconds(0.1);

    player.onEnded();
    expect(onEnded).toHaveBeenCalledWith(
      expect.objectContaining({ falseHits: 0 }),
    );
  });

  it('does not register input hits before playback starts', async () => {
    const note = staveNote(['c/5']);
    const { engine } = await setup({
      renderData: [measureData(0, 1920, [rendered(480, note)])],
    });

    engine.setSettings({ playheadStyle: 'Cursor' });
    engine.setMapping({ snare: ['midi:38'] });
    engine.timeStore.set(1);

    emitInput('midi:38');

    expect(uncolored(note)).toBe(true);
  });

  it('does not score input during the count-in, only once playing', async () => {
    const note = staveNote(['c/5']);
    const { engine, player } = await setup({
      renderData: [
        measureData(
          0,
          1920,
          [rendered(480, note)],
          [{ isRest: false, notes: ['c/5'] } as Note],
        ),
      ],
      countInEnabled: true,
    });

    engine.setRendererRefs({
      cursorEl: document.createElement('div'),
      highlightEls: [],
    });
    engine.setMapping({ snare: ['midi:38'] });

    engine.playFromTick(0);
    engine.timeStore.set(0.5);
    emitInput('midi:38');

    expect(uncolored(note)).toBe(true);

    advanceClockTo(player, 5);
    flushFrame();
    engine.timeStore.set(0.5);
    emitInput('midi:38');

    expect(hasClass(note, 'vf-note-hit')).toBe(true);
  });

  it('stops scoring input after dispose', async () => {
    const { engine } = await setup();

    expect(inputListeners.size).toBe(1);

    engine.dispose();

    expect(inputListeners.size).toBe(0);
  });

  it('destroys the player on dispose', async () => {
    const { engine, player } = await setup();

    engine.dispose();

    expect(player.destroy).toHaveBeenCalledTimes(1);
  });
});
