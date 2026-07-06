import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseChartFile } from 'scan-chart';
import { ChartParser } from '../../chart-parser/parser';
import { renderMusic } from '../../chart-parser/renderer';
import {
  NotificationMock,
  getNotification,
  resetNotification,
} from './test-support';
import { useSheetMusic } from './useSheetMusic';
import { SHEET_MUSIC_COLORS } from '../constants';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

vi.mock('scan-chart', () => ({ parseChartFile: vi.fn() }));
vi.mock('../../chart-parser/parser', () => ({ ChartParser: vi.fn() }));
vi.mock('../../chart-parser/renderer', () => ({ renderMusic: vi.fn() }));

const parseChartFileMock = vi.mocked(parseChartFile);
const ChartParserMock = vi.mocked(ChartParser);
const renderMusicMock = vi.mocked(renderMusic);
const CHART = {
  resolution: 480,
  tempos: [{ tick: 0, beatsPerMinute: 120, msTime: 0 }],
  trackData: [
    { instrument: 'drums', difficulty: 'hard' },
    { instrument: 'drums', difficulty: 'expert' },
    { instrument: 'guitar', difficulty: 'expert' },
  ],
};
const PARSED = { parsed: true };
const RENDER_DATA = [{ stave: {} }];

interface Props {
  fileData: Buffer | undefined;
  format: 'mid' | 'chart';
  fiveLaneDrums: boolean;
  proDrums: boolean;
  songId: string | undefined;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  showBarNumbers: boolean;
  enableColors: boolean;
  showTempo: boolean;
}

const BASE: Props = {
  fileData: new Uint8Array([1, 2, 3]) as unknown as Buffer,
  format: 'mid',
  fiveLaneDrums: false,
  proDrums: false,
  songId: 'song-1',
  difficulty: 'expert',
  showBarNumbers: false,
  enableColors: true,
  showTempo: true,
};
let notification: NotificationMock;

beforeEach(() => {
  notification = resetNotification();
  parseChartFileMock.mockReset().mockReturnValue(CHART as never);
  ChartParserMock.mockReset().mockImplementation(function ChartParserStub() {
    return PARSED as never;
  } as never);
  renderMusicMock.mockReset().mockReturnValue(RENDER_DATA as never);
});

function setup(initial: Props = BASE) {
  return renderHook((p: Props) => useSheetMusic(p), { initialProps: initial });
}

describe('useSheetMusic', () => {
  it('returns empty data without a file', () => {
    const { result } = setup({ ...BASE, fileData: undefined });

    expect(result.current.chart).toBeNull();
    expect(result.current.parsedMidi).toBeNull();
    expect(result.current.renderData).toEqual([]);
    expect(parseChartFileMock).not.toHaveBeenCalled();
  });

  it('parses the chart', () => {
    const { result } = setup();

    expect(parseChartFileMock).toHaveBeenCalledTimes(1);

    const [bytes, format] = parseChartFileMock.mock.calls[0];

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(format).toBe('mid');
    expect(result.current.chart).toBe(CHART);
  });

  it('forwards the pro/five-lane ini modifiers to the parser', () => {
    setup({ ...BASE, proDrums: true, fiveLaneDrums: false });

    const modifiers = parseChartFileMock.mock.calls[0][2];

    expect(modifiers).toEqual({ pro_drums: true, five_lane_drums: false });
  });

  it('builds the parser with the selected difficulty and lane mode', () => {
    const { result } = setup({ ...BASE, fiveLaneDrums: true });

    expect(ChartParserMock).toHaveBeenCalledTimes(1);
    expect(ChartParserMock).toHaveBeenCalledWith(CHART, true, 'expert');
    expect(result.current.parsedMidi).toEqual(PARSED);
  });

  it('renders into the vexflow container once it is attached', () => {
    const div = document.createElement('div');
    const initialProps: Props = { ...BASE, fileData: undefined };
    const { result, rerender } = renderHook((p: Props) => useSheetMusic(p), {
      initialProps,
    });

    result.current.vexflowContainerRef.current = div;
    rerender(BASE);

    expect(renderMusicMock).toHaveBeenCalledTimes(1);

    const [target, parsed, colors, bars, enableColors] =
      renderMusicMock.mock.calls[0];

    expect(target).toBe(div);
    expect(parsed).toEqual(PARSED);
    expect(colors).toBe(SHEET_MUSIC_COLORS);
    expect(bars).toBe(false);
    expect(enableColors).toBe(true);
    expect(result.current.renderData).toEqual(RENDER_DATA);
  });

  it('does not re-parse when only render options change', () => {
    const { rerender } = setup();

    expect(ChartParserMock).toHaveBeenCalledTimes(1);

    rerender({ ...BASE, showBarNumbers: true });

    expect(ChartParserMock).toHaveBeenCalledTimes(1);
  });

  it('re-parses when the difficulty changes', () => {
    const { rerender } = setup({ ...BASE, difficulty: 'expert' });

    expect(ChartParserMock).toHaveBeenCalledTimes(1);

    rerender({ ...BASE, difficulty: 'hard' });

    expect(ChartParserMock).toHaveBeenCalledTimes(2);
    expect(ChartParserMock).toHaveBeenLastCalledWith(CHART, false, 'hard');
  });

  it('notifies and clears the parser on a parse error', () => {
    ChartParserMock.mockImplementation(function () {
      throw new Error('bad chart');
    } as never);

    const { result } = setup();

    expect(result.current.parsedMidi).toBeNull();
    expect(notification.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Chart parse failed' }),
    );
  });
});
