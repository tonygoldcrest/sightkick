import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from '../audio-player/test-support';
import { ClickTrack } from './click-track';

vi.mock('./metronome', () => ({
  DEFAULT_CLICK_TONE: 0.5,
  renderClickBuffers: vi.fn(() => ({
    downbeat: { id: 'downbeat' },
    beat: { id: 'beat' },
  })),
}));

function makeContext() {
  return new FakeAudioContext() as unknown as AudioContext;
}

describe('ClickTrack', () => {
  let context: FakeAudioContext;

  beforeEach(() => {
    context = makeContext() as unknown as FakeAudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connects a muted gain node to the destination', () => {
    new ClickTrack(context as unknown as AudioContext);

    expect(context.gainNodes).toHaveLength(1);
    expect(context.gainNodes[0].gain.value).toBe(0);
    expect(context.gainNodes[0].connectedTo).toContain(context.destination);
  });

  it('schedules a click as a source into the gain node', () => {
    const track = new ClickTrack(context as unknown as AudioContext);

    track.scheduleClick(1.5, true);

    expect(context.bufferSources).toHaveLength(1);

    const source = context.bufferSources[0];

    expect(source.connectedTo).toBe(context.gainNodes[0]);
    expect(source.starts[0].at).toBe(1.5);
  });

  it('picks the downbeat buffer for accents and the beat buffer otherwise', () => {
    const track = new ClickTrack(context as unknown as AudioContext);

    track.scheduleClick(0, true);
    track.scheduleClick(0, false);

    expect(context.bufferSources[0].buffer).toEqual({ id: 'downbeat' });
    expect(context.bufferSources[1].buffer).toEqual({ id: 'beat' });
  });

  it('never schedules in the past', () => {
    context.currentTime = 5;

    const track = new ClickTrack(context as unknown as AudioContext);

    track.scheduleClick(2, false);

    expect(context.bufferSources[0].starts[0].at).toBe(5);
  });

  it('sets gain at a given context time', () => {
    const track = new ClickTrack(context as unknown as AudioContext);

    track.setGain(0.8, 3);

    expect(context.gainNodes[0].gain.calls.at(-1)).toEqual({
      value: 0.8,
      time: 3,
    });
  });

  it('stops pending sources when cleared', () => {
    const track = new ClickTrack(context as unknown as AudioContext);

    track.scheduleClick(10, true);
    track.clearPending();

    expect(context.bufferSources[0].stopped).toBe(true);
  });

  it('re-renders buffers when the tone changes', async () => {
    const metronome = await import('./metronome');
    const track = new ClickTrack(context as unknown as AudioContext);

    vi.mocked(metronome.renderClickBuffers).mockClear();
    track.setTone(0.8);

    expect(metronome.renderClickBuffers).toHaveBeenCalledWith(context, 0.8);
  });

  it('ignores a tone change to the current value', async () => {
    const metronome = await import('./metronome');
    const track = new ClickTrack(context as unknown as AudioContext);

    vi.mocked(metronome.renderClickBuffers).mockClear();
    track.setTone(0.5);

    expect(metronome.renderClickBuffers).not.toHaveBeenCalled();
  });
});
