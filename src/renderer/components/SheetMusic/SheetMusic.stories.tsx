import { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SheetMusic } from './SheetMusic';
import { buildParsedChartFromDsl } from './helpers';
import { ChartParser } from '../../../chart-parser/parser';
import { renderMusic } from '../../../chart-parser/renderer';
import { RenderData } from '../../../chart-parser/types';
import { Song } from '../../../types';
import { SHEET_MUSIC_COLORS } from '../../constants';

const STORY_SONG = {
  name: 'Parser',
  artist: '',
  charter: '',
} as unknown as Song;
const DSL = `
# quarters
res=480 ts=4/4
0 snare
480 snare
960 snare
1440 snare

# eighths
res=480
0 snare
240 snare
480 snare
720 snare
960 snare
1200 snare
1440 snare
1680 snare

# sixteenths
res=480
0 snare
120 snare
240 snare
360 snare
480 snare
600 snare
720 snare
840 snare
960 snare
1080 snare
1200 snare
1320 snare
1440 snare
1560 snare
1680 snare
1800 snare

# dotted-8 + 16
res=480
0 snare
360 snare
480 snare
840 snare
960 snare
1320 snare
1440 snare
1800 snare

# single hit (long-note limitation)
res=480
0 snare

# quarter + half rest
res=480
0 snare

# eighth rest
res=480
0 snare
720 snare

# dotted-quarter rest on strong beat
res=480
720 snare

# sixteenth rest
res=480
120 snare

# whole-measure rest
res=480

# eighth-note triplet
res=480
0 snare
160 snare
320 snare

# two 16th-triplets
res=480
0 snare
80 snare
160 snare
240 snare
320 snare
400 snare

# quintuplet
res=480
0 snare
96 snare
192 snare
288 snare
384 snare

# septuplet
res=480
0 snare
69 snare
137 snare
206 snare
274 snare
343 snare
411 snare

# twelve even
res=480
0 snare
40 snare
80 snare
120 snare
160 snare
200 snare
240 snare
280 snare
320 snare
360 snare
400 snare
440 snare

# flam (8 ticks)
res=480
0 snare
8 snare
480 snare

# drag (8 + 14 ticks)
res=480
0 snare
8 snare
14 snare
480 snare

# near-coincident kick+snare -> chord
res=480
0 kick
8 snare
480 snare

# mixed beat (16ths then 16th-triplet)
res=480
0 snare
120 snare
240 snare
320 snare
400 snare

# real off-grid fill (Spinal Tap bar 94)
res=480
160 blue
300 snare blue
450 kick snare blue
600 snare blue
750 snare blue
1280 yellow
1360 yellow
1440 yellow
1520 yellow
1640 yellow

# toms via pro-drums markers
res=480
0 snare
480 yellow:tom
960 blue:tom
1440 green:tom

# 3/4
res=480 ts=3/4
0 snare
480 snare
960 snare

# 6/8
res=480 ts=6/8
0 snare
240 snare
480 snare
720 snare
960 snare
1200 snare

# 5/4
res=480 ts=5/4
0 snare
480 snare
960 snare
1440 snare
1920 snare

# 7/8
res=480 ts=7/8
0 snare
240 snare
480 snare
720 snare
960 snare
1200 snare
1440 snare

# 2/4
res=480 ts=2/4
0 snare
480 snare

# Monomyth dense 32nd-kick beat (source tick 62880): clean 32nds drawn coarse
res=480 ts=4/4
0 kick yellow
60 kick
120 kick
240 kick
300 kick
360 kick
480 yellow
600 kick
660 kick
720 kick
840 kick
900 kick
960 kick blue
1080 snare
1320 snare
1440 kick yellow
1500 kick
1560 kick
1680 kick
1740 kick
1800 kick

res=192 ts=4/4
0 kick yellow
48 yellow
144 kick yellow
240 yellow
288 kick yellow
384 snare
432 yellow
528 kick yellow
576 kick yellow
624 yellow
672 kick yellow
720 yellow
`;

function SheetHarness({ dsl }: { dsl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderData, setRenderData] = useState<RenderData[]>([]);
  const parser = useMemo(() => {
    try {
      return new ChartParser(buildParsedChartFromDsl(dsl), false);
    } catch {
      return null;
    }
  }, [dsl]);

  useEffect(() => {
    if (!containerRef.current || !parser) {
      return;
    }

    setRenderData(
      renderMusic(
        containerRef.current,
        parser,
        SHEET_MUSIC_COLORS,
        false,
        true,
        true,
      ),
    );
  }, [parser]);

  if (!parser) {
    return null;
  }

  return (
    <SheetMusic
      engine={undefined}
      songData={STORY_SONG}
      renderData={renderData}
      vexflowContainerRef={containerRef}
      enableColors={true}
      showReference={false}
      isDev={false}
      zoom={1}
      onSelectMeasure={() => {}}
    />
  );
}

function Sheet({ dsl }: { dsl: string }) {
  return (
    <div style={{ padding: 24, background: '#fff', overflow: 'auto' }}>
      <SheetHarness dsl={dsl} />
    </div>
  );
}

const meta: Meta<typeof Sheet> = {
  title: 'Song View/Sheet Music',
  component: Sheet,
};

export default meta;

type Story = StoryObj<typeof Sheet>;

export const Parser: Story = {
  render: () => <Sheet dsl={DSL} />,
};
