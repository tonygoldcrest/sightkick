import { describe, expect, it } from 'vitest';
import { makeHann } from './window';

describe('makeHann', () => {
  it('has the requested length', () => {
    expect(makeHann(64)).toHaveLength(64);
  });

  it('starts and ends at zero', () => {
    const window = makeHann(64);

    expect(window[0]).toBeCloseTo(0, 6);
    expect(window[63]).toBeCloseTo(0, 6);
  });

  it('is symmetric', () => {
    const window = makeHann(64);

    for (let i = 0; i < 32; i += 1) {
      expect(window[i]).toBeCloseTo(window[63 - i], 6);
    }
  });

  it('peaks at one in the middle and never exceeds it', () => {
    const window = makeHann(65);

    expect(window[32]).toBeCloseTo(1, 6);
    window.forEach((value) => expect(value).toBeLessThanOrEqual(1 + 1e-6));
  });
});
