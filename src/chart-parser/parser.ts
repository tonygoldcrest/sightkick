import { Difficulty, noteFlags, type NoteEvent } from 'scan-chart';
import { ParsedChart, Measure, Note, TupletMeta } from './types';
import { noteToKey } from './utils';

const DEFAULT_BPM = 120;

/**
 * Clone Hero drum midi -> sheet music model.
 *
 * Every charted gem is a zero-length midi event, so rhythm has to be
 * inferred. The pipeline:
 *
 *  1. Map midi pitches to drum staff keys (applying pro-drums tom markers).
 *     Drum notation puts everything on one voice with stems down, so kicks,
 *     snares, toms and cymbals that share a tick become a single chord.
 *  2. Build measures/beats from the time signature track.
 *  3. Per beat, collapse hits too close to separate without ever dropping one:
 *     different drums become a chord, the same drum a flam (earlier hit kept as
 *     a grace note). This guarantees the remaining onsets are separable.
 *  4. Notate each beat by generating candidate notations — every whole-beat
 *     subdivision (straight, triplet, quintuplet, septuplet, ...) plus recursive
 *     half-splits — and picking the lowest `complexity + λ·distortion`. An exact
 *     chart reproduces literally (zero distortion); a messy off-grid chart is
 *     regularized only when that buys enough readability. Tuplet groups are
 *     emitted as explicit metadata.
 */

interface Onset {
  tick: number;
  keys: string[];
  accents?: string[];
  ghosts?: string[];
  graceNotes?: string[][];
}

interface Meter {
  beatsPerMeasure: number;
  beatTicks: number;
  beatFraction: number;
  isCompound: boolean;
}

interface NotationInfo {
  notatedDivisor: number;
  tuplet: { numNotes: number; notesOccupied: number } | null;
}

/**
 * One way to notate a span: notes/rests plus the tuplet groups they belong to.
 * `complexity` (how busy/ugly the result looks) and `dispSum` (how far onsets
 * were moved from their literal ticks) feed the cost function; the lowest-cost
 * candidate for a span wins.
 */
interface Candidate {
  events: Note[];
  tuplets: TupletMeta[];
  complexity: number;
  dispSum: number;
  onsetCount: number;
}

interface BeatLocation {
  measureIndex: number;
  beatIndex: number;
}

const REST_KEY = 'b/4';
// Whole-span subdivisions offered in a simple (non-compound) meter, keyed by the
// number of slots. `notatedDivisor` is the binary value the written notes are
// drawn from; the remaining scaling is carried by the tuplet ratio.
const SIMPLE_DIVISORS: { [slots: number]: NotationInfo } = {
  1: { notatedDivisor: 1, tuplet: null },
  2: { notatedDivisor: 2, tuplet: null },
  3: { notatedDivisor: 2, tuplet: { numNotes: 3, notesOccupied: 2 } },
  4: { notatedDivisor: 4, tuplet: null },
  5: { notatedDivisor: 4, tuplet: { numNotes: 5, notesOccupied: 4 } },
  6: { notatedDivisor: 4, tuplet: { numNotes: 6, notesOccupied: 4 } },
  7: { notatedDivisor: 4, tuplet: { numNotes: 7, notesOccupied: 4 } },
  8: { notatedDivisor: 8, tuplet: null },
  16: { notatedDivisor: 16, tuplet: null },
};
// Whole-span subdivisions in a compound (dotted-beat) meter. Dividing a dotted
// value by these yields plain/dotted durations, so no tuplets are needed.
const COMPOUND_DIVISORS: { [slots: number]: NotationInfo } = {
  1: { notatedDivisor: 1, tuplet: null },
  2: { notatedDivisor: 2, tuplet: null },
  3: { notatedDivisor: 3, tuplet: null },
  4: { notatedDivisor: 4, tuplet: null },
  6: { notatedDivisor: 6, tuplet: null },
  12: { notatedDivisor: 12, tuplet: null },
};
// Cost-function weights — the "look and feel" knobs. A candidate's cost is
// `complexity + LAMBDA · meanDistortion`. Complexity sums filler rests wedged
// between hits, sub-16th note values, distinct durations, and raw symbol count;
// distortion is the mean tick displacement of onsets from their literal
// positions as a fraction of a beat. "Prefer the original unless it's a mess"
// falls out for free: an exact chart has zero distortion and minimal complexity,
// so it always wins; a messy literal reading only loses when a simpler grid is
// cheap enough to justify the movement.
const W_FILL = 3.0;
const W_FINE = 2.0;
const W_VAR = 1.0;
const W_EVT = 0.5;
const W_SPLIT = 0.5;
const LAMBDA = 35;
const TUPLET_DISTORTION_WEIGHT = 3;
const BASE_DURATIONS: Array<[number, string]> = [
  [1, 'w'],
  [1 / 2, 'h'],
  [1 / 4, 'q'],
  [1 / 8, '8'],
  [1 / 16, '16'],
  [1 / 32, '32'],
  [1 / 64, '64'],
];
// Note/rest value sizes (in grid slots) we are willing to merge into a single
// written duration, largest first.
const CHUNK_SIZES = [16, 12, 8, 6, 4, 3, 2, 1];
const KEY_LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

