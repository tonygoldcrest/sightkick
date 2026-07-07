import { describe, expect, it } from 'vitest';
import { RenderData } from '../../../chart-parser/types';
import { measureIndexAtTick, neighborIndex } from './helpers';

function makeRenderData(rowSizes: number[]): RenderData[] {
  const data: Partial<RenderData>[] = [];
  let yOffset = 0;

  rowSizes.forEach((size) => {
    for (let i = 0; i < size; i += 1) {
      const startTick = data.length * 100;

      data.push({
        yOffset,
        measure: {
          startTick,
          endTick: startTick + 100,
        } as RenderData['measure'],
      });
    }

    yOffset += 100;
  });

  return data as RenderData[];
}

const RENDER_DATA = makeRenderData([3, 3]);

describe('neighborIndex', () => {
  it('moves left and right within bounds', () => {
    expect(neighborIndex(RENDER_DATA, 2, 'right')).toBe(3);
    expect(neighborIndex(RENDER_DATA, 2, 'left')).toBe(1);
    expect(neighborIndex(RENDER_DATA, 0, 'left')).toBe(0);
    expect(neighborIndex(RENDER_DATA, 5, 'right')).toBe(5);
  });

  it('moves between rows keeping the column, clamped', () => {
    expect(neighborIndex(RENDER_DATA, 1, 'down')).toBe(4);
    expect(neighborIndex(RENDER_DATA, 4, 'up')).toBe(1);
    expect(neighborIndex(RENDER_DATA, 1, 'up')).toBe(1);
    expect(neighborIndex(RENDER_DATA, 4, 'down')).toBe(4);
  });
});

describe('measureIndexAtTick', () => {
  it('finds the measure containing the tick', () => {
    expect(measureIndexAtTick(RENDER_DATA, 0)).toBe(0);
    expect(measureIndexAtTick(RENDER_DATA, 250)).toBe(2);
    expect(measureIndexAtTick(RENDER_DATA, 550)).toBe(5);
  });

  it('clamps ticks before the first and after the last measure', () => {
    expect(measureIndexAtTick(RENDER_DATA, -50)).toBe(0);
    expect(measureIndexAtTick(RENDER_DATA, 9999)).toBe(5);
  });

  it('returns 0 with no render data', () => {
    expect(measureIndexAtTick([], 100)).toBe(0);
  });
});
