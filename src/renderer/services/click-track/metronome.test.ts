import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  installWebAudio,
} from '../audio-player/test-support';
import { renderClickBuffers } from './metronome';

describe('metronome', () => {
  let context: FakeAudioContext;

  beforeEach(() => {
    context = installWebAudio();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a downbeat and beat buffer', () => {
    const { downbeat, beat } = renderClickBuffers(
      context as unknown as AudioContext,
      0.5,
    );

    expect(downbeat.length).toBeGreaterThan(0);
    expect(beat.length).toBeGreaterThan(0);
  });

  it('rings longer at higher tone (more sustain)', () => {
    const dark = renderClickBuffers(context as unknown as AudioContext, 0);
    const bright = renderClickBuffers(context as unknown as AudioContext, 1);

    expect(bright.downbeat.length).toBeGreaterThan(dark.downbeat.length);
  });

  it('produces non-silent samples', () => {
    const { beat } = renderClickBuffers(
      context as unknown as AudioContext,
      0.5,
    );
    const peak = Math.max(...Array.from(beat.getChannelData(0)).map(Math.abs));

    expect(peak).toBeGreaterThan(0);
  });
});