function approxEqual(a: number, b: number) {
  return Math.abs(a - b) < Math.max(a, b) * 1e-9;
}

/**
 * Express a fraction of a whole note as a single written duration, if
 * possible: either a plain binary value or a single-dotted one.
 */
function namedDuration(
  fraction: number,
): { duration: string; dots: number } | null {
  const match = BASE_DURATIONS.find(
    ([base]) =>
      approxEqual(fraction, base) || approxEqual(fraction, base * 1.5),
  );

  if (!match) {
    return null;
  }

  return {
    duration: match[1],
    dots: approxEqual(fraction, match[0]) ? 0 : 1,
  };
}

function isPowerOfTwo(value: number) {
  return Number.isInteger(Math.log2(value));
}

/**
 * The slot index multiple a chunk of the given size must start on. Binary
 * chunks sit on multiples of their own size, dotted chunks (3·2^k slots) on
 * multiples of 2^(k+1) — e.g. a dotted eighth among 16ths can start on the
 * beat or on the "and", but not on an off 16th.
 */
function chunkAlignment(size: number) {
  return isPowerOfTwo(size) ? size : (size / 3) * 2;
}

/**
 * Greedily split `span` grid slots starting at `startSlot` into the fewest
 * metrically aligned written durations. `slotFraction` is the written value
 * of one slot as a fraction of a whole note.
 */
function chunkSpan(
  startSlot: number,
  span: number,
  slotFraction: number,
  allowDotted: boolean,
): number[] {
  const fits = (candidate: number, position: number, remaining: number) => {
    if (candidate > remaining || position % chunkAlignment(candidate)) {
      return false;
    }

    const named = namedDuration(candidate * slotFraction);

    return named !== null && (allowDotted || named.dots === 0);
  };
  const chunks: number[] = [];
  let position = startSlot;
  let remaining = span;

  while (remaining > 0) {
    const currentPosition = position;
    const currentRemaining = remaining;
    const size =
      CHUNK_SIZES.find((candidate) =>
        fits(candidate, currentPosition, currentRemaining),
      ) ?? 1;

    chunks.push(size);
    position += size;
    remaining -= size;
  }

  return chunks;
}

function keyPitch(key: string) {
  const [letter, octave] = key.split('/');

  return Number(octave) * 7 + KEY_LETTERS.indexOf(letter);
}

function sortKeys(keys: string[]) {
  return [...new Set(keys)].sort((a, b) => keyPitch(a) - keyPitch(b));
}

