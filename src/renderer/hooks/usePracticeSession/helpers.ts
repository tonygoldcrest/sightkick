import { RenderData } from '../../../chart-parser/types';

export type PracticeNavDirection = 'up' | 'down' | 'left' | 'right';

function rowsOf(renderData: RenderData[]): number[][] {
  const rows: number[][] = [];

  renderData.forEach((rd, index) => {
    const row = rows[rows.length - 1];

    if (row && renderData[row[0]].yOffset === rd.yOffset) {
      row.push(index);
    } else {
      rows.push([index]);
    }
  });

  return rows;
}

export function neighborIndex(
  renderData: RenderData[],
  index: number,
  direction: PracticeNavDirection,
): number {
  const last = renderData.length - 1;

  if (direction === 'left') {
    return Math.max(0, index - 1);
  }

  if (direction === 'right') {
    return Math.min(last, index + 1);
  }

  const rows = rowsOf(renderData);
  const rowIndex = rows.findIndex((row) => row.includes(index));
  const column = rows[rowIndex].indexOf(index);
  const targetRow = direction === 'up' ? rowIndex - 1 : rowIndex + 1;

  if (targetRow < 0 || targetRow >= rows.length) {
    return index;
  }

  const row = rows[targetRow];

  return row[Math.min(column, row.length - 1)];
}

export function measureIndexAtTick(
  renderData: RenderData[],
  tick: number,
): number {
  if (renderData.length === 0) {
    return 0;
  }

  const index = renderData.findIndex(
    (rd) => tick >= rd.measure.startTick && tick < rd.measure.endTick,
  );

  if (index >= 0) {
    return index;
  }

  return tick < renderData[0].measure.startTick ? 0 : renderData.length - 1;
}
