import { StaveNote } from 'vexflow';
import { describe, expect, it } from 'vitest';
import {
  ParsedChart,
  RenderData,
  RenderedNote,
} from '../../../chart-parser/types';
import { getCursorX, getNoteSvg } from './cursor-geometry';

type Tempo = ParsedChart['tempos'][number];

function tempo(tick: number, beatsPerMinute: number, msTime: number): Tempo {
  return { tick, beatsPerMinute, msTime } as Tempo;
}

function fakeNote(absoluteX: number, isRest = false): StaveNote {
  return {
    isRest: () => isRest,
    getAbsoluteX: () => absoluteX,
  } as unknown as StaveNote;
}

function renderedNote(
  tick: number,
  absoluteX: number,
  isRest = false,
): RenderedNote {
  return { tick, note: fakeNote(absoluteX, isRest) } as unknown as RenderedNote;
}

function fakeStave(x: number, width: number) {
  return { getX: () => x, getWidth: () => width };
}

function measureData(
  startTick: number,
  endTick: number,
  notes: RenderedNote[],
  staveX = 0,
  staveWidth = 200,
): RenderData {
  return {
    measure: { startTick, endTick },
    stave: fakeStave(staveX, staveWidth),
    renderedNotes: notes,
  } as unknown as RenderData;
}

describe('getCursorX', () => {
  const CHART = {
    resolution: 1,
    tempos: [tempo(0, 60000, 0)],
  } as unknown as ParsedChart;

  describe('rest-only measure', () => {
    const restMeasure = () =>
      measureData(0, 1000, [renderedNote(0, 0, true)], 0, 200);

    it('positions at the stave left edge at measure start', () => {
      expect(getCursorX(0, CHART, restMeasure())).toBe(0);
    });

    it('positions at the stave midpoint at the halfway tick', () => {
      expect(getCursorX(0.5, CHART, restMeasure())).toBe(100);
    });

    it('reaches the stave right edge exactly at measure end', () => {
      expect(getCursorX(1, CHART, restMeasure())).toBe(200);
    });

    it('clamps at the stave left edge when before measure start', () => {
      const data = measureData(
        500,
        1000,
        [renderedNote(500, 0, true)],
        50,
        200,
      );

      expect(getCursorX(0, CHART, data)).toBe(50);
    });

    it('clamps at the stave right edge when past measure end', () => {
      expect(getCursorX(2, CHART, restMeasure())).toBe(200);
    });
  });

  describe('non-rest notes', () => {
    it('snaps to the first note when the tick precedes it', () => {
      const data = measureData(0, 1000, [renderedNote(500, 100)]);

      expect(getCursorX(0, CHART, data)).toBe(100);
    });

    it('returns the note x when the tick equals the note tick', () => {
      const data = measureData(0, 1000, [
        renderedNote(0, 50),
        renderedNote(500, 150),
      ]);

      expect(getCursorX(0, CHART, data)).toBe(50);
    });

    it('interpolates linearly between two adjacent notes', () => {
      const data = measureData(0, 1000, [
        renderedNote(0, 50),
        renderedNote(500, 150),
      ]);

      expect(getCursorX(0.25, CHART, data)).toBe(100);
    });

    it('interpolates from the last note toward the stave right edge within measure bounds', () => {
      const data = measureData(0, 500, [renderedNote(0, 50)], 0, 200);

      expect(getCursorX(0.25, CHART, data)).toBe(125);
    });

    it('clamps at the stave right edge when past measure end', () => {
      const data = measureData(0, 500, [renderedNote(0, 50)], 0, 200);

      expect(getCursorX(1, CHART, data)).toBe(200);
    });

    it('returns the note x when the note sits exactly at the measure end tick', () => {
      const data = measureData(0, 500, [renderedNote(500, 100)], 0, 200);

      expect(getCursorX(1, CHART, data)).toBe(100);
    });

    it('uses note interpolation when the measure contains a mix of rests and real notes', () => {
      const data = measureData(0, 1000, [
        renderedNote(0, 0, true),
        renderedNote(500, 100),
      ]);

      expect(getCursorX(0.25, CHART, data)).toBe(50);
    });
  });
});

describe('getNoteSvg', () => {
  function svgEl(): SVGElement {
    return document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    ) as SVGElement;
  }

  it('returns an SVGElement for each noteHead', () => {
    const el1 = svgEl();
    const el2 = svgEl();
    const note = {
      noteHeads: [{ getSVGElement: () => el1 }, { getSVGElement: () => el2 }],
    } as unknown as StaveNote;

    expect(getNoteSvg(note)).toEqual([el1, el2]);
  });

  it('filters out null noteHeads', () => {
    const el = svgEl();
    const note = {
      noteHeads: [{ getSVGElement: () => null }, { getSVGElement: () => el }],
    } as unknown as StaveNote;

    expect(getNoteSvg(note)).toEqual([el]);
  });

  it('returns an empty array when noteHeads is empty', () => {
    const note = { noteHeads: [] } as unknown as StaveNote;

    expect(getNoteSvg(note)).toEqual([]);
  });
});