/**
 * Collapse the onsets of one beat that fall in the same finest-resolution slot,
 * without ever dropping a hit. Two onsets too close to separate become either a
 * chord (different drums — meant to be simultaneous) or a flam (same drum — the
 * earlier hit is kept as a grace note on the later one). After this every
 * returned onset occupies a distinct finest-grid slot, so the grid fitter can
 * always give each its own position. `finestDivisions` is the finest subdivision
 * the meter offers (the resolution floor).
 */
function resolveNearCoincidence(
  onsets: Onset[],
  beatStart: number,
  beatTicks: number,
  finestDivisions: number,
): Onset[] {
  const spacing = beatTicks / finestDivisions;
  const slotOf = (tick: number) =>
    Math.min(
      finestDivisions - 1,
      Math.max(0, Math.round((tick - beatStart) / spacing)),
    );
  const clusters: Onset[][] = [];

  onsets.forEach((onset) => {
    const last = clusters[clusters.length - 1];

    if (last && slotOf(last[0].tick) === slotOf(onset.tick)) {
      last.push(onset);
    } else {
      clusters.push([onset]);
    }
  });

  return clusters.map(resolveCluster);
}

function resolveCluster(cluster: Onset[]): Onset {
  if (cluster.length === 1) {
    return cluster[0];
  }

  const occurrences = cluster.flatMap((onset) =>
    onset.keys.map((key) => ({
      tick: onset.tick,
      key,
      accent: onset.accents?.includes(key) ?? false,
      ghost: onset.ghosts?.includes(key) ?? false,
    })),
  );
  // For each drum, its latest occurrence is the main hit; earlier repeats of the
  // same drum become grace notes.
  const lastTickByKey = new Map<string, number>();

  occurrences.forEach(({ tick, key }) => {
    lastTickByKey.set(key, Math.max(lastTickByKey.get(key) ?? -Infinity, tick));
  });

  const accents = new Set<string>();
  const ghosts = new Set<string>();

  occurrences.forEach(({ tick, key, accent, ghost }) => {
    if (tick === lastTickByKey.get(key)) {
      if (accent) {
        accents.add(key);
      }

      if (ghost) {
        ghosts.add(key);
      }
    }
  });

  const graceByTick = new Map<number, Set<string>>();

  occurrences.forEach(({ tick, key }) => {
    if (tick < (lastTickByKey.get(key) as number)) {
      const keys = graceByTick.get(tick) ?? new Set<string>();

      keys.add(key);
      graceByTick.set(tick, keys);
    }
  });

  const graceNotes = [...graceByTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, keys]) => sortKeys([...keys]));

  return {
    tick: cluster[cluster.length - 1].tick,
    keys: sortKeys([...lastTickByKey.keys()]),
    accents: accents.size > 0 ? [...accents] : undefined,
    ghosts: ghosts.size > 0 ? [...ghosts] : undefined,
    graceNotes: graceNotes.length > 0 ? graceNotes : undefined,
  };
}

function makeMeter(timeSig: [number, number], ppq: number): Meter {
  const [numerator, denominator] = timeSig;
  const pulseTicks = (ppq * 4) / denominator;
  const isCompound = denominator >= 8 && numerator >= 6 && numerator % 3 === 0;
  const beatsPerMeasure = isCompound ? numerator / 3 : numerator;
  const beatTicks = isCompound ? pulseTicks * 3 : pulseTicks;

  return {
    beatsPerMeasure,
    beatTicks,
    beatFraction: beatTicks / (ppq * 4),
    isCompound,
  };
}

function halvingsPast16th(duration: string): number {
  if (duration === '32') {
    return 1;
  }

  if (duration === '64') {
    return 2;
  }

  return 0;
}

/** How busy/ugly a notated span looks; higher is worse. */
function complexityOf(events: Note[]): number {
  let filler = 0;
  let fine = 0;
  const values = new Set<string>();

  events.forEach((event, index) => {
    // A rest is "filler" if it is wedged between hits (a hit before and after);
    // leading and trailing rests are real silence, not clutter.
    if (
      event.isRest &&
      events.slice(0, index).some((e) => !e.isRest) &&
      events.slice(index + 1).some((e) => !e.isRest)
    ) {
      filler += 1;
    }

    fine += halvingsPast16th(event.duration);
    values.add(`${event.duration}.${event.dots}`);
  });

  return (
    W_FILL * filler +
    W_FINE * fine +
    W_VAR * Math.max(0, values.size - 1) +
    W_EVT * events.length
  );
}

