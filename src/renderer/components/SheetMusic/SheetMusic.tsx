import {
  MouseEvent,
  RefObject,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { cn } from '../../cn';
import { Measure, RenderData } from '../../../chart-parser/types';
import { Engine } from '../../services/engine';
import { Song } from '../../../types';
import { Reference } from './Reference';
import { GameMode, PracticeRange } from '../../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat, faXmark } from '@fortawesome/free-solid-svg-icons';
import { IconButton } from '../IconButton';

export interface SheetMusicProps {
  engine: Engine | undefined;
  songData: Song;
  renderData: RenderData[];
  vexflowContainerRef: RefObject<HTMLDivElement | null>;
  isDev: boolean;
  gameMode?: GameMode;
  practiceRange?: PracticeRange;
  focusIndex?: number;
  isLooping?: boolean;
  onPracticeRangeChange?: (range?: PracticeRange) => void;
  onSelectMeasure: (measure: Measure, event: MouseEvent) => void;
  enableColors: boolean;
  showReference: boolean;
  zoom: number;
}

export function SheetMusic({
  engine,
  songData,
  renderData,
  vexflowContainerRef,
  isDev,
  gameMode,
  practiceRange,
  focusIndex,
  isLooping,
  onPracticeRangeChange,
  onSelectMeasure,
  showReference,
  enableColors,
  zoom,
}: SheetMusicProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const highlightsRef = useMemo(
    () => renderData.map(() => createRef<HTMLDivElement>()),
    [renderData],
  );
  const isSelectable = gameMode === 'practice';
  const dragAnchorRef = useRef<number | undefined>(undefined);
  const handleMeasureMouseDown = useCallback(
    (index: number) => {
      if (!isSelectable || !isLooping) {
        return;
      }

      dragAnchorRef.current = index;
      onPracticeRangeChange?.({ start: index, end: index });
    },
    [isSelectable, onPracticeRangeChange, isLooping],
  );
  const handleMeasureMouseEnter = useCallback(
    (index: number) => {
      const anchor = dragAnchorRef.current;

      if (anchor === undefined) {
        return;
      }

      onPracticeRangeChange?.({
        start: Math.min(anchor, index),
        end: Math.max(anchor, index),
      });
    },
    [onPracticeRangeChange],
  );

  useEffect(() => {
    const endDrag = () => {
      dragAnchorRef.current = undefined;
    };

    window.addEventListener('mouseup', endDrag);

    return () => window.removeEventListener('mouseup', endDrag);
  }, []);

  useEffect(() => {
    engine?.setRendererRefs({
      cursorEl: cursorRef.current ?? undefined,
      highlightEls: highlightsRef.map((ref) => ref.current ?? undefined),
    });
  }, [engine, renderData, highlightsRef]);

  const measureHighlights = useMemo(() => {
    const isSelected = (index: number) =>
      isLooping &&
      practiceRange !== undefined &&
      index >= practiceRange.start &&
      index <= practiceRange.end;
    const isSameRow = (a: number, b: number) =>
      renderData[a] !== undefined &&
      renderData[b] !== undefined &&
      renderData[a].yOffset === renderData[b].yOffset;

    return renderData.map(({ measure, stave, yOffset }, index) => {
      const selected = isSelected(index);
      const focused =
        index === focusIndex &&
        (isLooping ? practiceRange === undefined : true);
      const mergeLeft =
        selected && isSelected(index - 1) && isSameRow(index, index - 1);
      const mergeRight =
        selected && isSelected(index + 1) && isSameRow(index, index + 1);

      return (
        <div
          key={index}
          ref={highlightsRef[index]}
          style={{
            top: yOffset + stave.getY(),
            left: stave.getX() - 5,
            width: stave.getWidth() + 10,
            height: stave.getHeight() + 30,
          }}
          className={cn(
            'absolute z-[-3] rounded-[11px] border-0 bg-transparent',
            {
              'bg-accent-soft-bg-solid border-2! border-accent-bright!':
                selected,
              'border-l-0! rounded-l-none': mergeLeft,
              'border-r-0! rounded-r-none': mergeRight,
              'bg-accent-medium-bg shadow-accent-soft border border-accent-soft-border z-[-1]!':
                focused,
            },
            (isDev || gameMode === 'practice') &&
              'cursor-pointer hover:bg-accent-medium-bg hover:shadow-accent-soft hover:border hover:border-accent-soft-border hover:z-[-1]',
          )}
          onMouseDown={() => handleMeasureMouseDown(index)}
          onMouseEnter={() => handleMeasureMouseEnter(index)}
          onClick={(event) => {
            if (
              (gameMode !== 'practice' && isDev) ||
              (gameMode === 'practice' && !isLooping)
            ) {
              onSelectMeasure(measure, event);
            }
          }}
        />
      );
    });
  }, [
    isLooping,
    renderData,
    highlightsRef,
    isDev,
    onSelectMeasure,
    gameMode,
    practiceRange,
    focusIndex,
    handleMeasureMouseDown,
    handleMeasureMouseEnter,
  ]);

  return (
    <div className="min-w-max" style={{ zoom }}>
      {gameMode === 'practice' && isLooping && practiceRange && (
        <div className="fixed top-35 ml-10 bg-bg rounded-md z-100 px-4 py-3 flex items-center gap-2">
          <div className="text-accent bg-accent-soft-bg p-2 border border-accent-soft-border rounded-md w-10 h-10 flex items-center justify-center">
            <FontAwesomeIcon icon={faRepeat} />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Looping Section</div>
            <div className="text-xs text-text-muted">
              Measure{' '}
              {practiceRange.start === practiceRange.end
                ? practiceRange.start + 1
                : `${practiceRange.start + 1} - ${practiceRange.end + 1}`}
            </div>
          </div>
          <IconButton
            icon={faXmark}
            onClick={() => onPracticeRangeChange?.(undefined)}
          />
        </div>
      )}
      <div className="flex flex-col items-center min-w-max bg-paper rounded-[11px] p-10">
        <h1 className="my-0 mx-auto text-4xl text-ink font-semibold">
          {songData.name}
        </h1>
        <div className="ml-auto text-[15px] italic font-bold flex flex-col items-end text-ink">
          <div>Music by {songData.artist}</div>
          <div>Arranged by {songData.charter}</div>
        </div>
        <div className="min-w-max relative z-0">
          <div
            ref={vexflowContainerRef}
            className="min-w-max pointer-events-none **:pointer-events-none"
          />
          {measureHighlights}
          <div
            ref={cursorRef}
            className="absolute top-0 left-0 z-1 pointer-events-none shadow-accent-button will-change-transform"
            style={{ display: 'none' }}
          >
            <div
              className="absolute w-3 h-3 bg-accent-bright left-1/2 rounded-[3px]"
              style={{ transform: 'translateX(-50%) rotate(45deg)' }}
            />
            <div className="absolute w-0.75 bg-accent-bright h-full rounded-[3px] left-1/2 -translate-x-1/2" />
          </div>
        </div>
      </div>

      {enableColors && showReference && (
        <Reference className="fixed bottom-10 left-1/2 -translate-x-1/2" />
      )}
    </div>
  );
}
