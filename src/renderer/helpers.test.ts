import { describe, expect, it } from 'vitest';
import { lowerBound } from './helpers';

describe('lowerBound', () => {
  const firstAtOrAfter = (values: number[], target: number) =>
    lowerBound(values.length, (index) => values[index] >= target);

  it('returns 0 for an empty range', () => {
    expect(lowerBound(0, () => true)).toBe(0);
    expect(lowerBound(0, () => false)).toBe(0);
  });

  it('returns 0 when every element is at or after the target', () => {
    expect(firstAtOrAfter([10, 20, 30], 5)).toBe(0);
  });

  it('returns the length when no element reaches the target', () => {
    expect(firstAtOrAfter([10, 20, 30], 40)).toBe(3);
  });

  it('finds the first element at or after the target in the middle', () => {
    expect(firstAtOrAfter([10, 20, 30, 40], 25)).toBe(2);
  });

  it('lands on an exact match rather than past it', () => {
    expect(firstAtOrAfter([10, 20, 30, 40], 30)).toBe(2);
  });

  it('returns the first index of a run of equal values', () => {
    expect(firstAtOrAfter([10, 20, 20, 20, 30], 20)).toBe(1);
  });

  it('agrees with a linear scan across every target on a sorted array', () => {
    const values = [0, 3, 3, 7, 9, 9, 9, 14];

    for (let target = -1; target <= 16; target += 1) {
      const linear = values.findIndex((v) => v >= target);
      const expected = linear === -1 ? values.length : linear;

      expect(firstAtOrAfter(values, target)).toBe(expected);
    }
  });
});
