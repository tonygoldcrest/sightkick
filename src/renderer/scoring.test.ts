import { describe, expect, it } from 'vitest';
import { calculateAccuracy, getStarRating, STAR_RATING_BANDS } from './scoring';

describe('calculateAccuracy', () => {
  it('returns 1 for a perfect score with no false hits', () => {
    expect(
      calculateAccuracy({ totalNotes: 10, hitNotes: 10, falseHits: 0 }),
    ).toBe(1);
  });

  it('returns 0 when no notes are hit', () => {
    expect(
      calculateAccuracy({ totalNotes: 10, hitNotes: 0, falseHits: 0 }),
    ).toBe(0);
  });

  it('hitNotes defaults to 0 when omitted', () => {
    expect(calculateAccuracy({ totalNotes: 10, falseHits: 0 })).toBe(0);
  });

  it('returns the correct fraction for partial hits', () => {
    expect(
      calculateAccuracy({ totalNotes: 4, hitNotes: 2, falseHits: 0 }),
    ).toBe(0.5);
  });

  it('false hits reduce accuracy below 1 even when all notes are hit', () => {
    expect(
      calculateAccuracy({ totalNotes: 10, hitNotes: 10, falseHits: 10 }),
    ).toBeCloseTo(0.5);
  });
});

describe('getStarRating', () => {
  const BANDS = [0.2, 0.4, 0.6, 0.8, 0.9];
  const score = (hitNotes: number) => ({
    totalNotes: 100,
    hitNotes,
    falseHits: 0,
  });

  it('STAR_RATING_BANDS has 5 entries', () => {
    expect(STAR_RATING_BANDS).toHaveLength(5);
  });

  it('returns 0 stars when accuracy is below the first band', () => {
    expect(getStarRating(score(0), BANDS)).toBe(0);
    expect(getStarRating(score(19), BANDS)).toBe(0);
  });

  it('awards one additional star per band threshold crossed', () => {
    expect(getStarRating(score(20), BANDS)).toBe(1);
    expect(getStarRating(score(40), BANDS)).toBe(2);
    expect(getStarRating(score(60), BANDS)).toBe(3);
    expect(getStarRating(score(80), BANDS)).toBe(4);
    expect(getStarRating(score(90), BANDS)).toBe(5);
  });

  it('does not award a star just below a band threshold', () => {
    expect(getStarRating(score(39), BANDS)).toBe(1);
    expect(getStarRating(score(59), BANDS)).toBe(2);
    expect(getStarRating(score(79), BANDS)).toBe(3);
    expect(getStarRating(score(89), BANDS)).toBe(4);
  });

  it('returns 5 stars for any accuracy at or above the top band', () => {
    expect(getStarRating(score(100), BANDS)).toBe(5);
  });
});