function candidateCost(candidate: Candidate, beatTicks: number): number {
  const distortion = candidate.onsetCount
    ? candidate.dispSum / candidate.onsetCount / beatTicks
    : 0;
  const distortionWeight =
    candidate.tuplets.length > 0 ? LAMBDA * TUPLET_DISTORTION_WEIGHT : LAMBDA;

  return candidate.complexity + distortionWeight * distortion;
}

function restFill(startTick: number, fraction: number): Candidate {
  const named = namedDuration(fraction) ?? { duration: 'q', dots: 0 };

  return {
    events: [
      {
        notes: [REST_KEY],
        duration: named.duration,
        dots: named.dots,
        isRest: true,
        tick: Math.round(startTick),
      },
    ],
    tuplets: [],
    complexity: 0,
    dispSum: 0,
    onsetCount: 0,
  };
}

/**
 * Notate a span on a single uniform grid of `divisions` slots. Returns null if
 * the grid can't represent the span (two onsets land in one slot, or the slot
 * value isn't a writable duration). Each note tiles up to the next onset's slot,
 * so there are no filler rests beyond what an awkward gap forces.
 */
function buildGrid(
  onsets: Onset[],
  startTick: number,
  durationTicks: number,
  fraction: number,
  divisions: number,
  info: NotationInfo,
  nextId: () => number,
): Candidate | null {
  const slotFraction = fraction / info.notatedDivisor;

  if (!namedDuration(slotFraction)) {
    return null;
  }

  const spacing = durationTicks / divisions;
  const slotOf = (tick: number) =>
    Math.min(
      divisions - 1,
      Math.max(0, Math.round((tick - startTick) / spacing)),
    );
  const slots = onsets.map((onset) => slotOf(onset.tick));

  if (new Set(slots).size !== slots.length) {
    return null;
  }

  const occupants = new Map<number, Onset>();
  let dispSum = 0;

  slots.forEach((slot, index) => {
    occupants.set(slot, onsets[index]);
    dispSum += Math.abs(startTick + slot * spacing - onsets[index].tick);
  });

  const boundaries = [...new Set([0, ...slots])].sort((a, b) => a - b);
  const events: Note[] = [];

  boundaries.forEach((boundary, index) => {
    const next = boundaries[index + 1] ?? divisions;
    const onset = occupants.get(boundary);
    let slot = boundary;

    chunkSpan(boundary, next - boundary, slotFraction, true).forEach(
      (size, chunkIndex) => {
        const named = namedDuration(size * slotFraction);

        if (named) {
          const isRest = !onset || chunkIndex > 0;

          events.push({
            notes: isRest ? [REST_KEY] : sortKeys(onset.keys),
            duration: named.duration,
            dots: named.dots,
            isRest,
            tick: Math.round(startTick + slot * spacing),
            graceNotes: isRest ? undefined : onset.graceNotes,
            accents: isRest ? undefined : onset.accents,
            ghosts: isRest ? undefined : onset.ghosts,
          });
        }

        slot += size;
      },
    );
  });

  const tuplets: TupletMeta[] = [];

  if (info.tuplet && events.length > 1) {
    const id = nextId();

    events.forEach((event) => {
      event.tupletId = id;
    });
    tuplets.push({
      id,
      numNotes: info.tuplet.numNotes,
      notesOccupied: info.tuplet.notesOccupied,
    });
  }

  return {
    events,
    tuplets,
    complexity: complexityOf(events),
    dispSum,
    onsetCount: onsets.length,
  };
}

