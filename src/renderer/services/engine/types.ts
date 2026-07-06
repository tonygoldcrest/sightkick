import { StaveNote } from 'vexflow';
import { Measure, ParsedChart, RenderData } from '../../../chart-parser/types';
import { InputMapping, ScoreData } from '../../../types';
import { GameMode, PlayheadStyle } from '../../types';
import { InputEvent } from '../../input/types';
import { AudioPlayerFactory, TrackConfig } from '../audio-player';

export interface EngineOptions {
  trackData: TrackConfig[];
  isDev: boolean;
  gameMode?: GameMode;
  subscribeInput: (listener: (event: InputEvent) => void) => () => void;
  onEnded: (score: ScoreData) => void;
  onError: () => void;
}

export interface EngineContext {
  chart: ParsedChart | undefined;
  measures: Measure[];
  renderData: RenderData[];
  delaySeconds: number;
  countInEnabled: boolean;
  minDurationSeconds: number;
}

export interface EngineSettings {
  playheadStyle: PlayheadStyle;
}

export type JudgeHitHandler = (note: StaveNote, prefixes: string[]) => void;

export interface JudgeContext {
  chart: ParsedChart | undefined;
  renderData: RenderData[];
  mapping: InputMapping;
}

export type IsHit = (tick: number, prefix: string) => boolean;

export interface GameRendererContext {
  chart: ParsedChart | undefined;
  renderData: RenderData[];
}

export interface GameRendererRefs {
  cursorEl: HTMLElement | undefined;
  highlightEls: (HTMLElement | undefined)[];
}

export interface NotePos {
  measureIdx: number;
  noteIdx: number;
}

export interface ActiveNote extends NotePos {
  noteHeadEls: SVGElement[];
}

export type PlaybackState =
  | 'idle'
  | 'parked'
  | 'counting-in'
  | 'playing'
  | 'ended';

export interface LoopRegion {
  startTick: number;
  endTick: number;
}

export interface TransportContext {
  chart: ParsedChart | undefined;
  measures: Measure[];
  delaySeconds: number;
  countInEnabled: boolean;
  minDurationSeconds: number;
}

export interface PlaybackSnapshot {
  state: PlaybackState;
  isPlaying: boolean;
  isCounting: boolean;
  isStarted: boolean;
  isEnded: boolean;
  countInBeat: number | undefined;
  countInBeatMs: number | undefined;
  isReady: boolean;
  duration: number;
}

export interface TransportOptions {
  trackData: TrackConfig[];
  isDev: boolean;
  createPlayer: AudioPlayerFactory;
  onEnded: () => void;
  onError: () => void;
  onSeek?: (tick: number) => void;
}
