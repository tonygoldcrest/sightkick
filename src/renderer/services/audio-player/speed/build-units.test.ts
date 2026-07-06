import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUnits,
  scatterBlocks,
  StretchUnit,
  VoiceGroup,
} from './build-units';

const detectOnsets = vi.hoisted(() => vi.fn(() => [10, 20]));

vi.mock('./onset-detection', () => ({ detectOnsets }));

const stretcherArgs = vi.hoisted(
  () => [] as { input: Float32Array; speed: number; onsets: number[] }[],
);

vi.mock('./channel-stretcher', () => ({
  ChannelStretcher: vi.fn(function (
    this: unknown,
    input: Float32Array,
    speed: number,
    onsets: number[],
  ) {
    stretcherArgs.push({ input, speed, onsets });
    Object.assign(this as object, {
      seek: vi.fn(),
      produce: vi.fn(() => input),
    });
  }),
}));

afterEach(() => {
  detectOnsets.mockClear();
  stretcherArgs.length = 0;
});

const channels = [
  new Float32Array([1, 1]),
  new Float32Array([2, 2]),
  new Float32Array([3, 3]),
];

describe('buildUnits', () => {
  it('computes onsets only for transient groups and leaves vocoder groups empty', () => {
    const groups: VoiceGroup[] = [
      { start: 0, count: 1, kind: 'transient' },
      { start: 1, count: 1, kind: 'vocoder' },
    ];
    const cache: (number[] | undefined)[] = new Array(2).fill(undefined);

    buildUnits(channels, groups, 1.5, 44100, cache);

    expect(detectOnsets).toHaveBeenCalledTimes(1);
    expect(stretcherArgs[0].onsets).toEqual([10, 20]);
    expect(stretcherArgs[0].speed).toBe(1.5);
    expect(stretcherArgs[1].onsets).toEqual([]);
    expect(cache[0]).toEqual([10, 20]);
    expect(cache[1]).toBeUndefined();
  });

  it('reuses cached onsets across rebuilds (e.g. speed changes)', () => {
    const groups: VoiceGroup[] = [{ start: 0, count: 1, kind: 'transient' }];
    const cache: (number[] | undefined)[] = new Array(1).fill(undefined);

    buildUnits(channels, groups, 1, 44100, cache);
    buildUnits(channels, groups, 2, 44100, cache);

    expect(detectOnsets).toHaveBeenCalledTimes(1);
  });

  it('creates one stretcher per channel in a multi-channel group', () => {
    const groups: VoiceGroup[] = [{ start: 0, count: 2, kind: 'vocoder' }];
    const units = buildUnits(channels, groups, 1, 44100, [undefined]);

    expect(stretcherArgs).toHaveLength(2);
    expect(units[0].channelIndices).toEqual([0, 1]);
  });
});

describe('scatterBlocks', () => {
  it('places each unit block at its channel index', () => {
    const a = new Float32Array([1]);
    const b = new Float32Array([2]);
    const units: StretchUnit[] = [
      { channelIndices: [2], seek: vi.fn(), produce: () => [a] },
      { channelIndices: [0], seek: vi.fn(), produce: () => [b] },
    ];
    const output = scatterBlocks(units, 3, 1);

    expect(output[0]).toBe(b);
    expect(output[2]).toBe(a);
    expect(output[1]).toBeUndefined();
  });
});
