import { describe, expect, it, vi } from 'vitest';
import { Measure, Note, ParsedChart } from '../../../chart-parser/types';
import { InputEvent } from '../../input/types';
import { Judge } from './judge';
import { JudgeContext, JudgeHitHandler } from './types';

const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
} as unknown as ParsedChart;

function note(
  keys: string[],
  tick: number,
  marks: { isRest?: boolean; accents?: string[]; ghosts?: string[] } = {},
): Note {
  return {
    notes: keys,
    tick,
    isRest: marks.isRest ?? false,
    accents: marks.accents,
    ghosts: marks.ghosts,
  } as unknown as Note;
}

function measure(
  notes: Note[],
  bounds: { startTick: number; endTick: number } = {
    startTick: 0,
    endTick: Number.MAX_SAFE_INTEGER,
  },
): Measure {
  return { notes, ...bounds } as unknown as Measure;
}

function hit(controlId: string, value = 100): InputEvent {
  return { controlId, value };
}

function setup(
  overrides: Partial<JudgeContext> = {},
  options: { tick?: number; enabled?: boolean } = {},
) {
  const onHit = vi.fn<JudgeHitHandler>();
  const engine = new Judge();

  engine.setContext({
    chart: CHART,
    measures: [],
    mapping: { snare: ['midi:38'] },
    ...overrides,
  });
  engine.setEnabled(options.enabled ?? true);
  engine.setTick(options.tick ?? 0);
  engine.onHit(onHit);

  return { engine, onHit };
}

