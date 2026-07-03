import { describe, it, expect } from 'vitest';
import { noteTypes, noteFlags } from 'scan-chart';
import { ChartParser } from './parser';
import { ParsedChart, Measure, Note } from './types';

type Ev = { type: number; flags?: number };

type GroupSpec = { tick: number; events: Ev[] };

const KICK: Ev = { type: noteTypes.kick };
const DOUBLE_KICK: Ev = { type: noteTypes.kick, flags: noteFlags.doubleKick };
const SNARE: Ev = { type: noteTypes.redDrum };
const TOM_YELLOW: Ev = { type: noteTypes.yellowDrum };
const TOM_BLUE: Ev = { type: noteTypes.blueDrum };
const TOM_GREEN: Ev = { type: noteTypes.greenDrum };
const HIHAT: Ev = { type: noteTypes.yellowDrum, flags: noteFlags.cymbal };
const CRASH: Ev = { type: noteTypes.greenDrum, flags: noteFlags.cymbal };
const BASE: { [duration: string]: number } = {
  w: 1,
  h: 1 / 2,
  q: 1 / 4,
  '8': 1 / 8,
  '16': 1 / 16,
  '32': 1 / 32,
  '64': 1 / 64,
};

function group(tick: number, ...events: Ev[]): GroupSpec {
  return { tick, events };
}

function makeChart(opts: {
  resolution?: number;
  timeSignatures?: { tick: number; numerator: number; denominator: number }[];
  groups?: GroupSpec[];
  tracks?: {
    instrument?: string;
    difficulty?: string;
    groups: GroupSpec[];
  }[];
}): ParsedChart {
  const tracks = opts.tracks ?? [
    { instrument: 'drums', difficulty: 'expert', groups: opts.groups ?? [] },
  ];

  return {
    resolution: opts.resolution ?? 192,
    timeSignatures: opts.timeSignatures ?? [],
    trackData: tracks.map((t) => ({
      instrument: t.instrument ?? 'drums',
      difficulty: t.difficulty ?? 'expert',
      noteEventGroups: t.groups.map((g) =>
        g.events.map((e) => ({
          tick: g.tick,
          type: e.type,
          flags: e.flags ?? 0,
          length: 0,
        })),
      ),
    })),
  } as unknown as ParsedChart;
}

function parse(opts: Parameters<typeof makeChart>[0], isFiveLane = false) {
  return new ChartParser(makeChart(opts), isFiveLane);
}

function tupletRatios(measure: Measure): Map<number, number> {
  const map = new Map<number, number>();

  measure.tuplets.forEach((t) => map.set(t.id, t.notesOccupied / t.numNotes));

  return map;
}

function noteFraction(note: Note, ratios: Map<number, number>): number {
  let fraction = BASE[note.duration] * (note.dots === 1 ? 1.5 : 1);

  if (note.tupletId !== undefined) {
    fraction *= ratios.get(note.tupletId) ?? 1;
  }

  return fraction;
}

function measureFilledFraction(measure: Measure): number {
  const ratios = tupletRatios(measure);

  return measure.notes.reduce(
    (sum, note) => sum + noteFraction(note, ratios),
    0,
  );
}

function expectedMeasureFraction(measure: Measure): number {
  const [numerator, denominator] = measure.timeSig;

  return numerator / denominator;
}

function hitKeys(measures: Measure[]): string[] {
  const keys: string[] = [];

  measures.forEach((measure) =>
    measure.notes.forEach((note) => {
      if (!note.isRest) {
        keys.push(...note.notes);
      }

      note.graceNotes?.forEach((chord) => keys.push(...chord));
    }),
  );

  return keys.sort();
}

function nonRest(measure: Measure): Note[] {
  return measure.notes.filter((note) => !note.isRest);
}

