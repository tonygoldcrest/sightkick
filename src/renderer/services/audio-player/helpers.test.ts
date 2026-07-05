import { describe, expect, it } from 'vitest';
import { trimTrailingSilence } from './helpers';
import { FakeAudioBuffer, makeBuffer } from './test-support';

const context = {
  createBuffer: (channels: number, length: number, sampleRate: number) =>
    new FakeAudioBuffer(channels, length, sampleRate),
} as unknown as BaseAudioContext;

function trim(buffer: FakeAudioBuffer, threshold: number) {
  return trimTrailingSilence(
    buffer as unknown as AudioBuffer,
    context,
    threshold,
  ) as unknown as FakeAudioBuffer;
}

function constant(length: number, value: number) {
  return new Array(length).fill(value);
}

describe('trimTrailingSilence', () => {
  it('returns the same buffer when audio runs to the very end', () => {
    const buffer = makeBuffer([constant(1000, 1)]);

    expect(trim(buffer, 0.005)).toBe(buffer);
  });

  it('trims trailing silence but keeps the tail padding', () => {
    const samples = [...constant(500, 1), ...constant(500, 0)];
    const buffer = makeBuffer([samples], 1000);
    const trimmed = trim(buffer, 0.005);

    expect(trimmed).not.toBe(buffer);
    expect(trimmed.length).toBe(600);
    expect(trimmed.getChannelData(0)[0]).toBe(1);
  });

  it('keeps every channel when trimming', () => {
    const audible = [...constant(300, 1), ...constant(700, 0)];
    const silent = constant(1000, 0);
    const buffer = makeBuffer([audible, silent], 1000);
    const trimmed = trim(buffer, 0.005);

    expect(trimmed.numberOfChannels).toBe(2);
    expect(trimmed.getChannelData(0)[0]).toBe(1);
    expect(trimmed.getChannelData(1)[0]).toBe(0);
  });

  it('collapses an entirely silent buffer to just the tail padding', () => {
    const buffer = makeBuffer([constant(1000, 0)], 1000);
    const trimmed = trim(buffer, 0.005);

    expect(trimmed.length).toBe(101);
  });

  it('treats sub-threshold noise as silence', () => {
    const samples = [...constant(500, 0.001), ...constant(500, 0)];
    const buffer = makeBuffer([samples], 1000);
    const trimmed = trim(buffer, 0.005);

    expect(trimmed.length).toBe(101);
  });

  it('never trims shorter than the minimum duration', () => {
    const samples = [...constant(500, 1), ...constant(500, 0)];
    const buffer = makeBuffer([samples], 1000);
    const trimmed = trimTrailingSilence(
      buffer as unknown as AudioBuffer,
      context,
      0.005,
      0.8,
    ) as unknown as FakeAudioBuffer;

    expect(trimmed.length).toBe(800);
  });

  it('keeps the whole buffer when the minimum duration exceeds it', () => {
    const samples = [...constant(500, 1), ...constant(500, 0)];
    const buffer = makeBuffer([samples], 1000);
    const trimmed = trimTrailingSilence(
      buffer as unknown as AudioBuffer,
      context,
      0.005,
      2,
    );

    expect(trimmed).toBe(buffer as unknown as AudioBuffer);
  });
});