/**
 * Best notation of one span: try every whole-span grid the meter offers, plus a
 * recursive split into halves, and keep the lowest-cost candidate. Completeness
 * is structural — every candidate gives each onset its own slot, so a note is
 * never dropped regardless of which candidate wins.
 */
function notateSpan(
  onsets: Onset[],
  startTick: number,
  durationTicks: number,
  fraction: number,
  divisors: { [slots: number]: NotationInfo },
  minSpacing: number,
  beatTicks: number,
  allowSplit: boolean,
  nextId: () => number,
): Candidate {
  if (onsets.length === 0) {
    return restFill(startTick, fraction);
  }

  const candidates: Candidate[] = [];

  Object.keys(divisors).forEach((key) => {
    const divisions = Number(key);

    if (durationTicks / divisions < minSpacing - 1e-9) {
      return;
    }

    const info = divisors[divisions];

    // Only use a quintuplet/septuplet when the onsets actually fill it; a prime
    // tuplet held loosely (e.g. 6 even notes forced into a 7:4) is a misfit that
    // should decompose or use a binary grid instead.
    if (
      info.tuplet &&
      (divisions === 5 || divisions === 7) &&
      onsets.length < divisions
    ) {
      return;
    }

    const candidate = buildGrid(
      onsets,
      startTick,
      durationTicks,
      fraction,
      divisions,
      info,
      nextId,
    );

    if (candidate) {
      candidates.push(candidate);
    }
  });

  if (
    allowSplit &&
    onsets.length > 1 &&
    namedDuration(fraction / 2) &&
    durationTicks / 2 >= minSpacing - 1e-9
  ) {
    const mid = startTick + durationTicks / 2;
    const tolerance = durationTicks / 32;
    const left = onsets.filter((onset) => mid - onset.tick > tolerance);
    const right = onsets.filter((onset) => mid - onset.tick <= tolerance);
    const leftC = notateSpan(
      left,
      startTick,
      durationTicks / 2,
      fraction / 2,
      divisors,
      minSpacing,
      beatTicks,
      true,
      nextId,
    );
    const rightC = notateSpan(
      right,
      mid,
      durationTicks / 2,
      fraction / 2,
      divisors,
      minSpacing,
      beatTicks,
      true,
      nextId,
    );
    const events = [...leftC.events, ...rightC.events];

    candidates.push({
      events,
      tuplets: [...leftC.tuplets, ...rightC.tuplets],
      complexity: complexityOf(events) + W_SPLIT,
      dispSum: leftC.dispSum + rightC.dispSum,
      onsetCount: leftC.onsetCount + rightC.onsetCount,
    });
  }

  if (candidates.length === 0) {
    // Unreachable in practice: the resolver guarantees the finest grid separates
    // every onset. Fall back to it regardless of the spacing floor.
    const finest = Math.max(...Object.keys(divisors).map(Number));

    return (
      buildGrid(
        onsets,
        startTick,
        durationTicks,
        fraction,
        finest,
        divisors[finest],
        nextId,
      ) ?? restFill(startTick, fraction)
    );
  }

  return candidates.reduce((best, candidate) =>
    candidateCost(candidate, beatTicks) < candidateCost(best, beatTicks)
      ? candidate
      : best,
  );
}

interface RestValue {
  ticks: number;
  duration: string;
  dots: number;
  align: number; // the offset multiple this value may start on
}

// Rest durations largest-first, plain and single-dotted, for re-grouping a run
// of consecutive rests. A dotted value must start on a multiple of twice its
// base (a dotted quarter on a beat or the "and", not an off-beat).
function restValues(ppq: number): RestValue[] {
  const whole = ppq * 4;
  const bases: Array<[number, string]> = [
    [whole, 'w'],
    [whole / 2, 'h'],
    [whole / 4, 'q'],
    [whole / 8, '8'],
    [whole / 16, '16'],
    [whole / 32, '32'],
    [whole / 64, '64'],
  ];
  const values: RestValue[] = [];

  bases.forEach(([ticks, duration]) => {
    values.push({ ticks, duration, dots: 0, align: ticks });
    values.push({ ticks: ticks * 1.5, duration, dots: 1, align: ticks * 2 });
  });

  return values.sort((a, b) => b.ticks - a.ticks);
}