describe('ChartParser construction', () => {
  it('throws when there is no drum part at the difficulty', () => {
    expect(
      () =>
        new ChartParser(
          makeChart({
            tracks: [
              { instrument: 'guitar', difficulty: 'expert', groups: [] },
            ],
          }),
          false,
        ),
    ).toThrow('no drum part');
  });

  it('throws when the requested difficulty is absent', () => {
    expect(
      () =>
        new ChartParser(
          makeChart({
            tracks: [{ instrument: 'drums', difficulty: 'hard', groups: [] }],
          }),
          false,
          'expert',
        ),
    ).toThrow('no drum part');
  });

  it('selects the requested difficulty track', () => {
    const chart = makeChart({
      tracks: [
        {
          instrument: 'drums',
          difficulty: 'expert',
          groups: [group(0, SNARE)],
        },
        { instrument: 'drums', difficulty: 'easy', groups: [group(0, KICK)] },
      ],
    });
    const parser = new ChartParser(chart, false, 'easy');

    expect(hitKeys(parser.measures)).toEqual(['f/4']);
  });

  it('reports endOfTrackTicks as the last tick plus one', () => {
    const parser = parse({ groups: [group(0, SNARE), group(500, SNARE)] });

    expect(parser.endOfTrackTicks).toBe(501);
  });

  it('reports endOfTrackTicks of zero for an empty track', () => {
    const parser = parse({ groups: [] });

    expect(parser.endOfTrackTicks).toBe(0);
    expect(parser.measures).toEqual([]);
  });
});

describe('measure creation', () => {
  it('defaults to 4/4 when no time signatures are present', () => {
    const parser = parse({ groups: [group(0, SNARE)] });

    expect(parser.measures).toHaveLength(1);
    expect(parser.measures[0].timeSig).toEqual([4, 4]);
    expect(parser.measures[0].startTick).toBe(0);
    expect(parser.measures[0].endTick).toBe(768);
  });

  it('marks only the first measure with a clef', () => {
    const parser = parse({
      resolution: 192,
      groups: [group(0, SNARE), group(768, SNARE)],
    });

    expect(parser.measures).toHaveLength(2);
    expect(parser.measures[0].hasClef).toBe(true);
    expect(parser.measures[1].hasClef).toBe(false);
  });

  it('chains measure start/end ticks contiguously', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(768, SNARE), group(1536, SNARE)],
    });

    expect(parser.measures.map((m) => [m.startTick, m.endTick])).toEqual([
      [0, 768],
      [768, 1536],
      [1536, 2304],
    ]);
  });

  it('creates measures across a time-signature change and flags it', () => {
    const parser = parse({
      timeSignatures: [
        { tick: 0, numerator: 4, denominator: 4 },
        { tick: 768, numerator: 3, denominator: 4 },
      ],
      groups: [group(0, SNARE), group(768, SNARE), group(960, SNARE)],
    });
    const sigs = parser.measures.map((m) => ({
      timeSig: m.timeSig,
      sigChange: m.sigChange,
      start: m.startTick,
      end: m.endTick,
    }));

    expect(sigs).toEqual([
      { timeSig: [4, 4], sigChange: true, start: 0, end: 768 },
      { timeSig: [3, 4], sigChange: true, start: 768, end: 768 + 576 },
    ]);
  });

  it('handles a compound 6/8 meter', () => {
    const parser = parse({
      resolution: 192,
      timeSignatures: [{ tick: 0, numerator: 6, denominator: 8 }],
      groups: [group(0, SNARE)],
    });

    expect(parser.measures).toHaveLength(1);

    const measure = parser.measures[0];

    expect(measure.isCompound).toBe(true);
    expect(measure.startTick).toBe(0);
    expect(measure.endTick).toBe(576);
  });
});

