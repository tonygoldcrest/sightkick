import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Measure, RenderData } from '../../../chart-parser/types';
import { SongData } from '../../../types';
import { GameEngine } from '../../services/game-engine';
import { SheetMusic } from './SheetMusic';

const appState = vi.hoisted(() => ({
  enableColors: true,
  showReference: false,
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => appState,
}));

function makeStave(): RenderData['stave'] {
  return {
    getX: () => 10,
    getY: () => 20,
    getWidth: () => 100,
    getHeight: () => 40,
  } as unknown as RenderData['stave'];
}

function makeRenderData(startTick: number): RenderData {
  return {
    stave: makeStave(),
    measure: {
      startTick,
      endTick: startTick + 1920,
      notes: [],
    } as unknown as Measure,
    renderedNotes: [],
    yOffset: 0,
  } as RenderData;
}

const songData = {
  name: 'Master of Puppets',
  artist: 'Metallica',
  charter: 'Charter',
} as SongData;

function renderSheet(
  overrides: Partial<Parameters<typeof SheetMusic>[0]> = {},
) {
  const engine = { setRendererRefs: vi.fn() } as unknown as GameEngine;
  const onSelectMeasure = vi.fn();
  const result = render(
    <SheetMusic
      engine={engine}
      songData={songData}
      renderData={[makeRenderData(0), makeRenderData(1920)]}
      vexflowContainerRef={createRef<HTMLDivElement>()}
      isDev={false}
      zoom={1}
      onSelectMeasure={onSelectMeasure}
      {...overrides}
    />,
  );

  return { ...result, engine, onSelectMeasure };
}

function overlays(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[class*="z-[-3]"]'));
}

beforeEach(() => {
  appState.enableColors = true;
  appState.showReference = false;
});

describe('SheetMusic', () => {
  it('renders the song title and credits', () => {
    const { getByText } = renderSheet();

    expect(getByText('Master of Puppets')).toBeInTheDocument();
    expect(getByText('Music by Metallica')).toBeInTheDocument();
    expect(getByText('Arranged by Charter')).toBeInTheDocument();
  });

  it('wires the cursor and one highlight overlay per measure into the engine', () => {
    const { engine } = renderSheet();

    expect(
      engine.setRendererRefs as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledTimes(1);

    const arg = (engine.setRendererRefs as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(arg.cursorEl).toBeInstanceOf(HTMLElement);
    expect(arg.highlightEls).toHaveLength(2);
    arg.highlightEls.forEach((el: unknown) =>
      expect(el).toBeInstanceOf(HTMLElement),
    );
  });

  it('positions an overlay from its stave geometry', () => {
    const { container } = renderSheet();
    const [first] = overlays(container) as HTMLElement[];

    expect(first.style.top).toBe('20px');
    expect(first.style.left).toBe('5px');
    expect(first.style.width).toBe('110px');
    expect(first.style.height).toBe('70px');
  });

  it('selects a measure on overlay click in dev mode', () => {
    const { container, onSelectMeasure } = renderSheet({ isDev: true });

    fireEvent.click(overlays(container)[1]);

    expect(onSelectMeasure).toHaveBeenCalledTimes(1);
    expect(onSelectMeasure.mock.calls[0][0]).toMatchObject({ startTick: 1920 });
  });

  it('ignores overlay clicks when not in dev mode', () => {
    const { container, onSelectMeasure } = renderSheet({ isDev: false });

    fireEvent.click(overlays(container)[0]);

    expect(onSelectMeasure).not.toHaveBeenCalled();
  });
});

describe('SheetMusic reference legend', () => {
  it('shows the reference when colors are on and the reference is enabled', () => {
    appState.enableColors = true;
    appState.showReference = true;

    const { getByText } = renderSheet();

    expect(getByText('Snare')).toBeInTheDocument();
    expect(getByText('Kick')).toBeInTheDocument();
  });

  it('hides the reference when it is disabled', () => {
    appState.enableColors = true;
    appState.showReference = false;

    const { queryByText } = renderSheet();

    expect(queryByText('Snare')).not.toBeInTheDocument();
  });

  it('hides the reference when colors are off even if it is enabled', () => {
    appState.enableColors = false;
    appState.showReference = true;

    const { queryByText } = renderSheet();

    expect(queryByText('Snare')).not.toBeInTheDocument();
  });
});
