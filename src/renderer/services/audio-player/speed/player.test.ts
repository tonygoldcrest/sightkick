import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  installFetchByByteLength,
  installWebAudio,
} from '../test-support';
import { SpeedAudioPlayer } from './player';
import { TrackConfig } from '../types';

const trimSpy = vi.hoisted(() => vi.fn((buffer: unknown) => buffer));

vi.mock('../helpers', () => ({ trimTrailingSilence: trimSpy }));

interface MockStream {
  channels: Float32Array[];
  init: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  produce: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const { streams } = vi.hoisted(() => ({ streams: [] as MockStream[] }));

vi.mock('./stretch-stream', () => {
  class StretchStream {
    channels: Float32Array[] = [];

    init = vi.fn((channels: Float32Array[]) => {
      this.channels = channels;
    });

    setSpeed = vi.fn();

    seek = vi.fn();

    produce = vi.fn((frames: number) =>
      Promise.resolve(this.channels.map(() => new Float32Array(frames * 512))),
    );

    destroy = vi.fn();

    constructor() {
      streams.push(this as unknown as MockStream);
    }
  }

  return { StretchStream };
});

let context: FakeAudioContext;
const TRACKS: TrackConfig[] = [{ name: 'drums', urls: ['d.ogg'] }];

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

async function makePlayer(onEnded = vi.fn()) {
  const player = new SpeedAudioPlayer(TRACKS, onEnded);

  await player.ready;
  await flush();

  return { player, onEnded, stream: streams[0] };
}

beforeEach(() => {
  streams.length = 0;
  context = installWebAudio();
  installFetchByByteLength(() => 100);
  trimSpy.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SpeedAudioPlayer', () => {
  it('initialises the stream with one voice per channel and the speed', async () => {
    const { stream } = await makePlayer();

    expect(stream.init).toHaveBeenCalledTimes(1);
    expect(stream.init.mock.calls[0][0]).toHaveLength(1);
    expect(stream.init.mock.calls[0][1]).toBe(1);
  });

  it('seeks to the output sample and schedules a first chunk on start', async () => {
    const { player, stream } = await makePlayer();

    await player.start(10);

    expect(stream.seek).toHaveBeenCalledWith(
      Math.round(10 * context.sampleRate),
    );
    expect(player.isInitialised).toBe(true);
    expect(context.bufferSources.length).toBeGreaterThan(0);
  });

  it('reports currentTime scaled by speed, floored at offset and capped at duration', async () => {
    const { player } = await makePlayer();

    player.setPlaybackSpeed(0.5);
    await flush();
    await player.start(4);

    context.currentTime = 10;
    expect(player.currentTime).toBeCloseTo(8.95, 5);

    context.currentTime = 0.05;
    expect(player.currentTime).toBe(4);

    context.currentTime = 1000;
    expect(player.currentTime).toBe(100);
  });

  it('sets the stream speed when changed while stopped', async () => {
    const { player, stream } = await makePlayer();

    stream.setSpeed.mockClear();
    player.setPlaybackSpeed(0.5);
    await flush();

    expect(stream.setSpeed).toHaveBeenCalledWith(0.5);
    expect(stream.seek).not.toHaveBeenCalled();
  });

  it('restarts from the current position when speed changes mid-playback', async () => {
    const { player, stream } = await makePlayer();

    await player.start(0);
    stream.seek.mockClear();
    stream.setSpeed.mockClear();

    player.setPlaybackSpeed(0.5);
    await flush();

    expect(stream.setSpeed).toHaveBeenCalledWith(0.5);
    expect(stream.seek).toHaveBeenCalled();
  });

  it('stops tracks and clears initialisation on stop', async () => {
    const { player } = await makePlayer();

    await player.start(0);
    player.stop();

    expect(player.isInitialised).toBe(false);
    context.bufferSources.forEach((source) =>
      expect(source.stopped).toBe(true),
    );
  });

  it('destroys the stream and closes the context on destroy', async () => {
    const { player, stream } = await makePlayer();

    player.destroy();

    expect(stream.destroy).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('fires onEnded once the whole song has been scheduled and played', async () => {
    installFetchByByteLength(() => 1);

    const onEnded = vi.fn();
    const { player } = await makePlayer(onEnded);

    player.setPlaybackSpeed(2);
    await flush();
    await player.start(0);

    context.currentTime = 5;
    await vi.advanceTimersByTimeAsync(150);

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(player.isInitialised).toBe(false);
  });
});
