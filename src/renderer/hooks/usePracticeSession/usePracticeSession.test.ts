import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { Engine } from '../../services/engine';
import { MODE_POLICIES } from '../../modes';
import { usePracticeSession } from './usePracticeSession';

type Props = Parameters<typeof usePracticeSession>[0];

function makeRenderData(rowSizes: number[]): RenderData[] {
  const data: Partial<RenderData>[] = [];
  let yOffset = 0;

  rowSizes.forEach((size) => {
    for (let i = 0; i < size; i += 1) {
      const startTick = data.length * 100;

      data.push({
        yOffset,
        measure: {
          startTick,
          endTick: startTick + 100,
        } as RenderData['measure'],
      });
    }

    yOffset += 100;
  });

  return data as RenderData[];
}

const RENDER_DATA = makeRenderData([3, 3]);
const CHART = {
  resolution: 100,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
} as unknown as ParsedChart;

interface SetupOptions {
  policy?: Props['policy'];
  delaySeconds?: number;
  isEnded?: boolean;
  playheadSeconds?: number;
  isPlaying?: boolean;
  isCounting?: boolean;
}

function setup(options: SetupOptions = {}) {
  const snapshot = {
    isPlaying: options.isPlaying ?? false,
    isCounting: options.isCounting ?? false,
  };
  const engine = {
    getSnapshot: vi.fn(() => snapshot),
    timeStore: { get: vi.fn(() => options.playheadSeconds ?? 0) },
    play: vi.fn(),
    playFromTick: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    setPlaybackSpeed: vi.fn(),
    seekSeconds: vi.fn(),
    setLoopRegion: vi.fn(),
  };
  const onExit = vi.fn();
  const props: Props = {
    engine: engine as unknown as Engine,
    policy: options.policy ?? MODE_POLICIES.practice,
    chart: CHART,
    renderData: RENDER_DATA,
    delaySeconds: options.delaySeconds ?? 0,
    isEnded: options.isEnded ?? false,
    onExit,
  };
  const { result } = renderHook(() => usePracticeSession(props));
  const press = (key: keyof typeof result.current.controlHandlers) =>
    act(() => result.current.controlHandlers[key]?.());
  const setLooping = (value: boolean) =>
    act(() => result.current.setIsLooping(value));

  return { result, press, setLooping, engine, onExit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePracticeSession navigation', () => {
  it('reveals the measure under the playhead on the first arrow', () => {
    const { result, press } = setup({ playheadSeconds: 1.25 });

    press('right');

    expect(result.current.focusIndex).toBe(2);
  });

  it('moves the focus on subsequent arrows', () => {
    const { result, press } = setup();

    press('right');
    press('right');

    expect(result.current.focusIndex).toBe(1);
  });
});

