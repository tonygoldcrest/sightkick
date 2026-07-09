import { Measure } from '../../../chart-parser/types';
import { ticksToSeconds } from '../../../chart-parser/timing';
import { Beat, CountInInfo, TimingChart } from './types';
import { DEFAULT_COUNT_IN } from './constants';

export function beatCountFor(measure: Measure): number {
  const numerator = measure.timeSig?.[0] ?? 4;

  return measure.isCompound ? numerator / 3 : numerator;
}

export function getBeatGrid(measures: Measure[], chart: TimingChart): Beat[] {
  const beats: Beat[] = [];

  for (let m = 0; m < measures.length; m += 1) {
    const measure = measures[m];
    const count = beatCountFor(measure);
    const span = measure.endTick - measure.startTick;
    const boundary = measures[m + 1]?.startTick ?? measure.endTick;

    for (let i = 0; i < count; i += 1) {
      const tick = measure.startTick + (span * i) / count;

      if (tick >= boundary) {
        break;
      }

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