/**
 * Fill `[spanStart, spanEnd)` of silence with the fewest metrically legal rests.
 * Each rest must align to its own grid, and (in meters with an even number of
 * beats) may not cross the measure midpoint unless it starts at the barline —
 * so beats 2–3 of 4/4 stay two quarter rests rather than a half rest that hides
 * the downbeat of beat 3.
 */
function fillRestSpan(
  spanStart: number,
  spanEnd: number,
  measureStart: number,
  measureTicks: number,
  values: RestValue[],
  guardMid: boolean,
): Note[] {
  const mid = measureStart + measureTicks / 2;
  const out: Note[] = [];
  let pos = spanStart;
  let safety = 0;

  while (pos < spanEnd - 1e-6 && safety < 128) {
    safety += 1;

    const start = pos;
    const remaining = spanEnd - start;
    const offset = start - measureStart;
    const choice =
      values.find((value) => {
        if (value.ticks > remaining + 1e-6) {
          return false;
        }

        const m = offset % value.align;

        if (m > 1e-6 && value.align - m > 1e-6) {
          return false;
        }

        if (
          guardMid &&
          start < mid - 1e-6 &&
          start + value.ticks > mid + 1e-6 &&
          Math.abs(start - measureStart) > 1e-6
        ) {
          return false;
        }

        return true;
      }) ?? values[values.length - 1];

    out.push({
      notes: [REST_KEY],
      duration: choice.duration,
      dots: choice.dots,
      isRest: true,
      tick: Math.round(pos),
    });
    pos += choice.ticks;
  }

  return out;
}

/**
 * Re-group each maximal run of plain rests in a measure so consecutive rests
 * built by different parts of the pipeline (a silent beat next to a beat's
 * leading rest) combine into the fewest legal values. Rests that belong to a
 * tuplet are left untouched.
 */
function mergeMeasureRests(
  notes: Note[],
  measureStart: number,
  measureTicks: number,
  ppq: number,
  guardMid: boolean,
): Note[] {
  const values = restValues(ppq);
  const out: Note[] = [];
  let i = 0;

  while (i < notes.length) {
    const note = notes[i];

    if (note.isRest && note.tupletId === undefined) {
      let j = i;

      while (
        j < notes.length &&
        notes[j].isRest &&
        notes[j].tupletId === undefined
      ) {
        j += 1;
      }

      const spanEnd =
        j < notes.length ? notes[j].tick : measureStart + measureTicks;

      out.push(
        ...fillRestSpan(
          note.tick,
          spanEnd,
          measureStart,
          measureTicks,
          values,
          guardMid,
        ),
      );
      i = j;
    } else {
      out.push(note);
      i += 1;
    }
  }

  return out;
}

export class ChartParser {
  measures: Measure[] = [];

  endOfTrackTicks: number;

  private ppq: number;

  private meters: Meter[] = [];

  private nextTupletId = 0;

  constructor(
    chart: ParsedChart,
    isFiveLane: boolean,
    difficulty: Difficulty = 'expert',
  ) {
    const drumTrack = chart.trackData.find(
      (t) => t.instrument === 'drums' && t.difficulty === difficulty,
    );

    if (!drumTrack) {
      throw new Error('no drum part');
    }

    this.ppq = chart.resolution;

    const allTicks = drumTrack.noteEventGroups.flat().map((e) => e.tick);

    this.endOfTrackTicks = allTicks.length > 0 ? Math.max(...allTicks) + 1 : 0;

    const onsets = this.collectOnsets(drumTrack.noteEventGroups, isFiveLane);

    this.createMeasures(chart.timeSignatures);
    this.buildMeasures(onsets);
    this.assignTempos(chart.tempos);
  }