describe('usePracticeSession confirm', () => {
  it('starts the song when nothing is highlighted', () => {
    const { press, engine } = setup();

    press('confirm');

    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('plays from the focused measure when not looping', () => {
    const { press, setLooping, engine } = setup();

    setLooping(false);
    press('right');
    press('confirm');

    expect(engine.playFromTick).toHaveBeenCalledWith(0);
  });

  it('locks the loop start, then extends the end while selecting', () => {
    const { result, press } = setup();

    press('right');
    press('confirm');

    expect(result.current.practiceRange).toEqual({ start: 0, end: 0 });

    press('down');

    expect(result.current.focusIndex).toBe(3);
    expect(result.current.practiceRange).toEqual({ start: 0, end: 3 });
  });

  it('starts loop playback on the second confirm and clears the cursor', () => {
    const { result, press, engine } = setup();

    press('right');
    press('confirm');
    press('confirm');

    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(result.current.focusIndex).toBeUndefined();
  });
});

describe('usePracticeSession back', () => {
  it('exits when nothing is selected', () => {
    const { press, onExit } = setup();

    press('back');

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('clears the selection in one step without exiting', () => {
    const { result, press, onExit } = setup();

    press('right');
    press('confirm');
    press('back');

    expect(result.current.practiceRange).toBeUndefined();
    expect(result.current.focusIndex).toBeUndefined();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('usePracticeSession with looping off', () => {
  it('navigates without touching the stored loop', () => {
    const { result, press, setLooping } = setup();

    setLooping(false);
    act(() => result.current.onPracticeRangeChange({ start: 2, end: 4 }));

    press('right');
    press('right');

    expect(result.current.focusIndex).toBe(1);
    expect(result.current.practiceRange).toEqual({ start: 2, end: 4 });
  });

  it('clears focus but keeps the loop on back', () => {
    const { result, press, setLooping, onExit } = setup();

    setLooping(false);
    act(() => result.current.onPracticeRangeChange({ start: 2, end: 4 }));

    press('right');
    press('back');

    expect(result.current.focusIndex).toBeUndefined();
    expect(result.current.practiceRange).toEqual({ start: 2, end: 4 });
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('usePracticeSession playback', () => {
  it('navigates and seeks the same while playing (blocking is handled upstream)', () => {
    const { result, press, setLooping, engine } = setup({ isPlaying: true });

    setLooping(false);
    press('right');

    expect(result.current.focusIndex).toBe(0);

    press('confirm');

    expect(engine.playFromTick).toHaveBeenCalledWith(0);
  });

  it('pauses while playing and cancels the count-in while counting', () => {
    const playing = setup({ isPlaying: true });

    playing.press('pause');

    expect(playing.engine.pause).toHaveBeenCalledTimes(1);

    const counting = setup({ isCounting: true });

    counting.press('pause');

    expect(counting.engine.cancel).toHaveBeenCalledTimes(1);
  });

  it('adjusts and clamps speed', () => {
    const { result, press } = setup();

    press('faster');

    expect(result.current.playbackSpeed).toBeCloseTo(1.1);

    for (let i = 0; i < 20; i += 1) {
      press('faster');
    }

    expect(result.current.playbackSpeed).toBe(2);

    for (let i = 0; i < 30; i += 1) {
      press('slower');
    }

    expect(result.current.playbackSpeed).toBe(0.3);
  });
});

describe('usePracticeSession effects', () => {
  it('forwards the speed to the engine when it changes', () => {
    const { press, engine } = setup();

    press('faster');

    expect(engine.setPlaybackSpeed).toHaveBeenLastCalledWith(1.1);
  });

  it('sets the full loop region on mount', () => {
    const { engine } = setup();

    expect(engine.setLoopRegion).toHaveBeenLastCalledWith({
      startTick: 0,
      endTick: 600,
    });
  });

  it('narrows the loop region to the selected range', () => {
    const { result, engine } = setup();

    act(() => result.current.onPracticeRangeChange({ start: 1, end: 2 }));

    expect(engine.setLoopRegion).toHaveBeenLastCalledWith({
      startTick: 100,
      endTick: 300,
    });
  });

  it('clears the loop region when looping is turned off', () => {
    const { setLooping, engine } = setup();

    setLooping(false);

    expect(engine.setLoopRegion).toHaveBeenLastCalledWith(undefined);
  });

  it('parks at the start when the song ends', () => {
    const { engine } = setup({ isEnded: true, delaySeconds: 0.5 });

    expect(engine.seekSeconds).toHaveBeenCalledWith(0.5);
  });
});

describe('usePracticeSession in perform mode', () => {
  it('leaves speed and seek untouched and never sets a loop region', () => {
    const { engine } = setup({
      policy: MODE_POLICIES.perform,
      isEnded: true,
      delaySeconds: 0.5,
    });

    expect(engine.setPlaybackSpeed).not.toHaveBeenCalled();
    expect(engine.seekSeconds).not.toHaveBeenCalled();
    expect(engine.setLoopRegion).toHaveBeenLastCalledWith(undefined);
  });
});
