import { describe, expect, it } from 'vitest';
import { Stave, StaveNote } from 'vexflow';
import {
  Measure,
  ParsedChart,
  RenderData,
  RenderedNote,
} from '../../chart-parser/types';
import { GameRenderer } from './game-renderer';

const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
} as unknown as ParsedChart;

function svgEl(): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  el.style.fill = '';

  return el as SVGElement;
}

function staveNote(
  keys: string[],
  {
    isRest = false,
    heads = keys.length,
  }: { isRest?: boolean; heads?: number } = {},
): StaveNote {
  const noteHeads = Array.from({ length: heads }, () => {
    const el = svgEl();

    return { getSVGElement: () => el };
  });

  return {
    isRest: () => isRest,
    getKeys: () => keys,
    getAbsoluteX: () => 0,
    noteHeads,
  } as unknown as StaveNote;
}

function fakeStave(): Stave {
  return {
    getX: () => 0,
    getY: () => 10,
    getWidth: () => 100,
    getHeight: () => 40,
  } as unknown as Stave;
}

function rendered(tick: number, note: StaveNote): RenderedNote {
  return { tick, note };
}

function measureData(
  startTick: number,
  endTick: number,
  notes: RenderedNote[],
): RenderData {
  return {
    stave: fakeStave(),
    measure: { startTick, endTick } as unknown as Measure,
    renderedNotes: notes,
    yOffset: 0,
  };
}

function div(): HTMLElement {
  return document.createElement('div');
}

function hasClass(note: StaveNote, cls: string, head = 0): boolean {
  return (
    note.noteHeads[head].getSVGElement() as SVGElement
  ).classList.contains(cls);
}

function uncolored(note: StaveNote, head = 0): boolean {
  return (
    !hasClass(note, 'vf-note-hit', head) &&
    !hasClass(note, 'vf-note-missed', head)
  );
}

interface SetupOptions {
  playheadStyle?: 'Cursor' | 'Measure';
  isHit?: (tick: number, prefix: string) => boolean;
  cursorEl?: HTMLElement;
  highlightEls?: (HTMLElement | undefined)[];
}

function setup(
  renderData: RenderData[],
  options: SetupOptions = {},
): GameRenderer {
  const {
    playheadStyle = 'Cursor',
    isHit = () => false,
    cursorEl,
    highlightEls = [],
  } = options;
  const view = new GameRenderer(isHit);

  view.setContext({ chart: CHART, renderData });
  view.setSettings(playheadStyle);
  view.setRefs({ cursorEl, highlightEls });

  return view;
}

