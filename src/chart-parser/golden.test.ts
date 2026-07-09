import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { parseChartFile } from 'scan-chart';
import { ChartParser } from './parser';
import { Measure, Note, ParsedChart } from './types';

interface Fixture {
  name: string;
  file: string;
  format: 'mid' | 'chart';
  proDrums: boolean;
  fiveLaneDrums: boolean;
}

const FIXTURES: Fixture[] = [
  {
    name: 'The Kill',
    file: 'the-kill.mid',
    format: 'mid',
    proDrums: false,
    fiveLaneDrums: true,
  },
  {
    name: 'Livin on a Prayer',
    file: 'livin-on-a-prayer.mid',
    format: 'mid',
    proDrums: true,
    fiveLaneDrums: false,
  },
  {
    name: 'Monomyth',
    file: 'monomyth.chart',
    format: 'chart',
    proDrums: false,
    fiveLaneDrums: false,
  },
  {
    name: 'Pneuma',
    file: 'pneuma.chart',
    format: 'chart',
    proDrums: true,
    fiveLaneDrums: false,
  },
  {
    name: 'Rudimental Ritual',
    file: 'rudimental-ritual.chart',
    format: 'chart',
    proDrums: false,
    fiveLaneDrums: false,
  },
];
const CHARTS_DIR = path.join(
  process.cwd(),
  'src/chart-parser/__fixtures__/charts',
);

function serializeNote(note: Note): string {
  const head = note.isRest ? 'R' : note.notes.join('+');
  let out = `${note.tick}:${head}=${note.duration}${'.'.repeat(note.dots)}`;

  if (note.tupletId !== undefined) {
    out += `#${note.tupletId}`;
  }

  if (note.accents?.length) {
    out += ` a[${note.accents.join(',')}]`;
  }

  if (note.ghosts?.length) {
    out += ` g[${note.ghosts.join(',')}]`;
  }

  if (note.graceNotes?.length) {
    out += ` grace{${note.graceNotes
      .map((chord) => chord.join('+'))
      .join(';')}}`;
  }

  return out;
}

function serializeMeasure(measure: Measure, index: number): string {
  const flags = [
    measure.sigChange ? 'SIG' : '',
    measure.isCompound ? 'COMP' : '',
    measure.hasClef ? 'CLEF' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const tempo = measure.tempo
    ? ` TEMPO ${measure.tempo.bpm} ${measure.tempo.duration}${'.'.repeat(
        measure.tempo.dots,
      )}`
    : '';
  const tuplets = measure.tuplets.length
    ? ` TUP[${measure.tuplets
        .map((t) => `${t.id}:${t.numNotes}/${t.notesOccupied}`)
        .join(',')}]`
    : '';
  const header =
    `#${index} ${measure.timeSig[0]}/${measure.timeSig[1]}` +
    `${flags ? ` ${flags}` : ''} [${measure.startTick}..${measure.endTick})`;

  return `${header}${tempo}${tuplets} :: ${measure.notes
    .map(serializeNote)
    .join(' | ')}`;
}

function parseFixture(fixture: Fixture): ChartParser {
  const buffer = fs.readFileSync(path.join(CHARTS_DIR, fixture.file));
  const chart = parseChartFile(new Uint8Array(buffer), fixture.format, {
    pro_drums: fixture.proDrums,
    five_lane_drums: fixture.fiveLaneDrums,
  }) as ParsedChart;

  return new ChartParser(chart, fixture.fiveLaneDrums, 'expert');
}

describe('golden master: real charts through scan-chart -> ChartParser', () => {
  FIXTURES.forEach((fixture) => {
    it(fixture.name, () => {
      const parser = parseFixture(fixture);
      const lines = parser.measures.map(serializeMeasure);

      expect({
        measureCount: parser.measures.length,
        endOfTrackTicks: parser.endOfTrackTicks,
        measures: lines,
      }).toMatchSnapshot();
    });
  });
});
