import {
  MouseEvent,
  RefObject,
  createRef,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { cn } from '../../cn';
import { Measure, RenderData } from '../../../chart-parser/types';
import { Engine } from '../../services/engine';
import { SongData } from '../../../types';
import { Reference } from './Reference';

export interface SheetMusicProps {
  engine: Engine | undefined;
  songData: SongData;
  renderData: RenderData[];
  vexflowContainerRef: RefObject<HTMLDivElement | null>;
  isDev: boolean;
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

  useEffect(() => {
    engine?.setRendererRefs({
      cursorEl: cursorRef.current ?? undefined,
      highlightEls: highlightsRef.map((ref) => ref.current ?? undefined),
    });
  }, [engine, renderData, highlightsRef]);

  const measureHighlights = useMemo(
    () =>
      renderData.map(({ measure, stave, yOffset }, index) => (
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
            isDev &&
              'cursor-pointer hover:bg-accent-soft-bg hover:shadow-accent-soft hover:border hover:border-accent-soft-border hover:z-[-1]',
          )}
          onClick={(event) => {
            if (!isDev) {
              return;
            }

            onSelectMeasure(measure, event);
          }}
        />
      )),
    [renderData, highlightsRef, isDev, onSelectMeasure],
  );

  return (
    <div className="min-w-max" style={{ zoom }}>
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
