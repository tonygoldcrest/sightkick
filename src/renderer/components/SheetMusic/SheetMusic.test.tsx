import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Measure, RenderData } from '../../../chart-parser/types';
import { Song } from '../../../types';
import { Engine } from '../../services/engine';
import { SheetMusic } from './SheetMusic';

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
} as Song;

function renderSheet(
  overrides: Partial<Parameters<typeof SheetMusic>[0]> = {},
) {
  const engine = { setRendererRefs: vi.fn() } as unknown as Engine;
  const onSelectMeasure = vi.fn();
  const result = render(
    <SheetMusic
      engine={engine}
      songData={songData}
      renderData={[makeRenderData(0), makeRenderData(1920)]}
      vexflowContainerRef={createRef<HTMLDivElement>()}
      isDev={false}
      onSelectMeasure={onSelectMeasure}
      enableColors
      showReference={false}
      zoom={1}
      {...overrides}
    />,
  );

  return { ...result, engine, onSelectMeasure };
}

function overlays(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[class*="z-[-3]"]'));
}

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

  it('forwards the click event so consumers can read modifier keys', () => {
    const { container, onSelectMeasure } = renderSheet({ isDev: true });

    fireEvent.click(overlays(container)[1], { ctrlKey: true });

    expect(onSelectMeasure.mock.calls[0][1].ctrlKey).toBe(true);
  });

  it('ignores overlay clicks when not in dev mode', () => {
    const { container, onSelectMeasure } = renderSheet({ isDev: false });

    fireEvent.click(overlays(container)[0]);

    expect(onSelectMeasure).not.toHaveBeenCalled();
  });

  it('ignores modifier-clicks too when not in dev mode', () => {
    const { container, onSelectMeasure } = renderSheet({ isDev: false });

    fireEvent.click(overlays(container)[0], { ctrlKey: true });
    fireEvent.click(overlays(container)[0], { metaKey: true });

    expect(onSelectMeasure).not.toHaveBeenCalled();
  });
});

describe('SheetMusic practice range selection', () => {
  it('starts a one-measure range on mouse down and extends it on enter', () => {
    const onPracticeRangeChange = vi.fn();
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: true,
      onPracticeRangeChange,
    });
    const [a, b] = overlays(container);

    fireEvent.mouseDown(a);
    expect(onPracticeRangeChange).toHaveBeenLastCalledWith({
      start: 0,
      end: 0,
    });

    fireEvent.mouseEnter(b);
    expect(onPracticeRangeChange).toHaveBeenLastCalledWith({
      start: 0,
      end: 1,
    });
  });

  it('normalizes a backward drag', () => {
    const onPracticeRangeChange = vi.fn();
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: true,
      onPracticeRangeChange,
    });
    const [a, b] = overlays(container);

    fireEvent.mouseDown(b);
    fireEvent.mouseEnter(a);

    expect(onPracticeRangeChange).toHaveBeenLastCalledWith({
      start: 0,
      end: 1,
    });
  });

  it('ends the drag on window mouse up', () => {
    const onPracticeRangeChange = vi.fn();
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: true,
      onPracticeRangeChange,
    });
    const [a, b] = overlays(container);

    fireEvent.mouseDown(a);
    fireEvent.mouseUp(document.body);
    onPracticeRangeChange.mockClear();
    fireEvent.mouseEnter(b);

    expect(onPracticeRangeChange).not.toHaveBeenCalled();
  });

  it('does not select while looping is off', () => {
    const onPracticeRangeChange = vi.fn();
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: false,
      onPracticeRangeChange,
    });

    fireEvent.mouseDown(overlays(container)[0]);

    expect(onPracticeRangeChange).not.toHaveBeenCalled();
  });

  it('does not select outside dev or practice', () => {
    const onPracticeRangeChange = vi.fn();
    const { container } = renderSheet({
      gameMode: 'perform',
      isLooping: true,
      onPracticeRangeChange,
    });

    fireEvent.mouseDown(overlays(container)[0]);

    expect(onPracticeRangeChange).not.toHaveBeenCalled();
  });

  it('marks the selected range and merges adjacent overlays', () => {
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: true,
      practiceRange: { start: 0, end: 1 },
    });
    const [a, b] = overlays(container) as HTMLElement[];

    expect(a.className).toContain('bg-accent-soft-bg-solid');
    expect(b.className).toContain('bg-accent-soft-bg-solid');

    expect(a.className).toContain('border-r-0!');
    expect(a.className).toContain('rounded-r-none');
    expect(b.className).toContain('border-l-0!');
    expect(b.className).toContain('rounded-l-none');

    expect(a.className).not.toContain('border-l-0!');
    expect(b.className).not.toContain('border-r-0!');
  });

  it('does not highlight the range while looping is off', () => {
    const { container } = renderSheet({
      gameMode: 'practice',
      isLooping: false,
      practiceRange: { start: 0, end: 1 },
    });
    const [a] = overlays(container) as HTMLElement[];

    expect(a.className).not.toContain('bg-accent-soft-bg-solid');
  });

  it('clears the range from the looping-section control', () => {
    const onPracticeRangeChange = vi.fn();
    const { getByRole } = renderSheet({
      gameMode: 'practice',
      isLooping: true,
      practiceRange: { start: 0, end: 1 },
      onPracticeRangeChange,
    });

    fireEvent.click(getByRole('button'));

    expect(onPracticeRangeChange).toHaveBeenCalledWith(undefined);
  });
});

describe('SheetMusic reference legend', () => {
  it('shows the reference when colors are on and the reference is enabled', () => {
    const { getByText } = renderSheet({
      enableColors: true,
      showReference: true,
    });

    expect(getByText('Snare')).toBeInTheDocument();
    expect(getByText('Kick')).toBeInTheDocument();
  });

  it('hides the reference when it is disabled', () => {
    const { queryByText } = renderSheet({
      enableColors: true,
      showReference: false,
    });

    expect(queryByText('Snare')).not.toBeInTheDocument();
  });

  it('hides the reference when colors are off even if it is enabled', () => {
    const { queryByText } = renderSheet({
      enableColors: false,
      showReference: true,
    });

    expect(queryByText('Snare')).not.toBeInTheDocument();
  });
});