  private assignTempos(tempos: ParsedChart['tempos']) {
    const sorted = [...(tempos ?? [])].sort((a, b) => a.tick - b.tick);
    const tempoAt = (tick: number) => {
      let bpm = sorted[0]?.beatsPerMinute ?? DEFAULT_BPM;

      sorted.forEach((tempo) => {
        if (tempo.tick <= tick) {
          bpm = tempo.beatsPerMinute;
        }
      });

      return bpm;
    };
    let previousBpm: number | undefined;

    this.measures.forEach((measure, index) => {
      const quarterBpm = tempoAt(measure.startTick);

      if (previousBpm === undefined || !approxEqual(quarterBpm, previousBpm)) {
        const meter = this.meters[index];

        measure.tempo = {
          bpm:
            Math.round((meter.isCompound ? quarterBpm / 3 : quarterBpm) * 100) /
            100,
          duration: 'q',
          dots: meter.isCompound ? 1 : 0,
        };
      }

      previousBpm = quarterBpm;
    });
  }

  private collectOnsets(
    noteEventGroups: NoteEvent[][],
    isFiveLane: boolean,
  ): Onset[] {
    return noteEventGroups
      .map((group): Onset | null => {
        const tick = group[0]?.tick;

        if (tick === undefined) {
          return null;
        }

        const keys: string[] = [];
        const accents: string[] = [];
        const ghosts: string[] = [];

        group.forEach((e) => {
          const key = noteToKey(e.type, e.flags, isFiveLane);

          if (key === null) {
            return;
          }

          keys.push(key);

          if (e.flags & noteFlags.accent) {
            accents.push(key);
          }

          if (e.flags & noteFlags.ghost) {
            ghosts.push(key);
          }
        });

        return keys.length > 0
          ? {
              tick,
              keys,
              accents: accents.length > 0 ? accents : undefined,
              ghosts: ghosts.length > 0 ? ghosts : undefined,
            }
          : null;
      })
      .filter((o): o is Onset => o !== null);
  }

  private createMeasures(timeSignatures: ParsedChart['timeSignatures']) {
    const sigs =
      timeSignatures.length > 0
        ? timeSignatures
        : [{ tick: 0, numerator: 4, denominator: 4 }];
    let startTick = 0;

    sigs.forEach((sigData, index) => {
      const timeSig: [number, number] = [
        sigData.numerator,
        sigData.denominator,
      ];
      const meter = makeMeter(timeSig, this.ppq);
      const measureTicks = meter.beatsPerMeasure * meter.beatTicks;
      const sectionTicks =
        (sigs[index + 1]?.tick ?? this.endOfTrackTicks) - sigData.tick;
      const numberOfMeasures = Math.max(
        0,
        Math.ceil(sectionTicks / measureTicks - 1e-9),
      );

      for (let measure = 0; measure < numberOfMeasures; measure += 1) {
        this.measures.push({
          timeSig,
          hasClef: this.measures.length === 0,
          sigChange: measure === 0,
          isCompound: meter.isCompound,
          startTick,
          endTick: startTick + measureTicks,
          notes: [],
          tuplets: [],
        });
        this.meters.push(meter);
        startTick += measureTicks;
      }
    });
  }

  private buildMeasures(onsets: Onset[]) {
    if (this.measures.length === 0) {
      return;
    }

    const buckets = this.bucketOnsets(onsets);

    this.measures.forEach((measure, measureIndex) => {
      const meter = this.meters[measureIndex];
      const beatOnsets = buckets[measureIndex];

      if (beatOnsets.every((beat) => beat.length === 0)) {
        measure.notes = [
          {
            notes: [REST_KEY],
            duration: 'w',
            dots: 0,
            isRest: true,
            tick: measure.startTick,
          },
        ];
        measure.tuplets = [];

        return;
      }

      const { notes, tuplets } = this.buildMeasureNotes(
        measure,
        meter,
        beatOnsets,
      );

      measure.notes = mergeMeasureRests(
        notes,
        measure.startTick,
        measure.endTick - measure.startTick,
        this.ppq,
        meter.beatsPerMeasure % 2 === 0,
      );
      measure.tuplets = tuplets;
    });
  }

