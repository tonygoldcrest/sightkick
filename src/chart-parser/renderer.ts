import {
  RenderContext,
  Renderer,
  Stave,
  StaveNote,
  TextJustification,
  Formatter,
  Fraction,
  ModifierPosition,
  Beam,
  Dot,
  Barline,
  Tuplet,
  Voice,
  GraceNote,
  GraceNoteGroup,
  Parenthesis,
  Glyph,
  Flow,
} from 'vexflow';
import { ChartParser } from './parser';
import { Measure, RenderData } from './types';
import { KEY_TO_ELEMENT } from './constants';

export interface SheetMusicColors {
  note: string;
  stave: string;
}

const STAVE_WIDTH = 600;
const STAVE_PER_ROW = 2;
const UNCOLORED_NOTE_CLASS = 'vf-note-uncolored';
const UNCOLORED_ACCENT_CLASS = 'vf-accent-uncolored';
const REST_NOTE_CLASS = 'vf-note-rest';
const STEM_DIRECTION = -1;
const REST_KEY = 'b/4';
const ACCENT_SCALE = Flow.NOTATION_FONT_SCALE;
const ACCENT_SCALE_RIGHT = Flow.NOTATION_FONT_SCALE * 0.8;

export function renderMusic(
  container: HTMLDivElement | undefined,
  song: ChartParser,
  colors: SheetMusicColors,
  showBarNumbers: boolean = true,
  enableColors: boolean = false,
  showTempo: boolean = true,
): RenderData[] {
  if (!container) {
    return [];
  }

  container.replaceChildren();

  const lineHeight = showBarNumbers ? 180 : 130;
  const rowWidth = STAVE_WIDTH * STAVE_PER_ROW + 10;
  const rowCount = Math.ceil(song.measures.length / STAVE_PER_ROW);
  const renderData: RenderData[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const yOffset = row * lineHeight;
    const rowEl = document.createElement('div');

    rowEl.style.position = 'relative';
    rowEl.style.width = `${rowWidth}px`;
    rowEl.style.height = `${lineHeight}px`;
    container.appendChild(rowEl);

    const renderer = new Renderer(rowEl, Renderer.Backends.SVG);
    const context = renderer.getContext();

    context.setFillStyle(colors.note);
    context.setStrokeStyle(colors.note);
    renderer.resize(rowWidth, lineHeight);

    const svgEl = rowEl.querySelector('svg');

    if (svgEl) {
      svgEl.style.overflow = 'visible';
      svgEl.style.display = 'block';
    }

    for (let col = 0; col < STAVE_PER_ROW; col += 1) {
      const index = row * STAVE_PER_ROW + col;

      if (index >= song.measures.length) {
        break;
      }

      const measure = song.measures[index];
      const { stave, renderedNotes } = renderMeasure(
        context,
        measure,
        index,
        col * STAVE_WIDTH,
        0,
        index === song.measures.length - 1,
        showBarNumbers,
        enableColors,
        showTempo,
        colors,
      );

      renderData[index] = { measure, stave, renderedNotes, yOffset };
    }
  }

  return renderData;
}

function buildVoice(measure: Measure) {
  const tupletGroups = new Map<number, StaveNote[]>();
  const staveNotes = measure.notes.map((note) => {
    const isMeasureRest = note.isRest && measure.notes.length === 1;
    const staveNote = new StaveNote({
      keys: note.isRest ? [REST_KEY] : note.notes,
      duration: `${note.duration}${'d'.repeat(note.dots)}${
        note.isRest ? 'r' : ''
      }`,
      align_center: isMeasureRest,
      stem_direction: STEM_DIRECTION,
    });

    if (note.dots > 0) {
      Dot.buildAndAttach([staveNote], {
        all: true,
      });
    }

    if (note.graceNotes?.length) {
      const graceNotes = note.graceNotes.map(
        (keys) =>
          new GraceNote({
            keys,
            duration: '8',
            slash: true,
            stem_direction: STEM_DIRECTION,
          }),
      );
      const graceGroup = new GraceNoteGroup(graceNotes, false);

      if (graceNotes.length > 1) {
        graceGroup.beamNotes();
      }

      staveNote.addModifier(graceGroup, 0);
    }

    if (!note.isRest && note.ghosts?.length) {
      staveNote.keys.forEach((key, keyIndex) => {
        if (note.ghosts?.includes(key)) {
          staveNote.addModifier(
            new Parenthesis(ModifierPosition.LEFT),
            keyIndex,
          );
          staveNote.addModifier(
            new Parenthesis(ModifierPosition.RIGHT),
            keyIndex,
          );
        }
      });
    }

    if (note.tupletId !== undefined) {
      const group = tupletGroups.get(note.tupletId) ?? [];

      group.push(staveNote);
      tupletGroups.set(note.tupletId, group);
    }

    return staveNote;
  });
  const tuplets = measure.tuplets
    .filter((meta) => (tupletGroups.get(meta.id)?.length ?? 0) > 1)
    .map(
      (meta) =>
        new Tuplet(tupletGroups.get(meta.id) as StaveNote[], {
          num_notes: meta.numNotes,
          notes_occupied: meta.notesOccupied,
          ratioed: false,
          location: STEM_DIRECTION,
        }),
    );
  const voice = new Voice({
    num_beats: measure.timeSig[0],
    beat_value: measure.timeSig[1],
  })
    .setStrict(false)
    .addTickables(staveNotes);
  const beams = Beam.generateBeams(staveNotes, {
    flat_beams: true,
    stem_direction: STEM_DIRECTION,
    groups: measure.isCompound
      ? [new Fraction(3, measure.timeSig[1])]
      : undefined,
  });

  return { voice, beams, tuplets, staveNotes };
}

