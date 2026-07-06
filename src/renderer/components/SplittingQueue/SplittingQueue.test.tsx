import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Song } from '../../../types';
import { installIpcMock, IpcMock } from '../../hooks/test-support';
import { SplittingQueue } from './SplittingQueue';

const songList = [
  { id: 'a', name: 'Song A' },
  { id: 'b', name: 'Song B' },
] as Song[];

describe('SplittingQueue', () => {
  let ipc: IpcMock;

  beforeEach(() => {
    ipc = installIpcMock();
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  it('renders nothing when nothing is being split', () => {
    const { container } = render(
      <SplittingQueue
        splittingIds={new Set()}
        splitProgress={new Map()}
        songList={songList}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a progress card for each splitting song', () => {
    render(
      <SplittingQueue
        splittingIds={new Set(['a', 'b'])}
        splitProgress={new Map([['a', 30]])}
        songList={songList}
      />,
    );

    expect(screen.getByText('Song A')).toBeInTheDocument();
    expect(screen.getByText('Song B')).toBeInTheDocument();
  });

  it('skips ids that are not present in the song list', () => {
    render(
      <SplittingQueue
        splittingIds={new Set(['a', 'missing'])}
        splitProgress={new Map()}
        songList={songList}
      />,
    );

    expect(screen.getByText('Song A')).toBeInTheDocument();
    expect(
      screen
        .getAllByText(/Song/)
        .filter((el) => el.textContent !== 'Processing queue'),
    ).toHaveLength(1);
  });

  it('sends a cancel-split message for the clicked song', () => {
    render(
      <SplittingQueue
        splittingIds={new Set(['a'])}
        splitProgress={new Map([['a', 10]])}
        songList={songList}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(ipc.sent).toContainEqual({
      channel: 'cancel-split',
      args: ['a'],
    });
  });
});
