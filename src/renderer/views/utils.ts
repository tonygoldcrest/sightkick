import { clamp } from 'es-toolkit';
import { StaveNote } from 'vexflow';
import { Measure, ParsedChart, RenderData } from '../../chart-parser/types';
import { ScoreData } from '../../types';

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

export interface CountIn {
  beats: number;
  beatMs: number;
}

const DEFAULT_COUNT_IN: CountIn = { beats: 4, beatMs: 500 };

export function getCountIn(
  startTick: number,
  measures: Measure[],
  chart: Pick<ParsedChart, 'resolution' | 'tempos'>,
): CountIn {
  const measure =
    measures.find((m) => startTick >= m.startTick && startTick < m.endTick) ??
    measures[0];

  if (!measure) {
    return DEFAULT_COUNT_IN;
  }

  const beats = measure.timeSig[0];
  const measureSeconds =
    ticksToSeconds(measure.endTick, chart.resolution, chart.tempos) -
    ticksToSeconds(measure.startTick, chart.resolution, chart.tempos);

  return { beats, beatMs: (measureSeconds * 1000) / beats };
}

export function getCursorX(
  currentTime: number,
  chart: ParsedChart,
  measureData: RenderData,
) {
  const { measure, stave, renderedNotes } = measureData;
  const currentTick = secondsToTicks(
    currentTime,
    chart.resolution,
    chart.tempos,
  );

  if (renderedNotes.every((note) => note.note.isRest())) {
    const normalizedTick =
      (currentTick - measure.startTick) / (measure.endTick - measure.startTick);
    const progress = clamp(normalizedTick, 0, 1);

    return stave.getX() + progress * stave.getWidth();
  } else {
    let currentNoteIdx = -1;

    for (let i = 0; i < renderedNotes.length; i++) {
      if (renderedNotes[i].tick <= currentTick) {
        currentNoteIdx = i;
      } else {
        break;
      }
    }

    if (currentNoteIdx === -1) {
      return renderedNotes[0].note.getAbsoluteX();
    } else {
      const currentNote = renderedNotes[currentNoteIdx];
      const nextNote = renderedNotes[currentNoteIdx + 1];
      const currentNoteX = currentNote.note.getAbsoluteX();

      if (!nextNote) {
        const ticksLeft = measure.endTick - currentNote.tick;
        const staveRight = stave.getX() + stave.getWidth();

        if (ticksLeft <= 0) {
          return currentNoteX;
        }

        const progress = clamp(
          (currentTick - currentNote.tick) / ticksLeft,
          0,
          1,
        );

        return currentNoteX + progress * (staveRight - currentNoteX);
      } else {
        return (
          currentNoteX +
          ((currentTick - currentNote.tick) /
            (nextNote.tick - currentNote.tick)) *
            (nextNote.note.getAbsoluteX() - currentNoteX)
        );
      }
    }
  }
}

export function getNoteSvg(note: StaveNote) {
  return note.noteHeads
    .map((nh) => nh.getSVGElement())
    .filter((el): el is SVGElement => el !== null && el !== undefined);
}

export function calculateAccuracy({
  totalNotes,
  falseHits,
  hitNotes = 0,
}: ScoreData) {
  return parseFloat((hitNotes / (totalNotes + falseHits)).toFixed(2));
}

export const STAR_RATING_BANDS = [0.2, 0.4, 0.6, 0.8, 0.92];

export function getStarRating(scoreData: ScoreData, bands = STAR_RATING_BANDS) {
  const accuracy = calculateAccuracy(scoreData);

  return bands.filter((threshold) => accuracy >= threshold).length;
}
