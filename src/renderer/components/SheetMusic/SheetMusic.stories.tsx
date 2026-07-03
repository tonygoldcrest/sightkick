import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SheetMusic } from './SheetMusic';
import {
  buildDrumMidi,
  hit,
  tom,
  GEM,
  TOM_MARKER,
  Hit,
  MeasureSpec,
} from './drumMidiFixture';
import { useSheetMusic } from '../../hooks/useSheetMusic';
import { SongData } from '../../../types';

const STORY_SONG = {
  name: 'Parser',
  artist: '',
  charter: '',
} as unknown as SongData;

function SheetHarness({ measures }: { measures: MeasureSpec[] }) {
  const fileData = useMemo(
    () => buildDrumMidi(measures) as unknown as Buffer,
    [measures],
  );
  const { chart, parsedMidi, renderData, vexflowContainerRef } = useSheetMusic({
    fileData,
    format: 'mid',
    fiveLaneDrums: false,
    proDrums: true,
    songId: 'story',
    difficulty: 'expert',
    showBarNumbers: false,
    enableColors: true,
    showTempo: true,
  });

  if (!chart || !parsedMidi) {
    return null;
  }

  return (
    <SheetMusic
      engine={undefined}
      songData={STORY_SONG}
      renderData={renderData}
      vexflowContainerRef={vexflowContainerRef}
      isDev={false}
      onSelectMeasure={() => {}}
      zoom={1}
    />
  );
}

function Sheet({ measures }: { measures: MeasureSpec[] }) {
  return (
    <div style={{ padding: 24, background: '#fff', overflow: 'auto' }}>
      <SheetHarness measures={measures} />
    </div>
  );
}

function seq(pitch: number, ticks: number[]): Hit[] {
  return ticks.map((t) => hit(pitch, t));
}

const B = 480;
const range = (n: number, step: number) =>
  Array.from({ length: n }, (_, i) => i * step);
const MEASURES: MeasureSpec[] = [
  { hits: seq(GEM.snare, [0, B, 2 * B, 3 * B]) }, // quarters
  { hits: seq(GEM.snare, range(8, 240)) }, // eighths
  { hits: seq(GEM.snare, range(16, 120)) }, // sixteenths
  { hits: seq(GEM.snare, [0, 360, 480, 840, 960, 1320, 1440, 1800]) }, // dotted-8 + 16
  { hits: seq(GEM.snare, [0]) }, // single hit (long-note limitation)

  { hits: seq(GEM.snare, [0]) }, // quarter + half rest
  { hits: seq(GEM.snare, [0, 720]) }, // eighth rest
  { hits: seq(GEM.snare, [720]) }, // dotted-quarter rest on strong beat (currently split)
  { hits: seq(GEM.snare, [120]) }, // sixteenth rest
  { hits: [] }, // whole-measure rest

  { hits: seq(GEM.snare, [0, 160, 320]) }, // eighth-note triplet
  { hits: seq(GEM.snare, [0, 80, 160, 240, 320, 400]) }, // two 16th-triplets (currently 6:4)
  { hits: seq(GEM.snare, [0, 96, 192, 288, 384]) }, // quintuplet
  { hits: seq(GEM.snare, [0, 69, 137, 206, 274, 343, 411]) }, // septuplet
  { hits: seq(GEM.snare, range(12, 40)) }, // twelve even (currently two 6:4)

  { hits: [hit(GEM.snare, 0), hit(GEM.snare, 8), hit(GEM.snare, B)] },
  {
    hits: [
      hit(GEM.snare, 0),
      hit(GEM.snare, 8),
      hit(GEM.snare, 14),
      hit(GEM.snare, B),
    ],
  },
  { hits: [hit(GEM.kick, 0), hit(GEM.snare, 8), hit(GEM.snare, B)] }, // near-coincident kick+snare -> chord
  { hits: seq(GEM.snare, [0, 120, 240, 320, 400]) }, // mixed beat (16ths then 16th-triplet)
  {
    hits: [
      hit(GEM.blue, 160),
      hit(GEM.snare, 300),
      hit(GEM.blue, 300),
      hit(GEM.kick, 450),
      hit(GEM.snare, 450),
      hit(GEM.blue, 450),
      hit(GEM.snare, 600),
      hit(GEM.blue, 600),
      hit(GEM.snare, 750),
      hit(GEM.blue, 750),
      ...seq(GEM.yellow, [1280, 1360, 1440, 1520, 1640]),
    ],
  }, // real off-grid fill (Spinal Tap bar 94)
  {
    hits: [
      hit(GEM.snare, 0),
      ...tom(TOM_MARKER.yellow, GEM.yellow, B),
      ...tom(TOM_MARKER.blue, GEM.blue, 2 * B),
      ...tom(TOM_MARKER.green, GEM.green, 3 * B),
    ],
  }, // toms via pro-drums markers

  { timeSig: [3, 4], hits: seq(GEM.snare, [0, B, 2 * B]) },
  {
    timeSig: [6, 8],
    hits: seq(GEM.snare, [0, 240, 480, 720, 960, 1200]),
  },
  {
    timeSig: [5, 4],
    hits: seq(GEM.snare, [0, B, 2 * B, 3 * B, 4 * B]),
  },
  {
    timeSig: [7, 8],
    hits: seq(GEM.snare, [0, 240, 480, 720, 960, 1200, 1440]),
  },
  { timeSig: [2, 4], hits: seq(GEM.snare, [0, B]) },
];
const meta: Meta<typeof Sheet> = {
  title: 'Song View/Sheet Music',
  component: Sheet,
};

export default meta;

type Story = StoryObj<typeof Sheet>;

export const Parser: Story = {
  render: () => <Sheet measures={MEASURES} />,
};