describe('drum key mapping', () => {
  it('maps a four-lane chord to sorted staff keys', () => {
    const parser = parse({ groups: [group(0, KICK, SNARE, HIHAT, CRASH)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits).toHaveLength(1);
    expect(hits[0].notes).toEqual(['f/4', 'c/5', 'g/5/x2', 'a/5/x2']);
  });

  it('distinguishes toms from cymbals in four-lane mode', () => {
    const parser = parse({
      groups: [
        group(0, TOM_YELLOW),
        group(192, TOM_BLUE),
        group(384, TOM_GREEN),
      ],
    });

    expect(hitKeys(parser.measures)).toEqual(['a/4', 'd/5', 'e/5']);
  });

  it('maps five-lane colours differently', () => {
    const parser = parse(
      {
        groups: [group(0, TOM_YELLOW), group(192, TOM_BLUE), group(384, CRASH)],
      },
      true,
    );

    expect(hitKeys(parser.measures)).toEqual(['a/5/x2', 'd/5', 'g/5/x2']);
  });

  it('honours the tom/cymbal flag on the five-lane green note type', () => {
    const parser = parse(
      {
        groups: [
          group(0, { type: noteTypes.greenDrum, flags: noteFlags.tom }),
          group(192, CRASH),
        ],
      },
      true,
    );

    expect(hitKeys(parser.measures)).toEqual(['a/4', 'a/5/x2']);
  });

  it('maps a double kick to its own staff position', () => {
    const parser = parse({ groups: [group(0, DOUBLE_KICK)] });

    expect(hitKeys(parser.measures)).toEqual(['e/4']);
  });
});

describe('rhythm notation', () => {
  it('notates four on-grid quarter notes literally with no rests or tuplets', () => {
    const parser = parse({
      groups: [
        group(0, SNARE),
        group(192, SNARE),
        group(384, SNARE),
        group(576, SNARE),
      ],
    });
    const measure = parser.measures[0];

    expect(measure.tuplets).toEqual([]);
    expect(measure.notes).toHaveLength(4);
    expect(measure.notes.every((n) => n.duration === 'q' && !n.isRest)).toBe(
      true,
    );
  });

  it('notates straight eighth notes within a beat', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(96, SNARE)],
    });
    const measure = parser.measures[0];
    const beatOne = measure.notes.filter((n) => n.tick < 192 && !n.isRest);

    expect(beatOne).toHaveLength(2);
    expect(beatOne.every((n) => n.duration === '8')).toBe(true);
    expect(measure.tuplets).toEqual([]);
  });

  it('notates an eighth-note triplet as a 3:2 tuplet', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(64, SNARE), group(128, SNARE)],
    });
    const measure = parser.measures[0];

    expect(measure.tuplets).toHaveLength(1);
    expect(measure.tuplets[0]).toMatchObject({ numNotes: 3, notesOccupied: 2 });

    const tripletNotes = measure.notes.filter(
      (n) => n.tupletId === measure.tuplets[0].id,
    );

    expect(tripletNotes).toHaveLength(3);
    expect(tripletNotes.every((n) => n.duration === '8')).toBe(true);
  });

  it('notates a sixteenth-note quintuplet as a 5:4 tuplet', () => {
    const spacing = 192 / 5;
    const parser = parse({
      groups: [0, 1, 2, 3, 4].map((i) => group(Math.round(i * spacing), SNARE)),
    });
    const measure = parser.measures[0];

    expect(measure.tuplets).toHaveLength(1);
    expect(measure.tuplets[0]).toMatchObject({ numNotes: 5, notesOccupied: 4 });
  });

  it('keeps a partially filled sextuplet on its grid instead of snapping to sixteenths', () => {
    const parser = parse({
      groups: [
        group(0, SNARE),
        group(64, SNARE),
        group(96, SNARE),
        group(128, SNARE),
      ],
    });
    const measure = parser.measures[0];

    expect(nonRest(measure).map((n) => n.tick)).toEqual([0, 64, 96, 128]);
    expect(measure.tuplets.some((t) => t.numNotes === 6)).toBe(true);
  });

  it('places thirty-second-triplet onsets exactly without displacing them', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(160, SNARE), group(176, SNARE)],
    });
    const ticks = nonRest(parser.measures[0]).map((n) => n.tick);

    expect(ticks).toContain(160);
    expect(ticks).toContain(176);
  });

  it('fills an empty measure with a single whole rest', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(1536, SNARE)],
    });
    const empty = parser.measures[1];

    expect(empty.notes).toEqual([
      {
        notes: ['b/4'],
        duration: 'w',
        dots: 0,
        isRest: true,
        tick: 768,
      },
    ]);
  });

  it('puts a leading rest before an onset on beat two', () => {
    const parser = parse({ groups: [group(192, SNARE)] });
    const measure = parser.measures[0];
    const firstHit = nonRest(measure)[0];

    expect(firstHit.tick).toBe(192);
    expect(measure.notes[0].isRest).toBe(true);
    expect(measure.notes[0].tick).toBe(0);
  });
});

