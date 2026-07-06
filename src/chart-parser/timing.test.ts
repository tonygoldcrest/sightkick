import { describe, expect, it } from 'vitest';
import { ParsedChart } from './types';
import { secondsToTicks, ticksToSeconds } from './timing';

type Tempo = ParsedChart['tempos'][number];

function tempo(tick: number, beatsPerMinute: number, msTime: number): Tempo {
  return { tick, beatsPerMinute, msTime } as Tempo;
}

describe('ticksToSeconds', () => {
  it('returns 0 at tick 0', () => {
    expect(ticksToSeconds(0, 1, [tempo(0, 60, 0)])).toBe(0);
  });

  it('converts ticks linearly within a single tempo segment', () => {
    expect(ticksToSeconds(1, 1, [tempo(0, 60, 0)])).toBe(1);
    expect(ticksToSeconds(2, 1, [tempo(0, 60, 0)])).toBe(2);
  });

  it('uses the tempo segment whose tick is <= the target tick', () => {
    const tempos = [tempo(0, 60, 0), tempo(1, 120, 1000)];

    expect(ticksToSeconds(1, 1, tempos)).toBe(1);
  });

  it('applies the new tempo after a tempo change', () => {
    const tempos = [tempo(0, 60, 0), tempo(1, 120, 1000)];

    expect(ticksToSeconds(2, 1, tempos)).toBe(1.5);
  });

  it('falls back to 120 BPM when tempos is empty', () => {
    expect(ticksToSeconds(2, 1, [])).toBe(1);
  });
});

describe('secondsToTicks', () => {
  it('returns 0 at time 0', () => {
    expect(secondsToTicks(0, 1, [tempo(0, 60, 0)])).toBe(0);
  });

  it('converts seconds linearly within a single tempo segment', () => {
    expect(secondsToTicks(1, 1, [tempo(0, 60, 0)])).toBe(1);
    expect(secondsToTicks(2, 1, [tempo(0, 60, 0)])).toBe(2);
  });

  it('always returns an integer', () => {
    const result = secondsToTicks(0.0003, 1, [tempo(0, 100, 0)]);

    expect(Number.isInteger(result)).toBe(true);
  });

  it('applies the new tempo after a tempo change', () => {
    const tempos = [tempo(0, 60, 0), tempo(1, 120, 1000)];

    expect(secondsToTicks(1.5, 1, tempos)).toBe(2);
  });

  it('falls back to 120 BPM when tempos is empty', () => {
    expect(secondsToTicks(1, 1, [])).toBe(2);
  });

  it('is the inverse of ticksToSeconds', () => {
    const tempos = [tempo(0, 60, 0)];
    const t = ticksToSeconds(42, 1, tempos);

    expect(secondsToTicks(t, 1, tempos)).toBe(42);
  });
});
