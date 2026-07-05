import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { App } from 'antd';
import { TrackConfig } from '../services/audio-player/types';
import { TimeStore } from '../services/time-store';
import { Measure, ParsedChart, RenderData } from '../../chart-parser/types';
import { InputMapping, ScoreData } from '../../types';
import { PlayheadStyle } from '../types';
import {
  GameEngine,
  PlaybackSnapshot,
  PlaybackState,
} from '../services/game-engine';
import { inputBus } from '../input';

interface UseGameEngineParams {
  trackData: TrackConfig[];
  isDev: boolean;
  chart: ParsedChart | null;
  measures: Measure[];
  renderData: RenderData[];
  delaySeconds: number;
  minDurationSeconds: number;
  countInEnabled: boolean;
  playheadStyle: PlayheadStyle;
  mapping: InputMapping;
  onEnded: (score: ScoreData) => void;
}

interface UseGameEngineResult {
  engine: GameEngine | undefined;
  timeStore: TimeStore;
  isReady: boolean;
  state: PlaybackState;
  isPlaying: boolean;
  isCounting: boolean;
  isStarted: boolean;
  isEnded: boolean;
  countInBeat: number | undefined;
  countInBeatMs: number | undefined;
  duration: number;
  play: () => void;
  playFromTick: (tick: number) => void;
  pause: () => void;
  cancel: () => void;
  seekSeconds: (seconds: number) => void;
  setStemVolume: (name: string, gain: number) => void;
}

const IDLE_SNAPSHOT: PlaybackSnapshot = {
  state: 'idle',
  isPlaying: false,
  isCounting: false,
  isStarted: false,
  isEnded: false,
  countInBeat: undefined,
  countInBeatMs: undefined,
  isReady: false,
  duration: 0,
};

export function useGameEngine({
  trackData,
  isDev,
  chart,
  measures,
  renderData,
  delaySeconds,
  minDurationSeconds,
  countInEnabled,
  playheadStyle,
  mapping,
  onEnded,
}: UseGameEngineParams): UseGameEngineResult {
  const { notification } = App.useApp();
  const onEndedRef = useRef(onEnded);
  const isDevRef = useRef(isDev);
  const [fallbackTimeStore] = useState(() => new TimeStore());
  const [engine, setEngine] = useState<GameEngine | undefined>(undefined);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    isDevRef.current = isDev;
    engine?.setDev(isDev);
  }, [engine, isDev]);

  useEffect(() => {
    const instance = new GameEngine({
      trackData,
      isDev: isDevRef.current,
      subscribeInput: inputBus.subscribe,
      onEnded: (score) => onEndedRef.current(score),
      onError: () =>
        notification.error({
          message: 'Audio failed to load',
          description:
            'One or more audio tracks could not be loaded for this song.',
          placement: 'bottomRight',
        }),
    });

    setEngine(instance);

    return () => {
      instance.dispose();
      setEngine(undefined);
    };
  }, [trackData, notification]);

  useEffect(() => {
    engine?.setContext({
      chart: chart ?? undefined,
      measures,
      renderData,
      delaySeconds,
      countInEnabled,
      minDurationSeconds,
    });
  }, [
    engine,
    chart,
    measures,
    renderData,
    delaySeconds,
    minDurationSeconds,
    countInEnabled,
  ]);

  useEffect(() => {
    engine?.setSettings({ playheadStyle });
  }, [engine, playheadStyle]);

  useEffect(() => {
    engine?.setMapping(mapping);
  }, [engine, mapping]);

  const subscribe = useCallback(
    (listener: () => void) => engine?.subscribe(listener) ?? (() => {}),
    [engine],
  );
  const getSnapshot = useCallback(
    () => engine?.getSnapshot() ?? IDLE_SNAPSHOT,
    [engine],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const play = useCallback(() => engine?.play(), [engine]);
  const playFromTick = useCallback(
    (tick: number) => engine?.playFromTick(tick),
    [engine],
  );
  const pause = useCallback(() => engine?.pause(), [engine]);
  const cancel = useCallback(() => engine?.cancel(), [engine]);
  const seekSeconds = useCallback(
    (seconds: number) => engine?.seekSeconds(seconds),
    [engine],
  );
  const setStemVolume = useCallback(
    (name: string, gain: number) => engine?.setStemVolume(name, gain),
    [engine],
  );

  return {
    engine,
    timeStore: engine?.timeStore ?? fallbackTimeStore,
    isReady: snapshot.isReady,
    state: snapshot.state,
    isPlaying: snapshot.isPlaying,
    isCounting: snapshot.isCounting,
    isStarted: snapshot.isStarted,
    isEnded: snapshot.isEnded,
    countInBeat: snapshot.countInBeat,
    countInBeatMs: snapshot.countInBeatMs,
    duration: snapshot.duration,
    play,
    playFromTick,
    pause,
    cancel,
    seekSeconds,
    setStemVolume,
  };
}
