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
  Engine,
  GameMode,
  PlaybackSnapshot,
  PlaybackState,
} from '../services/engine';
import { inputBus } from '../input';

interface UseEngineParams {
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
  mode?: GameMode;
  onEnded: (score: ScoreData) => void;
}

interface UseEngineResult {
  engine: Engine | undefined;
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
  setMasterVolume: (gain: number) => void;
  setPlaybackSpeed: (speed: number) => void;
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

export function useEngine({
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
  mode,
  onEnded,
}: UseEngineParams): UseEngineResult {
  const { notification } = App.useApp();
  const onEndedRef = useRef(onEnded);
  const isDevRef = useRef(isDev);
  const modeRef = useRef(mode);
  const [fallbackTimeStore] = useState(() => new TimeStore());
  const [engine, setEngine] = useState<Engine | undefined>(undefined);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isDevRef.current = isDev;
    engine?.setDev(isDev);
  }, [engine, isDev]);

  useEffect(() => {
    const instance = new Engine({
      trackData,
      isDev: isDevRef.current,
      mode: modeRef.current,
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
  const setMasterVolume = useCallback(
    (gain: number) => engine?.setMasterVolume(gain),
    [engine],
  );
  const setPlaybackSpeed = useCallback(
    (speed: number) => engine?.setPlaybackSpeed(speed),
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
    setMasterVolume,
    setPlaybackSpeed,
  };
}