describe('Judge', () => {
  it('registers a correct hit and notifies onHit with the matched position', () => {
    const { engine, onHit } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.isHit(480, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(0);
    expect(onHit).toHaveBeenCalledWith({ measureIdx: 0, noteIdx: 0 }, ['c/5']);
  });

  it('registers a hit using the remapped control after a remap', () => {
    const measures = [measure([note(['c/5'], 480)])];
    const { engine } = setup(
      { measures, mapping: { snare: ['midi:38'] } },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:40'));
    expect(engine.hitCount).toBe(0);

    engine.setContext({
      chart: CHART,
      measures,
      mapping: { snare: ['midi:40'] },
    });
    engine.handleInput(hit('midi:40'));
    expect(engine.isHit(480, 'c/5')).toBe(true);

    engine.handleInput(hit('midi:38'));
    expect(engine.hitCount).toBe(1);
    expect(engine.falseHitCount).toBe(0);
  });

  it('ignores input with zero value', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38', 0));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(0);
  });

  it('ignores unmapped controls without counting them as misses', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:99'));

    expect(engine.falseHitCount).toBe(0);
    expect(engine.hitCount).toBe(0);
  });

  it('counts a miss when no note is near the playhead', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 5000)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(1);
  });

  it('counts a miss when the nearby note belongs to a different drum', () => {
    const { engine } = setup(
      {
        measures: [measure([note(['f/4'], 480)])],
        mapping: { snare: ['midi:38'], kick: ['midi:36'] },
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.falseHitCount).toBe(1);
    expect(engine.hitCount).toBe(0);
  });

  it('counts a repeat hit on the same note as a miss', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));
    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(1);
    expect(engine.falseHitCount).toBe(1);
  });

  it('counts every simultaneous wrong hit at the same tick', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 5000)], { startTick: 0, endTick: 10000 }),
        ],
        mapping: {
          crash: ['midi:49'],
          ride: ['midi:51'],
          tom1: ['midi:50'],
        },
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:49'));
    engine.handleInput(hit('midi:51'));
    engine.handleInput(hit('midi:50'));

    expect(engine.falseHitCount).toBe(3);
  });

  it('never wipes false hits on backward setTick, regardless of magnitude', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 5000)], { startTick: 0, endTick: 10000 }),
        ],
        mapping: { crash: ['midi:49'] },
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:49'));
    expect(engine.falseHitCount).toBe(1);

    engine.setTick(1);
    engine.setTick(490);
    engine.handleInput(hit('midi:49'));

    expect(engine.falseHitCount).toBe(2);
  });

  it('drops only false hits ahead of a genuine rewind, keeping earlier ones', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 5000)], { startTick: 0, endTick: 10000 }),
        ],
        mapping: { crash: ['midi:49'] },
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:49'));
    engine.setTick(2000);
    engine.handleInput(hit('midi:49'));
    expect(engine.falseHitCount).toBe(2);

    engine.rewindTo(1000);

    expect(engine.falseHitCount).toBe(1);
  });

  it('keeps a recorded hit through backward setTick, regardless of magnitude', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));
    expect(engine.isHit(480, 'c/5')).toBe(true);

    engine.setTick(1);

    expect(engine.isHit(480, 'c/5')).toBe(true);
    expect(engine.hitCount).toBe(1);
  });

  it('does nothing while the current tick is undefined', () => {
    const { engine } = setup({ measures: [measure([note(['c/5'], 480)])] });

    engine.setTick(undefined);
    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(0);
  });

  it('clears hits ahead of the playhead when rewinding', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));
    expect(engine.isHit(480, 'c/5')).toBe(true);

    engine.rewindTo(100);

    expect(engine.isHit(480, 'c/5')).toBe(false);
    expect(engine.falseHitCount).toBe(0);
  });

  it('preserves hit state when the same chart re-renders', () => {
    const measures = [measure([note(['c/5'], 480)])];
    const { engine } = setup({ measures }, { tick: 480 });

    engine.handleInput(hit('midi:38'));
    expect(engine.hitCount).toBe(1);

    engine.setContext({
      chart: CHART,
      measures: [measure([note(['c/5'], 480)])],
      mapping: { snare: ['midi:38'] },
    });

    expect(engine.hitCount).toBe(1);
    expect(engine.isHit(480, 'c/5')).toBe(true);
  });

  it('clears all hit state when the chart changes', () => {
    const measures = [measure([note(['c/5'], 480)])];
    const { engine } = setup({ measures }, { tick: 480 });

    engine.handleInput(hit('midi:38'));
    expect(engine.hitCount).toBe(1);

    const nextChart = {
      resolution: 480,
      tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
    } as unknown as ParsedChart;

    engine.setContext({
      chart: nextChart,
      measures,
      mapping: { snare: ['midi:38'] },
    });

    expect(engine.hitCount).toBe(0);
  });

  it('picks the closest matching note among several', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 530), note(['c/5'], 490)])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.isHit(490, 'c/5')).toBe(true);
    expect(engine.isHit(530, 'c/5')).toBe(false);
  });

  it('skips rest notes when matching', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 480, { isRest: true }), note(['f/4'], 9000)], {
            startTick: 0,
            endTick: 10000,
          }),
        ],
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(1);
  });

  it('ignores hits when not enabled', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480, enabled: false },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(0);
  });

  it('resumes registering hits after enabled transitions to true', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480)])] },
      { tick: 480, enabled: false },
    );

    engine.handleInput(hit('midi:38'));
    expect(engine.hitCount).toBe(0);

    engine.setEnabled(true);
    engine.handleInput(hit('midi:38'));

    expect(engine.isHit(480, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(0);
  });

  it('rejects a soft hit on an accented note as a miss', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480, { accents: ['c/5'] })])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38', 80));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(1);
  });

  it('accepts a hard hit on an accented note', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480, { accents: ['c/5'] })])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38', 110));

    expect(engine.isHit(480, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(0);
  });

  it('rejects a loud hit on a ghost note as a miss', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480, { ghosts: ['c/5'] })])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38', 80));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(1);
  });

  it('accepts a soft hit on a ghost note', () => {
    const { engine } = setup(
      { measures: [measure([note(['c/5'], 480, { ghosts: ['c/5'] })])] },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38', 30));

    expect(engine.isHit(480, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(0);
  });

  it('does not count a false hit inside a fully silent measure', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 480, { isRest: true })], {
            startTick: 0,
            endTick: 1920,
          }),
        ],
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.hitCount).toBe(0);
    expect(engine.falseHitCount).toBe(0);
  });

  it('still counts a false hit in a measure that contains notes', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 5000)], { startTick: 0, endTick: 10000 }),
        ],
      },
      { tick: 480 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.falseHitCount).toBe(1);
  });

  it('counts a false hit played alongside a correct early hit into a silent measure', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 1000, { isRest: true })], {
            startTick: 0,
            endTick: 1920,
          }),
          measure([note(['c/5'], 1950)], { startTick: 1920, endTick: 3840 }),
        ],
        mapping: { snare: ['midi:38'], tom1: ['midi:48'] },
      },
      { tick: 1900 },
    );

    engine.handleInput(hit('midi:38'));
    engine.handleInput(hit('midi:48'));

    expect(engine.isHit(1950, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(1);
  });

  it('registers an early hit on a note in the next measure from a silent measure', () => {
    const { engine } = setup(
      {
        measures: [
          measure([note(['c/5'], 1000, { isRest: true })], {
            startTick: 0,
            endTick: 1920,
          }),
          measure([note(['c/5'], 1950)], { startTick: 1920, endTick: 3840 }),
        ],
      },
      { tick: 1900 },
    );

    engine.handleInput(hit('midi:38'));

    expect(engine.isHit(1950, 'c/5')).toBe(true);
    expect(engine.falseHitCount).toBe(0);
  });

  it('stops notifying a removed hit listener', () => {
    const onHit = vi.fn<JudgeHitHandler>();
    const engine = new Judge();

    engine.setContext({
      chart: CHART,
      measures: [measure([note(['c/5'], 480)])],
      mapping: { snare: ['midi:38'] },
    });
    engine.setEnabled(true);
    engine.setTick(480);

    const unsubscribe = engine.onHit(onHit);

    unsubscribe();
    engine.handleInput(hit('midi:38'));

    expect(onHit).not.toHaveBeenCalled();
    expect(engine.isHit(480, 'c/5')).toBe(true);
  });
});
