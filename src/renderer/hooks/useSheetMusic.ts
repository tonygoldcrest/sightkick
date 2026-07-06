import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { Difficulty, parseChartFile } from 'scan-chart';
import { ChartParser } from '../../chart-parser/parser';
import { renderMusic } from '../../chart-parser/renderer';
import { ParsedChart, RenderData } from '../../chart-parser/types';
import { SHEET_MUSIC_COLORS } from '../constants';

interface UseSheetMusicParams {
  fileData: Buffer | undefined;
  format: 'mid' | 'chart';
  fiveLaneDrums: boolean;
  proDrums: boolean;
  songId: string | undefined;
  difficulty: Difficulty;
  showBarNumbers: boolean;
  enableColors: boolean;
  showTempo: boolean;
}

interface UseSheetMusicResult {
  chart: ParsedChart | null;
  parsedMidi: ChartParser | null;
  renderData: RenderData[];
  vexflowContainerRef: RefObject<HTMLDivElement | null>;
}

export function useSheetMusic({
  fileData,
  format,
  fiveLaneDrums,
  proDrums,
  songId,
  difficulty,
  showBarNumbers,
  enableColors,
  showTempo,
}: UseSheetMusicParams): UseSheetMusicResult {
  const { notification } = App.useApp();
  const vexflowContainerRef = useRef<HTMLDivElement>(null);
  const [renderData, setRenderData] = useState<RenderData[]>([]);
  const chart = useMemo(() => {
    if (!fileData) {
      return null;
    }

    return parseChartFile(new Uint8Array(fileData), format, {
      pro_drums: proDrums,
      five_lane_drums: fiveLaneDrums,
    });
  }, [fileData, format, proDrums, fiveLaneDrums]);
  const parsedMidi = useMemo(() => {
    if (!chart || !songId) {
      return null;
    }

    try {
      return new ChartParser(chart, fiveLaneDrums, difficulty);
    } catch {
      return null;
    }
  }, [chart, songId, fiveLaneDrums, difficulty]);

  useEffect(() => {
    if (chart && songId && !parsedMidi) {
      notification.error({
        message: 'Chart parse failed',
        description:
          "This song's chart could not be parsed and cannot be displayed.",
        placement: 'bottomRight',
      });
    }
  }, [chart, songId, parsedMidi, notification]);

  useEffect(() => {
    if (!vexflowContainerRef.current || !parsedMidi) {
      return;
    }

    setRenderData(
      renderMusic(
        vexflowContainerRef.current,
        parsedMidi,
        SHEET_MUSIC_COLORS,
        showBarNumbers,
        enableColors,
        showTempo,
      ),
    );
  }, [parsedMidi, showBarNumbers, enableColors, showTempo]);

  return {
    chart,
    parsedMidi,
    renderData,
    vexflowContainerRef,
  };
}
