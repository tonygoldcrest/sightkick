import { describe, expect, it } from 'vitest';
import { Measure, ParsedChart } from '../../../chart-parser/types';
import { beatCountFor, getBeatGrid, getCountInInfo } from './beat-grid';

const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
} as unknown as ParsedChart;

function measure(
  startTick: number,
  endTick: number,
  timeSig: [number, number],
  isCompound = false,
): Measure {
  return { startTick, endTick, timeSig, isCompound } as unknown as Measure;
}

describe('beat-grid', () => {
  it('counts simple meters by the numerator', () => {
    expect(beatCountFor(measure(0, 1920, [4, 4]))).toBe(4);
    expect(beatCountFor(measure(0, 1440, [3, 4]))).toBe(3);
    expect(beatCountFor(measure(0, 1680, [7, 8]))).toBe(7);
  });

  it('counts compound meters by the dotted beat', () => {
    expect(beatCountFor(measure(0, 1440, [6, 8], true))).toBe(2);
    expect(beatCountFor(measure(0, 2160, [9, 8], true))).toBe(3);
    expect(beatCountFor(measure(0, 2880, [12, 8], true))).toBe(4);
  });

  it('places a beat on every beat, accenting the downbeat', () => {
    const beats = getBeatGrid([measure(0, 1920, [4, 4])], CHART);

    expect(beats.map((b) => b.timeSeconds)).toEqual([
      expect.closeTo(0),
      expect.closeTo(0.5),
      expect.closeTo(1),
      expect.closeTo(1.5),
    ]);
    expect(beats.map((b) => b.isDownbeat)).toEqual([true, false, false, false]);
  });

  it('groups a compound 6/8 bar into two dotted beats', () => {
    const beats = getBeatGrid([measure(0, 1440, [6, 8], true)], CHART);

    expect(beats).toHaveLength(2);
    expect(beats[0].isDownbeat).toBe(true);
    expect(beats[1].isDownbeat).toBe(false);
    expect(beats[1].timeSeconds).toBeCloseTo(0.75);
  });

  it('spans consecutive measures', () => {
    const beats = getBeatGrid(
      [measure(0, 1920, [4, 4]), measure(1920, 3840, [4, 4])],
      CHART,
    );

    expect(beats).toHaveLength(8);
    expect(beats[4].isDownbeat).toBe(true);
    expect(beats[4].timeSeconds).toBeCloseTo(2);
  });

  it('does not emit duplicate or backwards beats across an overlapping mid-measure time-signature change', () => {
    const beats = getBeatGrid(
      [measure(0, 3360, [7, 4]), measure(960, 2160, [5, 8])],
      CHART,
    );
    const times = beats.map((b) => b.timeSeconds);

    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }

    expect(times.filter((t) => Math.abs(t - 1) < 1e-6)).toHaveLength(1);
    expect(beats.filter((b) => b.isDownbeat)).toHaveLength(2);
  });

  it('derives the count-in from the starting measure', () => {
    const info = getCountInInfo(0, [measure(0, 1920, [4, 4])], CHART);

    expect(info.beats).toBe(4);
    expect(info.beatDurationSeconds).toBeCloseTo(0.5);
  });

  it('derives a compound count-in at the dotted-beat tempo', () => {
    const info = getCountInInfo(0, [measure(0, 1440, [6, 8], true)], CHART);

    expect(info.beats).toBe(2);
    expect(info.beatDurationSeconds).toBeCloseTo(0.75);
  });
});
