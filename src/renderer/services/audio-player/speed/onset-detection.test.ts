import { describe, expect, it } from 'vitest';
import { detectOnsets } from './onset-detection';

const SAMPLE_RATE = 44100;

function burst(signal: Float32Array, start: number, length: number, amp = 0.8) {
  for (let i = start; i < start + length; i += 1) {
    signal[i] = amp;
  }
}

describe('detectOnsets', () => {
  it('returns nothing for input too short to yield frames', () => {
    expect(detectOnsets(new Float32Array(100), SAMPLE_RATE)).toEqual([]);
  });

  it('returns nothing for a constant signal (no energy flux)', () => {
    const signal = new Float32Array(8192).fill(0.5);

    expect(detectOnsets(signal, SAMPLE_RATE)).toEqual([]);
  });

  it('detects an onset near a single energy burst', () => {
    const signal = new Float32Array(8192);

    burst(signal, 3000, 512);

    const onsets = detectOnsets(signal, SAMPLE_RATE);

    expect(onsets.length).toBe(1);
    expect(onsets[0]).toBeGreaterThan(3000 - 1024);
    expect(onsets[0]).toBeLessThan(3000 + 1024);
  });

  it('detects two onsets for two well-separated bursts', () => {
    const signal = new Float32Array(12000);

    burst(signal, 2000, 512);
    burst(signal, 8000, 512);

    const onsets = detectOnsets(signal, SAMPLE_RATE);

    expect(onsets.length).toBe(2);
    expect(onsets[0]).toBeLessThan(4000);
    expect(onsets[1]).toBeGreaterThan(6000);
  });

  it('collapses bursts closer than the minimum inter-onset interval', () => {
    const closeSignal = new Float32Array(8192);

    burst(closeSignal, 3000, 256);
    burst(closeSignal, 3300, 256);

    expect(detectOnsets(closeSignal, SAMPLE_RATE).length).toBe(1);
  });
});
