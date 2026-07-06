import { ParsedChart } from './types';

export function ticksToSeconds(
  tick: number,
  resolution: number,
  tempos: ParsedChart['tempos'],
): number {
  let tempo = tempos[0] ?? { tick: 0, beatsPerMinute: 120, msTime: 0 };

  for (const t of tempos) {
    if (t.tick <= tick) {
      tempo = t;
    } else {
      break;
    }
  }

  const deltaTicks = tick - tempo.tick;
  const msPerTick = 60000 / tempo.beatsPerMinute / resolution;

  return (tempo.msTime + deltaTicks * msPerTick) / 1000;
}

export function secondsToTicks(
  seconds: number,
  resolution: number,
  tempos: ParsedChart['tempos'],
): number {
  const ms = seconds * 1000;
  let tempo = tempos[0] ?? { tick: 0, beatsPerMinute: 120, msTime: 0 };

  for (const t of tempos) {
    if (t.msTime <= ms) {
      tempo = t;
    } else {
      break;
    }
  }

  const deltaMs = ms - tempo.msTime;
  const ticksPerMs = (tempo.beatsPerMinute * resolution) / 60000;

  return Math.round(tempo.tick + deltaMs * ticksPerMs);
}