  /**
   * Distribute onsets into [measure][beat] buckets. An onset within a small
   * tolerance before a beat boundary belongs to the next beat — that catches
   * negative humanization jitter at beat and measure boundaries.
   */
  private bucketOnsets(onsets: Onset[]): Onset[][][] {
    const buckets = this.measures.map((_, measureIndex) =>
      new Array(this.meters[measureIndex].beatsPerMeasure)
        .fill(null)
        .map(() => [] as Onset[]),
    );

    onsets.forEach((onset) => {
      const { measureIndex, beatIndex } = this.findBeat(onset.tick);

      buckets[measureIndex][beatIndex].push(onset);
    });

    return buckets;
  }

  private findBeat(tick: number): BeatLocation {
    let low = 0;
    let high = this.measures.length - 1;
    let measureIndex = this.measures.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (this.measures[mid].startTick <= tick) {
        measureIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const measure = this.measures[measureIndex];
    const meter = this.meters[measureIndex];
    let beatIndex = Math.min(
      meter.beatsPerMeasure - 1,
      Math.max(0, Math.floor((tick - measure.startTick) / meter.beatTicks)),
    );
    const beatEnd = measure.startTick + (beatIndex + 1) * meter.beatTicks;

    if (beatEnd - tick <= meter.beatTicks / 32) {
      if (beatIndex + 1 < meter.beatsPerMeasure) {
        beatIndex += 1;
      } else if (measureIndex + 1 < this.measures.length) {
        return { measureIndex: measureIndex + 1, beatIndex: 0 };
      }
    }

    return { measureIndex, beatIndex };
  }

  private buildMeasureNotes(
    measure: Measure,
    meter: Meter,
    beatOnsets: Onset[][],
  ): { notes: Note[]; tuplets: TupletMeta[] } {
    const notes: Note[] = [];
    const tuplets: TupletMeta[] = [];
    const divisors = meter.isCompound ? COMPOUND_DIVISORS : SIMPLE_DIVISORS;
    const finest = Math.max(...Object.keys(divisors).map(Number));
    const minSpacing = meter.beatTicks / finest;
    const nextId = () => {
      const id = this.nextTupletId;

      this.nextTupletId += 1;

      return id;
    };
    let beatIndex = 0;

    while (beatIndex < meter.beatsPerMeasure) {
      if (beatOnsets[beatIndex].length === 0) {
        let run = 1;

        while (
          beatIndex + run < meter.beatsPerMeasure &&
          beatOnsets[beatIndex + run].length === 0
        ) {
          run += 1;
        }

        // Collapse the run of silent beats into as few rests as the meter
        // allows. Dotted rests read poorly in simple meters but are the norm
        // in compound ones.
        let slot = beatIndex;

        chunkSpan(beatIndex, run, meter.beatFraction, meter.isCompound).forEach(
          (size) => {
            const named = namedDuration(size * meter.beatFraction);

            if (named) {
              notes.push({
                notes: [REST_KEY],
                duration: named.duration,
                dots: named.dots,
                isRest: true,
                tick: Math.round(measure.startTick + slot * meter.beatTicks),
              });
            }

            slot += size;
          },
        );
        beatIndex += run;
      } else {
        const beatStart = measure.startTick + beatIndex * meter.beatTicks;
        const resolved = resolveNearCoincidence(
          beatOnsets[beatIndex],
          beatStart,
          meter.beatTicks,
          finest,
        );
        const candidate = notateSpan(
          resolved,
          beatStart,
          meter.beatTicks,
          meter.beatFraction,
          divisors,
          minSpacing,
          meter.beatTicks,
          !meter.isCompound,
          nextId,
        );

        notes.push(...candidate.events);
        tuplets.push(...candidate.tuplets);
        beatIndex += 1;
      }
    }

    return { notes, tuplets };
  }
}
