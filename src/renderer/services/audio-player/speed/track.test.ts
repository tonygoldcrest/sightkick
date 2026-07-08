import { beforeEach, describe, expect, it } from 'vitest';
import { FakeAudioContext, installWebAudio, makeBuffer } from '../test-support';
import { SpeedAudioTrack } from './track';

let context: FakeAudioContext;

function makeTrack(buffers = [makeBuffer([[1, 2, 3]])]) {
  return new SpeedAudioTrack(
    buffers as unknown as AudioBuffer[],
    'drums',
    context as unknown as AudioContext,
  );
}

beforeEach(() => {
  context = installWebAudio();
});

describe('SpeedAudioTrack', () => {
  it('creates one gain node per buffer wired to the destination', () => {
    makeTrack([makeBuffer([[1]]), makeBuffer([[2]])]);

    expect(context.gainNodes).toHaveLength(2);
    context.gainNodes.forEach((node) =>
      expect(node.connectedTo).toContain(context.destination),
    );
  });

  it('sets the volume on every gain node', () => {
    const track = makeTrack([makeBuffer([[1]]), makeBuffer([[2]])]);

    track.setVolume(0.4);

    expect(track.volume).toBe(0.4);
    context.gainNodes.forEach((node) => expect(node.gain.value).toBe(0.4));
  });

  it('schedules a chunk on the file gain node at the given time', () => {
    const track = makeTrack([makeBuffer([[1]]), makeBuffer([[2]])]);
    const buffer = makeBuffer([[9]]);

    track.scheduleChunk(1, buffer as unknown as AudioBuffer, 3);

    const [source] = context.bufferSources;

    expect(source.buffer).toBe(buffer);
    expect(source.connectedTo).toBe(context.gainNodes[1]);
    expect(source.starts.at(-1)).toEqual({ at: 3, offset: undefined });
  });

  it('stops and disconnects scheduled sources on stop', () => {
    const track = makeTrack();

    track.scheduleChunk(0, makeBuffer([[1]]) as unknown as AudioBuffer, 0);
    track.scheduleChunk(0, makeBuffer([[1]]) as unknown as AudioBuffer, 1);
    track.stop();

    context.bufferSources.forEach((source) => {
      expect(source.stopped).toBe(true);
      expect(source.disconnected).toBe(true);
    });
  });

  it('drops a chunk that finishes on its own', () => {
    const track = makeTrack();

    track.scheduleChunk(0, makeBuffer([[1]]) as unknown as AudioBuffer, 0);

    const [source] = context.bufferSources;

    source.emitEnded();

    expect(source.disconnected).toBe(true);
  });

  it('removes the ended listener on stop so a pending ended event cannot corrupt later sources', () => {
    const track = makeTrack();

    track.scheduleChunk(0, makeBuffer([[1]]) as unknown as AudioBuffer, 0);

    const [first] = context.bufferSources;

    track.stop();

    track.scheduleChunk(0, makeBuffer([[1]]) as unknown as AudioBuffer, 1);

    const second = context.bufferSources[1];

    first.emitEnded();

    track.stop();

    expect(second.stopped).toBe(true);
  });

  it('disconnects gain nodes on destroy', () => {
    const track = makeTrack([makeBuffer([[1]]), makeBuffer([[2]])]);

    track.destroy();

    context.gainNodes.forEach((node) => expect(node.disconnected).toBe(true));
  });
});
