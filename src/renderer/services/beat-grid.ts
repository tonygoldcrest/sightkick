import { Measure, ParsedChart } from '../../chart-parser/types';
import { ticksToSeconds } from '../views/utils';

export interface Beat {
  timeSeconds: number;
  isDownbeat: boolean;
}

export interface CountInInfo {
  beats: number;
  beatDurationSeconds: number;
}

type TimingChart = Pick<ParsedChart, 'resolution' | 'tempos'>;

const DEFAULT_COUNT_IN: CountInInfo = { beats: 4, beatDurationSeconds: 0.5 };

export function beatCountFor(measure: Measure): number {
  const numerator = measure.timeSig?.[0] ?? 4;

  return measure.isCompound ? numerator / 3 : numerator;
}

export function getBeatGrid(measures: Measure[], chart: TimingChart): Beat[] {
  const beats: Beat[] = [];

  for (const measure of measures) {
    const count = beatCountFor(measure);
    const span = measure.endTick - measure.startTick;

    for (let i = 0; i < count; i += 1) {
      const tick = measure.startTick + (span * i) / count;

      beats.push({
        timeSeconds: ticksToSeconds(tick, chart.resolution, chart.tempos),
        isDownbeat: i === 0,
      });
    }
  }

  return beats;
}

export function getCountInInfo(
  startTick: number,
  measures: Measure[],
  chart: TimingChart,
): CountInInfo {
  const measure =
    measures.find((m) => startTick >= m.startTick && startTick < m.endTick) ??
    measures[0];

  if (!measure) {
    return DEFAULT_COUNT_IN;
  }

  const beats = beatCountFor(measure);
  const measureSeconds =
    ticksToSeconds(measure.endTick, chart.resolution, chart.tempos) -
    ticksToSeconds(measure.startTick, chart.resolution, chart.tempos);

  return { beats, beatDurationSeconds: measureSeconds / beats };
}