describe('coincidence resolution', () => {
  it('merges different drums at the same tick into one chord', () => {
    const parser = parse({ groups: [group(0, KICK, SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits).toHaveLength(1);
    expect(hits[0].notes).toEqual(['f/4', 'c/5']);
    expect(hits[0].graceNotes).toBeUndefined();
  });

  it('turns a same-drum repeat that is too close into a flam grace note', () => {
    const parser = parse({ groups: [group(0, SNARE), group(5, SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits).toHaveLength(1);
    expect(hits[0].notes).toEqual(['c/5']);
    expect(hits[0].graceNotes).toEqual([['c/5']]);
  });

  it('keeps every hit when collapsing a dense cluster', () => {
    const parser = parse({
      groups: [
        group(0, KICK),
        group(3, SNARE),
        group(6, KICK),
        group(9, SNARE),
      ],
    });

    expect(hitKeys(parser.measures)).toEqual(['c/5', 'c/5', 'f/4', 'f/4']);
  });
});

describe('dynamics', () => {
  const ACCENT_SNARE: Ev = {
    type: noteTypes.redDrum,
    flags: noteFlags.accent,
  };
  const GHOST_SNARE: Ev = { type: noteTypes.redDrum, flags: noteFlags.ghost };

  it('marks an accented hit', () => {
    const parser = parse({ groups: [group(0, ACCENT_SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits[0].accents).toEqual(['c/5']);
    expect(hits[0].ghosts).toBeUndefined();
  });

  it('marks a ghost hit', () => {
    const parser = parse({ groups: [group(0, GHOST_SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits[0].ghosts).toEqual(['c/5']);
    expect(hits[0].accents).toBeUndefined();
  });

  it('marks only the flagged key in a chord', () => {
    const parser = parse({ groups: [group(0, KICK, ACCENT_SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits[0].notes).toEqual(['f/4', 'c/5']);
    expect(hits[0].accents).toEqual(['c/5']);
  });

  it('leaves an unflagged hit without dynamics', () => {
    const parser = parse({ groups: [group(0, SNARE)] });
    const hits = nonRest(parser.measures[0]);

    expect(hits[0].accents).toBeUndefined();
    expect(hits[0].ghosts).toBeUndefined();
  });

  it('keeps the dynamic of the main hit when collapsing a flam', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(5, ACCENT_SNARE)],
    });
    const hits = nonRest(parser.measures[0]);

    expect(hits[0].graceNotes).toEqual([['c/5']]);
    expect(hits[0].accents).toEqual(['c/5']);
  });
});

describe('beat bucketing tolerance', () => {
  it('snaps an onset just before a beat boundary onto the next beat', () => {
    const parser = parse({ groups: [group(188, SNARE)] });
    const hit = nonRest(parser.measures[0])[0];

    expect(hit.tick).toBe(192);
  });

  it('snaps an onset just before a measure boundary into the next measure', () => {
    const parser = parse({
      groups: [group(0, SNARE), group(764, SNARE), group(1000, SNARE)],
    });

    expect(nonRest(parser.measures[0]).map((n) => n.tick)).toEqual([0]);
    expect(nonRest(parser.measures[1])[0].tick).toBe(768);
  });
});

describe('structural invariants', () => {
  const charts: { name: string; opts: Parameters<typeof makeChart>[0] }[] = [
    {
      name: 'straight quarters',
      opts: {
        groups: [
          group(0, SNARE),
          group(192, KICK),
          group(384, SNARE),
          group(576, KICK),
        ],
      },
    },
    {
      name: 'sixteenth run',
      opts: {
        groups: [0, 48, 96, 144, 192, 240, 288, 336].map((t) =>
          group(t, t % 96 === 0 ? SNARE : HIHAT),
        ),
      },
    },
    {
      name: 'triplets and duplets mixed',
      opts: {
        groups: [
          group(0, SNARE),
          group(64, SNARE),
          group(128, SNARE),
          group(192, KICK),
          group(288, KICK),
        ],
      },
    },
    {
      name: 'compound 6/8',
      opts: {
        timeSignatures: [{ tick: 0, numerator: 6, denominator: 8 }],
        groups: [
          group(0, KICK),
          group(96, HIHAT),
          group(192, HIHAT),
          group(288, SNARE),
        ],
      },
    },
    {
      name: 'off-grid humanized',
      opts: {
        groups: [
          group(3, SNARE),
          group(190, KICK),
          group(389, SNARE),
          group(580, KICK),
        ],
      },
    },
    {
      name: '3/4 with syncopation',
      opts: {
        timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
        groups: [group(0, SNARE), group(96, KICK), group(288, SNARE)],
      },
    },
  ];

  charts.forEach(({ name, opts }) => {
    describe(name, () => {
      it('preserves every charted hit', () => {
        const parser = parse(opts);
        const input = (opts.groups ?? [])
          .flatMap((g) => g.events.map((e) => e))
          .map((e) => keyFor(e))
          .sort();

        expect(hitKeys(parser.measures)).toEqual(input);
      });

      it('fills each measure to exactly its time-signature duration', () => {
        const parser = parse(opts);

        parser.measures.forEach((measure) => {
          expect(measureFilledFraction(measure)).toBeCloseTo(
            expectedMeasureFraction(measure),
            6,
          );
        });
      });

      it('keeps notes ordered and inside their measure', () => {
        const parser = parse(opts);

        parser.measures.forEach((measure) => {
          let last = -Infinity;

          measure.notes.forEach((note) => {
            expect(note.tick).toBeGreaterThanOrEqual(last);
            expect(note.tick).toBeGreaterThanOrEqual(measure.startTick);
            expect(note.tick).toBeLessThan(measure.endTick);
            last = note.tick;
          });
        });
      });

      it('references a real tuplet for every note carrying a tuplet id', () => {
        const parser = parse(opts);

        parser.measures.forEach((measure) => {
          const ids = new Set(measure.tuplets.map((t) => t.id));

          measure.notes.forEach((note) => {
            if (note.tupletId !== undefined) {
              expect(ids.has(note.tupletId)).toBe(true);
            }
          });
        });
      });
    });
  });
});

function keyFor(ev: Ev): string {
  if (ev.type === noteTypes.kick) {
    return ev.flags && ev.flags & noteFlags.doubleKick ? 'e/4' : 'f/4';
  }

  if (ev.type === noteTypes.redDrum) {
    return 'c/5';
  }

  if (ev.type === noteTypes.yellowDrum) {
    return ev.flags && ev.flags & noteFlags.cymbal ? 'g/5/x2' : 'e/5';
  }

  if (ev.type === noteTypes.blueDrum) {
    return ev.flags && ev.flags & noteFlags.cymbal ? 'f/5/x2' : 'd/5';
  }

  return ev.flags && ev.flags & noteFlags.cymbal ? 'a/5/x2' : 'a/4';
}