function noteClassFor(key: string, enableColors: boolean): string | undefined {
  const element = KEY_TO_ELEMENT[key];

  if (!element) {
    return undefined;
  }

  return enableColors ? `vf-note-${element}` : UNCOLORED_NOTE_CLASS;
}

function accentClassFor(
  key: string | undefined,
  enableColors: boolean,
): string {
  const element = key ? KEY_TO_ELEMENT[key] : undefined;

  return enableColors && element
    ? `vf-accent-${element}`
    : UNCOLORED_ACCENT_CLASS;
}

function applyNoteClasses(staveNotes: StaveNote[], enableColors: boolean) {
  staveNotes.forEach((staveNote) => {
    if (staveNote.isRest()) {
      staveNote.noteHeads.forEach(
        (noteHead) => noteHead?.getSVGElement()?.classList.add(REST_NOTE_CLASS),
      );

      return;
    }

    staveNote.getKeys().forEach((key, keyIndex) => {
      const noteClass = noteClassFor(key, enableColors);

      if (noteClass) {
        staveNote.noteHeads[keyIndex]
          ?.getSVGElement()
          ?.classList.add(noteClass);
      }
    });
  });
}

function drawAccentGlyph(
  context: RenderContext,
  x: number,
  y: number,
  originX: number,
  originY: number,
  scale: number,
  accentClass: string,
  noteColor: string,
) {
  const glyph = new Glyph('articAccentAbove', scale);

  glyph.setOrigin(originX, originY);

  const group = context.openGroup('accent') as SVGGElement;

  group.classList.add(accentClass);
  context.setFillStyle(noteColor);
  context.setStrokeStyle(noteColor);
  glyph.render(context, x, y);
  context.closeGroup();
}

function drawAccents(
  context: RenderContext,
  stave: Stave,
  measure: Measure,
  staveNotes: StaveNote[],
  enableColors: boolean,
  noteColor: string,
) {
  const gap = stave.getSpacingBetweenLines();
  const topLineY = stave.getYForLine(0);

  context.save();

  staveNotes.forEach((staveNote, index) => {
    const note = measure.notes[index];

    if (!note.accents?.length) {
      return;
    }

    const ys = staveNote.getYs();
    const wholeChord = note.notes.every((key) => note.accents?.includes(key));

    if (wholeChord) {
      const { x } = staveNote.getModifierStartXY(ModifierPosition.ABOVE, 0);
      const accentClass = accentClassFor(
        note.notes.length === 1 ? note.notes[0] : undefined,
        enableColors,
      );

      drawAccentGlyph(
        context,
        x,
        Math.min(...ys, topLineY) - gap,
        0.5,
        1,
        ACCENT_SCALE,
        accentClass,
        noteColor,
      );

      return;
    }

    note.accents.forEach((key) => {
      const keyIndex = note.notes.indexOf(key);

      if (keyIndex < 0) {
        return;
      }

      const { x } = staveNote.getModifierStartXY(
        ModifierPosition.RIGHT,
        keyIndex,
      );

      drawAccentGlyph(
        context,
        x + gap / 2,
        ys[keyIndex],
        0.2,
        0.5,
        ACCENT_SCALE_RIGHT,
        accentClassFor(key, enableColors),
        noteColor,
      );
    });
  });

  context.restore();
}

function renderMeasure(
  context: RenderContext,
  measure: Measure,
  index: number,
  xOffset: number,
  yOffset: number,
  endMeasure: boolean,
  showBarNumbers: boolean,
  enableColors: boolean,
  showTempo: boolean,
  colors: SheetMusicColors,
) {
  const stave = new Stave(xOffset, yOffset, STAVE_WIDTH);

  if (endMeasure) {
    stave.setEndBarType(Barline.type.END);
  }

  if (measure.hasClef) {
    stave.addClef('percussion');
  }

  if (measure.sigChange) {
    stave.addTimeSignature(`${measure.timeSig[0]}/${measure.timeSig[1]}`);
  }

  if (showTempo && measure.tempo) {
    stave.setTempo(measure.tempo, 0);
  }

  if (showBarNumbers) {
    stave.setText(`${index}`, ModifierPosition.ABOVE, {
      justification: TextJustification.LEFT,
    });
  }

  stave
    .setStyle({
      fillStyle: colors.stave,
      strokeStyle: colors.stave,
    })
    .setContext(context)
    .draw();

  const { voice, beams, tuplets, staveNotes } = buildVoice(measure);

  new Formatter().joinVoices([voice]).format([voice], STAVE_WIDTH - 40);
  voice.draw(context, stave);
  beams.forEach((beam) => {
    beam.setContext(context).draw();
  });
  tuplets.forEach((tuplet) => {
    tuplet.setContext(context).draw();
  });

  applyNoteClasses(staveNotes, enableColors);
  drawAccents(context, stave, measure, staveNotes, enableColors, colors.note);

  const renderedNotes = staveNotes.map((staveNote, i) => ({
    tick: measure.notes[i].tick,
    note: staveNote,
    accents: measure.notes[i].accents,
    ghosts: measure.notes[i].ghosts,
  }));

  return { stave, renderedNotes };
}
