import { describe, it, expect } from 'vitest';
import { ChartParser } from '../../../chart-parser/parser';
import {
  parseDsl,
  buildParsedChartFromDsl,
  serializeMeasureToDsl,
} from './helpers';

function keysOf(parser: ChartParser): string[] {
  return parser.measures.flatMap((m) =>
    m.notes.filter((n) => !n.isRest).flatMap((n) => n.notes),
  );
}

describe('parseDsl', () => {
  it('reads resolution, time signature, and cells; ignores comments', () => {
    const blocks = parseDsl(`
# a labelled block
res=192 ts=3/4
0 kick snare
64 yellow:tom
`);

    expect(blocks).toEqual([
      {
        resolution: 192,
        timeSig: [3, 4],
        hits: [
          {
            tick: 0,
            cells: [
              { lane: 'kick', tom: false },
              { lane: 'snare', tom: false },
            ],
          },
          { tick: 64, cells: [{ lane: 'yellow', tom: true }] },
        ],
      },
    ]);
  });

  it('throws when a block has no resolution', () => {
    expect(() => parseDsl('ts=4/4\n0 snare')).toThrow(/missing res=/);
  });
});

describe('buildParsedChartFromDsl', () => {
  it('scales every block to the lcm of resolutions', () => {
    const chart = buildParsedChartFromDsl(`
res=192 ts=4/4
16 snare

res=480 ts=4/4
0 snare
`);

    expect(chart.resolution).toBe(960);

    const ticks = chart.trackData[0].noteEventGroups.map((g) => g[0].tick);

    expect(ticks).toContain(80);
    expect(ticks).toContain(960 * 4);
  });

  it('renders a bare cymbal lane as a cymbal and :tom as a tom', () => {
    const cymbal = new ChartParser(
      buildParsedChartFromDsl('res=480 ts=4/4\n0 yellow'),
      false,
    );
    const tomHit = new ChartParser(
      buildParsedChartFromDsl('res=480 ts=4/4\n0 yellow:tom'),
      false,
    );

    expect(keysOf(cymbal)).toContain('g/5/x2');
    expect(keysOf(tomHit)).toContain('e/5');
  });
});

describe('round-trip', () => {
  it('serializes each parsed measure back to its source block', () => {
    const dsl = [
      'res=480 ts=4/4',
      '0 snare',
      '160 snare',
      '320 snare',
      '',
      'res=480 ts=3/4',
      '0 kick',
      '240 snare blue',
    ].join('\n');
    const chart = buildParsedChartFromDsl(dsl);
    const parser = new ChartParser(chart, false);
    const emitted = parser.measures.map((m) => serializeMeasureToDsl(chart, m));

    expect(emitted).toEqual([
      'res=480 ts=4/4\n0 snare\n160 snare\n320 snare',
      'res=480 ts=3/4\n0 kick\n240 snare blue',
    ]);
  });
});
