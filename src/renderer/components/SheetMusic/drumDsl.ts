import { noteTypes, noteFlags } from 'scan-chart';
import { ParsedChart, Measure } from '../../../chart-parser/types';

type Lane = 'kick' | 'snare' | 'yellow' | 'blue' | 'green';

interface Cell {
  lane: Lane;
  tom: boolean;
}

interface DslBlock {
  resolution: number;
  timeSig?: [number, number];
  hits: { tick: number; cells: Cell[] }[];
}

type NoteEvent = { tick: number; type: number; flags: number; length: number };

const TYPE_BY_LANE: Record<Lane, number> = {
  kick: noteTypes.kick,
  snare: noteTypes.redDrum,
  yellow: noteTypes.yellowDrum,
  blue: noteTypes.blueDrum,
  green: noteTypes.greenDrum,
};
const LANE_BY_TYPE: Record<number, Lane> = {
  [noteTypes.kick]: 'kick',
  [noteTypes.redDrum]: 'snare',
  [noteTypes.yellowDrum]: 'yellow',
  [noteTypes.blueDrum]: 'blue',
  [noteTypes.greenDrum]: 'green',
};
const CYMBAL_LANES = new Set<Lane>(['yellow', 'blue', 'green']);

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

function cellToken({ lane, tom }: Cell): string {
  return CYMBAL_LANES.has(lane) && tom ? `${lane}:tom` : lane;
}

function parseCell(token: string): Cell | undefined {
  const [lane, flag] = token.split(':') as [Lane, string | undefined];

  if (!(lane in TYPE_BY_LANE)) {
    return undefined;
  }

  return { lane, tom: flag === 'tom' };
}

function cellFlags({ lane, tom }: Cell): number {
  return CYMBAL_LANES.has(lane) && !tom ? noteFlags.cymbal : 0;
}

function measureTicks([numerator, denominator]: [number, number], ppq: number) {
  return numerator * ((ppq * 4) / denominator);
}

export function parseDsl(text: string): DslBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')),
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const [header, ...noteLines] = lines;
      const resMatch = header.match(/res=(\d+)/);
      const tsMatch = header.match(/ts=(\d+)\/(\d+)/);

      if (!resMatch) {
        throw new Error(`DSL block missing res=: "${header}"`);
      }

      return {
        resolution: Number(resMatch[1]),
        timeSig: tsMatch
          ? ([Number(tsMatch[1]), Number(tsMatch[2])] as [number, number])
          : undefined,
        hits: noteLines.map((line) => {
          const [tick, ...tokens] = line.split(/\s+/);

          return {
            tick: Number(tick),
            cells: tokens
              .map(parseCell)
              .filter((cell): cell is Cell => cell !== undefined),
          };
        }),
      };
    });
}

export function buildParsedChartFromDsl(text: string): ParsedChart {
  const blocks = parseDsl(text);
  const target = blocks.reduce((acc, block) => lcm(acc, block.resolution), 1);
  const noteEventGroups: NoteEvent[][] = [];
  const timeSignatures: {
    tick: number;
    numerator: number;
    denominator: number;
  }[] = [];
  let absStart = 0;
  let prevSig: [number, number] = [4, 4];

  blocks.forEach((block, index) => {
    const scale = target / block.resolution;
    const sig = block.timeSig ?? prevSig;

    if (index === 0 || sig[0] !== prevSig[0] || sig[1] !== prevSig[1]) {
      timeSignatures.push({
        tick: absStart,
        numerator: sig[0],
        denominator: sig[1],
      });
    }

    block.hits.forEach(({ tick, cells }) => {
      if (cells.length === 0) {
        return;
      }

      const at = absStart + tick * scale;

      noteEventGroups.push(
        cells.map((cell) => ({
          tick: at,
          type: TYPE_BY_LANE[cell.lane],
          flags: cellFlags(cell),
          length: 0,
        })),
      );
    });
    absStart += measureTicks(sig, target);
    prevSig = sig;
  });

  noteEventGroups.sort((a, b) => a[0].tick - b[0].tick);

  return {
    resolution: target,
    timeSignatures,
    tempos: [],
    trackData: [
      {
        instrument: 'drums',
        difficulty: 'expert',
        noteEventGroups,
      },
    ],
  } as unknown as ParsedChart;
}

function eventToCell(type: number, flags: number): Cell | undefined {
  const lane = LANE_BY_TYPE[type];

  if (!lane) {
    return undefined;
  }

  return {
    lane,
    tom: CYMBAL_LANES.has(lane) && (flags & noteFlags.cymbal) === 0,
  };
}

export function serializeMeasureToDsl(
  chart: ParsedChart,
  measure: Measure,
): string {
  const drum = chart.trackData.find(
    (t) => t.instrument === 'drums' && t.difficulty === 'expert',
  );
  const byTick = new Map<number, string[]>();

  (drum?.noteEventGroups.flat() ?? [])
    .filter((e) => e.tick >= measure.startTick && e.tick < measure.endTick)
    .forEach((e) => {
      const cell = eventToCell(e.type, e.flags);

      if (!cell) {
        return;
      }

      const rel = e.tick - measure.startTick;
      const tokens = byTick.get(rel) ?? [];

      tokens.push(cellToken(cell));
      byTick.set(rel, tokens);
    });

  const header = `res=${chart.resolution} ts=${measure.timeSig[0]}/${measure.timeSig[1]}`;
  const lines = [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, tokens]) => `${tick} ${tokens.join(' ')}`);

  return [header, ...lines].join('\n');
}
