import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { Engine } from '../../services/engine';
import { usePracticeNav } from './usePracticeNav';

type Props = Parameters<typeof usePracticeNav>[0];

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
  isLooping?: boolean;
  practiceRange?: Props['practiceRange'];
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
  };
  const setPracticeRange = vi.fn();
  const setPlaybackSpeed = vi.fn();
  const onExit = vi.fn();
  const props: Props = {
    engine: engine as unknown as Engine,
    chart: CHART,
    renderData: RENDER_DATA,
    delaySeconds: 0,
    isLooping: options.isLooping ?? true,
    practiceRange: options.practiceRange,
    setPracticeRange,
    setPlaybackSpeed,
    onExit,
  };
  const { result } = renderHook(() => usePracticeNav(props));
  const press = (key: keyof typeof result.current.controlHandlers) =>
    act(() => result.current.controlHandlers[key]?.());

  return { result, press, engine, setPracticeRange, setPlaybackSpeed, onExit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePracticeNav navigation', () => {
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

describe('usePracticeNav confirm', () => {
  it('starts the song when nothing is highlighted', () => {
    const { press, engine } = setup();

    press('confirm');

    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('plays from the focused measure when not looping', () => {
    const { press, engine } = setup({ isLooping: false });

    press('right');
    press('confirm');

    expect(engine.playFromTick).toHaveBeenCalledWith(0);
  });

  it('locks the loop start, then extends the end while selecting', () => {
    const { result, press, setPracticeRange } = setup();

    press('right');
    press('confirm');

    expect(setPracticeRange).toHaveBeenLastCalledWith({ start: 0, end: 0 });

    press('down');

    expect(result.current.focusIndex).toBe(3);
    expect(setPracticeRange).toHaveBeenLastCalledWith({ start: 0, end: 3 });
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

describe('usePracticeNav back', () => {
  it('exits when nothing is selected', () => {
    const { press, onExit } = setup();

    press('back');

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('clears the selection in one step without exiting', () => {
    const { result, press, setPracticeRange, onExit } = setup();

    press('right');
    press('confirm');
    press('back');

    expect(setPracticeRange).toHaveBeenLastCalledWith(undefined);
    expect(result.current.focusIndex).toBeUndefined();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('usePracticeNav with looping off', () => {
  it('navigates without touching the stored loop', () => {
    const { result, press, setPracticeRange } = setup({
      isLooping: false,
      practiceRange: { start: 2, end: 4 },
    });

    press('right');
    press('right');

    expect(result.current.focusIndex).toBe(1);
    expect(setPracticeRange).not.toHaveBeenCalled();
  });

  it('clears focus but keeps the loop on back', () => {
    const { result, press, setPracticeRange, onExit } = setup({
      isLooping: false,
      practiceRange: { start: 2, end: 4 },
    });

    press('right');
    press('back');

    expect(result.current.focusIndex).toBeUndefined();
    expect(setPracticeRange).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('usePracticeNav playback', () => {
  it('navigates and seeks the same while playing (blocking is handled upstream)', () => {
    const { result, press, engine } = setup({
      isLooping: false,
      isPlaying: true,
    });

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
    const { press, setPlaybackSpeed } = setup();

    press('faster');

    expect(setPlaybackSpeed).toHaveBeenCalledTimes(1);

    const updater = setPlaybackSpeed.mock.calls[0][0] as (
      speed: number,
    ) => number;

    expect(updater(1)).toBeCloseTo(1.1);
    expect(updater(2)).toBe(2);
  });
});
