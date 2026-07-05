import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef } from 'react';
import { SongData } from '../../../types';
import { cn } from '../../cn';
import { SongListItem } from '../SongListItem';
import { Mode } from '../SongFilter';
import { Difficulty } from 'scan-chart';

export interface SongListProps {
  songList: SongData[];
  className?: string;
  onLikeChange: (id: string, liked: boolean) => void;
  onDownload: (id: string) => void;
  onSplit: (id: string) => void;
  onLoadMore?: () => void;
  downloadingIds?: Set<string>;
  splittingIds: Set<string>;
  difficulty: Difficulty;
  downloadedIds?: Set<string>;
  scrollKey?: string;
  mode: Mode;
  downloadingDisabled: boolean;
  focusedIndex?: number;
}

const LOAD_MORE_THRESHOLD = 2;

export function SongList({
  songList,
  className,
  onLikeChange,
  onDownload,
  downloadingIds,
  downloadedIds,
  difficulty,
  scrollKey,
  mode,
  downloadingDisabled,
  splittingIds,
  onSplit,
  onLoadMore,
  focusedIndex,
}: SongListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    parentRef.current?.scrollTo(0, 0);
  }, [scrollKey]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: songList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85,
  });

  useEffect(() => {
    if (focusedIndex !== undefined && focusedIndex >= 0) {
      rowVirtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems[virtualItems.length - 1]?.index;
  const stableLoadMore = useCallback(() => onLoadMore?.(), [onLoadMore]);

  useEffect(() => {
    if (lastVirtualIndex === undefined || !onLoadMore) {
      return;
    }

    if (lastVirtualIndex >= songList.length - LOAD_MORE_THRESHOLD) {
      stableLoadMore();
    }
  }, [lastVirtualIndex, songList.length, stableLoadMore, onLoadMore]);

  return (
    <div ref={parentRef} className={cn('h-full overflow-y-auto', className)}>
      <div
        className="w-full relative"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const songData = songList[virtualItem.index];

          return (
            <div
              ref={rowVirtualizer.measureElement}
              key={songData.id}
              data-index={virtualItem.index}
              className="absolute top-0 left-0 w-full flex px-2 py-1"
              style={{
                transform: `translateY(${
                  virtualItem.start - rowVirtualizer.options.scrollMargin
                }px)`,
                height: `${virtualItem.size}px`,
              }}
            >
              <SongListItem
                songData={songData}
                onLikeChange={onLikeChange}
                onDownload={onDownload}
                onSplit={onSplit}
                difficulty={difficulty}
                downloading={downloadingIds?.has(songData.id)}
                downloaded={downloadedIds?.has(songData.id)}
                splitting={splittingIds.has(songData.id)}
                mode={mode}
                downloadingDisabled={downloadingDisabled}
                focused={virtualItem.index === focusedIndex}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
