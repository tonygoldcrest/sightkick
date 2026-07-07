import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { clamp } from 'es-toolkit';
import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { PracticeRange } from '../../types';
import { ModePolicy } from '../../modes';
import { Engine } from '../../services/engine';
import { secondsToTicks } from '../../../chart-parser/timing';
import { InputControlHandlers } from '../useInputControls';
import {
  PracticeNavDirection,
  measureIndexAtTick,
  neighborIndex,
} from './helpers';

const MIN_SPEED = 0.3;
const MAX_SPEED = 2;

interface UsePracticeSessionParams {
  engine: Engine | undefined;
  policy: ModePolicy;
  chart: ParsedChart | null;
  renderData: RenderData[];
  delaySeconds: number;
  isEnded: boolean;
  onExit: () => void;
}

interface UsePracticeSessionResult {
  focusIndex: number | undefined;
  controlHandlers: InputControlHandlers;
  practiceRange: PracticeRange | undefined;
  playbackSpeed: number;
  setPlaybackSpeed: Dispatch<SetStateAction<number>>;
  isLooping: boolean;
  setIsLooping: Dispatch<SetStateAction<boolean>>;
  onPracticeRangeChange: (range?: PracticeRange) => void;
  clearSelection: () => void;
}

export function usePracticeSession({
  engine,
  policy,
  chart,
  renderData,
  delaySeconds,
  isEnded,
  onExit,
}: UsePracticeSessionParams): UsePracticeSessionResult {
  const [focusIndex, setFocusIndex] = useState<number>();
  const [loopAnchor, setLoopAnchor] = useState<number>();
  const [practiceRange, setPracticeRange] = useState<PracticeRange>();
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(true);

  useEffect(() => {
    if (!policy.speedControl) {
      return;
    }

    engine?.setPlaybackSpeed(playbackSpeed);
  }, [engine, policy.speedControl, playbackSpeed]);

  useEffect(() => {
    if (policy.parkAtStartOnEnd && isEnded) {
      engine?.seekSeconds(delaySeconds);
    }
  }, [engine, policy.parkAtStartOnEnd, isEnded, delaySeconds]);

  useEffect(() => {
    if (!policy.looping || !isLooping || renderData.length === 0) {
      engine?.setLoopRegion(undefined);

      return;
    }

    const startMeasure =
      (practiceRange && renderData[practiceRange.start]?.measure) ??
      renderData[0].measure;
    const endMeasure =
      (practiceRange && renderData[practiceRange.end]?.measure) ??
      renderData[renderData.length - 1].measure;

    engine?.setLoopRegion({
      startTick: startMeasure.startTick,
      endTick: endMeasure.endTick,
    });
  }, [engine, policy.looping, isLooping, practiceRange, renderData]);

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
  const onPracticeRangeChange = useCallback((range?: PracticeRange) => {
    setPracticeRange(range);
    setFocusIndex(undefined);
    setLoopAnchor(undefined);
  }, []);

  return {
    focusIndex,
    controlHandlers,
    practiceRange,
    playbackSpeed,
    setPlaybackSpeed,
    isLooping,
    setIsLooping,
    onPracticeRangeChange,
    clearSelection,
  };
}
