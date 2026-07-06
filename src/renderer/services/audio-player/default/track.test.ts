import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultAudioTrack } from './track';
import {
  FakeAudioContext,
  FakeBufferSource,
  FakeGainNode,
  makeBuffer,
} from '../test-support';

let context: FakeAudioContext;

function makeTrack(durations: number[] = [1]) {
  const buffers = durations.map((seconds) =>
    makeBuffer([new Array(seconds * 100).fill(0)], 100),
  );

  return new DefaultAudioTrack(
    buffers as unknown as AudioBuffer[],
    'drums',
    context as unknown as AudioContext,
  );
}

beforeEach(() => {
  context = new FakeAudioContext();
});

describe('AudioTrack', () => {
  it('creates one destination-connected gain node per buffer', () => {
    makeTrack([1, 1]);

    expect(context.gainNodes).toHaveLength(2);
    context.gainNodes.forEach((node) =>
      expect(node.connectedTo).toContain(context.destination),
    );
  });

  it('routes its gain nodes to a provided destination node', () => {
    const destination = context.createGain();
    const buffers = [makeBuffer([new Array(100).fill(0)], 100)];

    new DefaultAudioTrack(
      buffers as unknown as AudioBuffer[],
      'drums',
      context as unknown as AudioContext,
      destination as unknown as AudioNode,
    );

    const trackGain = context.gainNodes.at(-1) as FakeGainNode;

    expect(trackGain.connectedTo).toContain(destination);
    expect(trackGain.connectedTo).not.toContain(context.destination);
  });

  it('reports the longest buffer as its duration', () => {
    const track = makeTrack([1, 3, 2]);

    expect(track.duration).toBe(3);
  });

  it('sets every gain node when the volume changes', () => {
    const track = makeTrack([1, 1]);

    context.currentTime = 4.2;
    track.setVolume(0.5);

    context.gainNodes.forEach((node) => {
      expect(node.gain.value).toBe(0.5);
      expect(node.gain.calls.at(-1)).toEqual({ value: 0.5, time: 4.2 });
    });
  });

  it('starts a source per buffer wired to its gain node', () => {
    const track = makeTrack([1, 1]);

    track.start(2, 0.5);

    expect(context.bufferSources).toHaveLength(2);
    context.bufferSources.forEach((source, index) => {
      expect(source.starts).toEqual([{ at: 2, offset: 0.5 }]);
      expect(source.connectedTo).toBe(context.gainNodes[index]);
    });
  });

  it('stops the previous sources when started again', () => {
    const track = makeTrack([1]);

    track.start(0, 0);

    const [first] = context.bufferSources;

    track.start(1, 0);

    expect(first.stopped).toBe(true);
    expect(context.bufferSources).toHaveLength(2);
  });

  it('marks ended and notifies only after the last source ends', () => {
    const track = makeTrack([1, 1]);
    const onEnded = vi.fn();

    track.endedListener = onEnded;
    track.start(0, 0);

    const sources = context.bufferSources as unknown as FakeBufferSource[];

    sources[0].emitEnded();
    expect(track.ended).toBe(false);
    expect(onEnded).not.toHaveBeenCalled();

    sources[1].emitEnded();
    expect(track.ended).toBe(true);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('disconnects gain nodes and clears the listener on destroy', () => {
    const track = makeTrack([1]);

    track.start(0, 0);
    track.endedListener = vi.fn();
    track.destroy();

    (context.gainNodes as unknown as FakeGainNode[]).forEach((node) =>
      expect(node.disconnected).toBe(true),
    );
    expect(track.endedListener).toBeNull();
  });
});
