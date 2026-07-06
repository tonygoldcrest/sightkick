import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { clamp } from 'es-toolkit';
import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { PracticeRange } from '../../types';
import { Engine } from '../../services/engine';
import { secondsToTicks } from '../../views/utils';
import { InputControlHandlers } from '../useInputControls';
import {
  PracticeNavDirection,
  measureIndexAtTick,
  neighborIndex,
} from './helpers';

const MIN_SPEED = 0.3;
const MAX_SPEED = 2;

interface UsePracticeNavParams {
  engine: Engine | undefined;
  chart: ParsedChart | null;
  renderData: RenderData[];
  delaySeconds: number;
  isLooping: boolean;
  practiceRange: PracticeRange | undefined;
  setPracticeRange: (range?: PracticeRange) => void;
  setPlaybackSpeed: Dispatch<SetStateAction<number>>;
  onExit: () => void;
}

interface UsePracticeNavResult {
  focusIndex: number | undefined;
  controlHandlers: InputControlHandlers;
  onPracticeRangeChange: (range?: PracticeRange) => void;
  clearSelection: () => void;
}

export function usePracticeNav({
  engine,
  chart,
  renderData,
  delaySeconds,
  isLooping,
  practiceRange,
  setPracticeRange,
  setPlaybackSpeed,
  onExit,
}: UsePracticeNavParams): UsePracticeNavResult {
  const [focusIndex, setFocusIndex] = useState<number>();
  const [loopAnchor, setLoopAnchor] = useState<number>();
  const clearSelection = useCallback(() => {
    setFocusIndex(undefined);
    setLoopAnchor(undefined);
  }, []);
  const measureAtPlayhead = () => {
    if (!engine || !chart) {
      return 0;
    }

    const tick = secondsToTicks(
      engine.timeStore.get() - delaySeconds,
      chart.resolution,
      chart.tempos,
    );

    return measureIndexAtTick(renderData, tick);
  };
  const moveFocus = (direction: PracticeNavDirection) => {
    if (focusIndex === undefined) {
      setFocusIndex(measureAtPlayhead());

      if (isLooping) {
        setPracticeRange(undefined);
      }

      return;
    }

    const next = neighborIndex(renderData, focusIndex, direction);

    setFocusIndex(next);

    if (isLooping && loopAnchor !== undefined) {
      setPracticeRange({
        start: Math.min(loopAnchor, next),
        end: Math.max(loopAnchor, next),
      });
    }
  };
  const confirm = () => {
    if (focusIndex === undefined) {
      engine?.play();

      return;
    }

    if (isLooping && loopAnchor !== undefined) {
      engine?.play();
      clearSelection();

      return;
    }

    if (!isLooping) {
      const measure = renderData[focusIndex]?.measure;

      if (measure) {
        engine?.playFromTick(measure.startTick);
      }

      return;
    }

    setLoopAnchor(focusIndex);
    setPracticeRange({ start: focusIndex, end: focusIndex });
  };
  const back = () => {
    if (!isLooping) {
      if (focusIndex !== undefined) {
        setFocusIndex(undefined);
      } else {
        onExit();
      }

      return;
    }

    if (
      focusIndex !== undefined ||
      loopAnchor !== undefined ||
      practiceRange !== undefined
    ) {
      clearSelection();
      setPracticeRange(undefined);

      return;
    }

    onExit();
  };
  const togglePause = () => {
    const snapshot = engine?.getSnapshot();

    if (snapshot?.isCounting) {
      engine?.cancel();
    } else if (snapshot?.isPlaying) {
      engine?.pause();
    }
  };
  const changeSpeed = (delta: number) => {
    setPlaybackSpeed((speed) =>
      clamp(Math.round((speed + delta) * 10) / 10, MIN_SPEED, MAX_SPEED),
    );
  };
  const controlHandlers: InputControlHandlers = {
    up: () => moveFocus('up'),
    down: () => moveFocus('down'),
    left: () => moveFocus('left'),
    right: () => moveFocus('right'),
    confirm,
    back,
    pause: togglePause,
    faster: () => changeSpeed(0.1),
    slower: () => changeSpeed(-0.1),
  };
  const onPracticeRangeChange = useCallback(
    (range?: PracticeRange) => {
      setPracticeRange(range);
      clearSelection();
    },
    [setPracticeRange, clearSelection],
  );

  return { focusIndex, controlHandlers, onPracticeRangeChange, clearSelection };
}
