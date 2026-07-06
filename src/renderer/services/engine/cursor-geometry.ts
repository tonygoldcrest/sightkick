import { clamp } from 'es-toolkit';
import { StaveNote } from 'vexflow';
import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { secondsToTicks } from '../../../chart-parser/timing';

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
