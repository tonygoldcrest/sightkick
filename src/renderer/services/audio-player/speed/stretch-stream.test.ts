import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StretchStream } from './stretch-stream';
import { VoiceGroup } from './build-units';

const unit = vi.hoisted(() => ({
  channelIndices: [0],
  seek: vi.fn(),
  produce: vi.fn(() => [new Float32Array([9])]),
}));
const buildUnits = vi.hoisted(() =>
  vi.fn(
    (
      _channels: Float32Array[],
      _groups: unknown[],
      _speed: number,
      _sampleRate: number,
    ) => [unit],
  ),
);
const scatterBlocks = vi.hoisted(() => vi.fn(() => [new Float32Array([7])]));

vi.mock('./build-units', () => ({ buildUnits, scatterBlocks }));

const GROUPS: VoiceGroup[] = [{ start: 0, count: 1, kind: 'transient' }];
const CHANNELS = [new Float32Array([1, 2])];

beforeEach(() => {
  vi.stubGlobal('Worker', undefined);
  buildUnits.mockClear();
  scatterBlocks.mockClear();
  unit.seek.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StretchStream (worker-less fallback)', () => {
  it('builds units on init', () => {
    const stream = new StretchStream();

    stream.init(CHANNELS, 1.5, GROUPS, 48000);

    expect(buildUnits).toHaveBeenCalledTimes(1);
    expect(buildUnits.mock.calls[0][2]).toBe(1.5);
    expect(buildUnits.mock.calls[0][3]).toBe(48000);
  });

  it('rebuilds units on a speed change', () => {
    const stream = new StretchStream();

    stream.init(CHANNELS, 1, GROUPS, 48000);
    buildUnits.mockClear();

    stream.setSpeed(2);

    expect(buildUnits).toHaveBeenCalledTimes(1);
    expect(buildUnits.mock.calls[0][2]).toBe(2);
  });

  it('forwards seek to each unit', () => {
    const stream = new StretchStream();

    stream.init(CHANNELS, 1, GROUPS, 48000);

    stream.seek(1024);

    expect(unit.seek).toHaveBeenCalledWith(1024);
  });

  it('produces scattered blocks', async () => {
    const stream = new StretchStream();

    stream.init(CHANNELS, 1, GROUPS, 48000);

    const blocks = await stream.produce(4);

    expect(scatterBlocks).toHaveBeenCalledWith([unit], 1, 4);
    expect(blocks).toEqual([new Float32Array([7])]);
  });

  it('stops forwarding seeks after destroy', () => {
    const stream = new StretchStream();

    stream.init(CHANNELS, 1, GROUPS, 48000);
    stream.destroy();
    unit.seek.mockClear();

    stream.seek(512);

    expect(unit.seek).not.toHaveBeenCalled();
  });

  it('settles pending produce promises with no blocks on destroy', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((_event: MessageEvent) => void) | undefined;
        postMessage(_msg: unknown) {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
      },
    );

    const stream = new StretchStream();

    stream.init(CHANNELS, 1.5, GROUPS, 48000);

    const producePromise = stream.produce(4);

    stream.destroy();

    await expect(producePromise).resolves.toEqual([]);
  });
});