describe('GameRenderer', () => {
  it('moves the measure highlight forward as the tick crosses measures', () => {
    const a = div();
    const b = div();
    const view = setup(
      [
        measureData(0, 1920, [
          rendered(0, staveNote(['c/5'], { isRest: true })),
        ]),
        measureData(1920, 3840, [
          rendered(1920, staveNote(['c/5'], { isRest: true })),
        ]),
      ],
      { playheadStyle: 'Measure', highlightEls: [a, b] },
    );

    view.render(0, 480);

    expect(a.style.border).toContain('var(--color-accent-bright)');
    expect(b.style.border).toBe('');

    view.render(0, 2016);

    expect(b.style.border).toContain('var(--color-accent-bright)');
    expect(a.style.backgroundColor).toBe('');
  });

  it('updates the cursor position every frame within a measure', () => {
    const cursor = div();
    const view = setup(
      [
        measureData(0, 1920, [
          rendered(0, staveNote(['c/5'], { isRest: true })),
        ]),
      ],
      { cursorEl: cursor },
    );

    view.render(0.5, 480);
    expect(cursor.style.transform).toBe(
      'translate3d(25px, 10px, 0) translateX(-50%)',
    );

    view.render(1, 960);
    expect(cursor.style.transform).toBe(
      'translate3d(50px, 10px, 0) translateX(-50%)',
    );
  });

  it('marks the active note and clears the previous one on a crossing', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const view = setup([
      measureData(0, 1920, [rendered(0, n0), rendered(480, n1)]),
    ]);

    view.render(0, 0);
    expect(hasClass(n0, 'vf-note-active')).toBe(true);
    expect(hasClass(n1, 'vf-note-active')).toBe(false);

    view.render(0, 480);
    expect(hasClass(n1, 'vf-note-active')).toBe(true);
    expect(hasClass(n0, 'vf-note-active')).toBe(false);
  });

  it('flashes a hit class on the struck note head only for the matching prefix', () => {
    const note = staveNote(['c/5', 'g/5']);
    const view = setup([]);

    view.paintHit(note, ['c/5']);

    expect(hasClass(note, 'vf-note-pop', 0)).toBe(true);
    expect(hasClass(note, 'vf-note-pop', 1)).toBe(false);
  });

  it('flashes a miss class on a passed un-hit note', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const view = setup([
      measureData(0, 1920, [rendered(0, n0), rendered(480, n1)]),
    ]);

    view.render(0, 0);
    expect(hasClass(n0, 'vf-note-miss')).toBe(false);

    view.render(0, 480);
    expect(hasClass(n0, 'vf-note-miss')).toBe(true);
  });

  it('does not flash a miss on a note that was hit', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const isHit = (tick: number, prefix: string) =>
      tick === 0 && prefix === 'c/5';
    const view = setup(
      [measureData(0, 1920, [rendered(0, n0), rendered(240, n1)])],
      { isHit },
    );

    view.render(0, 0);
    view.render(0, 240);

    expect(hasClass(n0, 'vf-note-miss')).toBe(false);
    expect(hasClass(n0, 'vf-note-hit')).toBe(true);
  });

  it('progress-colours notes before the active note', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const n2 = staveNote(['e/5']);
    const view = setup([
      measureData(0, 1920, [
        rendered(0, n0),
        rendered(240, n1),
        rendered(480, n2),
      ]),
    ]);

    view.render(0, 480);

    expect(hasClass(n0, 'vf-note-missed')).toBe(true);
    expect(hasClass(n1, 'vf-note-missed')).toBe(true);
    expect(uncolored(n2)).toBe(true);
  });

  it('clears colouring when the playhead is seeked backward', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const n2 = staveNote(['e/5']);
    const view = setup([
      measureData(0, 1920, [
        rendered(0, n0),
        rendered(240, n1),
        rendered(480, n2),
      ]),
    ]);

    view.render(0, 480);
    expect(hasClass(n0, 'vf-note-missed')).toBe(true);

    view.render(0, 0);
    expect(uncolored(n0)).toBe(true);
    expect(uncolored(n1)).toBe(true);
  });

  it('uses the isHit predicate to colour passed notes hit or missed', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const isHit = (tick: number, prefix: string) =>
      tick === 0 && prefix === 'c/5';
    const view = setup(
      [measureData(0, 1920, [rendered(0, n0), rendered(240, n1)])],
      { isHit },
    );

    view.render(0, 240);

    expect(hasClass(n0, 'vf-note-hit')).toBe(true);
  });

  it('paints a struck note head only for the matching prefix', () => {
    const note = staveNote(['c/5', 'g/5']);
    const view = setup([], {});

    view.paintHit(note, ['c/5']);

    expect(hasClass(note, 'vf-note-hit', 0)).toBe(true);
    expect(uncolored(note, 1)).toBe(true);
  });

  it('clears colouring while the playhead sits on a note-head-less rest', () => {
    const n0 = staveNote(['c/5']);
    const n1 = staveNote(['d/5']);
    const rest = staveNote(['e/5'], { heads: 0 });
    const view = setup(
      [
        measureData(0, 1920, [
          rendered(0, n0),
          rendered(240, n1),
          rendered(480, rest),
        ]),
      ],
      {},
    );

    view.render(0, 240);
    expect(hasClass(n0, 'vf-note-missed')).toBe(true);

    view.render(0, 480);
    expect(uncolored(n0)).toBe(true);
  });
});
