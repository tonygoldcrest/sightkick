import { Measure, ParsedChart } from '../../../chart-parser/types';
import { AudioPlayer, TrackConfig } from '../audio-player';
import { TimeStore } from '../time-store';
import { secondsToTicks, ticksToSeconds } from '../../views/utils';
import { ClickTrack, DEFAULT_CLICK_TONE } from '../click-track';
import { Beat, getBeatGrid, getCountInInfo } from '../beat-grid';
import {
  PlaybackSnapshot,
  PlaybackState,
  TransportContext,
  TransportOptions,
} from './types';
import {
  COUNT_IN_MIN_VOLUME,
  LOOKAHEAD_SECONDS,
  SNAPSHOT_KEYS,
} from './constants';

export class Transport {
  readonly timeStore = new TimeStore();
  private isDev: boolean;
  private onEndedCb: () => void;
  private onErrorCb: () => void;
  private onSeekCb: (tick: number) => void;
  private chart: ParsedChart | undefined;
  private measures: Measure[] = [];
  private delaySeconds = 0;
  private countInEnabled = false;
  private minDurationSeconds = 0;
  private createdPlayer: AudioPlayer | undefined;
  private audioPlayer: AudioPlayer | undefined;
  private state: PlaybackState = 'idle';
  private isStarted = false;
  private position = 0;
  private countInBeat: number | undefined;
  private countInBeatMs: number | undefined;
  private clickTrack: ClickTrack | undefined;
  private clickVolume = 0;
  private clickTone = DEFAULT_CLICK_TONE;
  private beatGrid: Beat[] = [];
  private nextBeatIndex = 0;
  private countInStartCtx: number | undefined;
  private countInBeatDuration: number | undefined;
  private countInBeats: number | undefined;
  private songStartCtx: number | undefined;
  private raf: number | undefined;
  private disposed = false;
  private listeners = new Set<() => void>();
  private snapshot: PlaybackSnapshot;

  constructor(options: TransportOptions) {
    this.isDev = options.isDev;
    this.onEndedCb = options.onEnded;
    this.onErrorCb = options.onError;
    this.onSeekCb = options.onSeek ?? (() => {});
    this.snapshot = this.buildSnapshot();

    if (options.trackData.length > 0) {
      this.initAudio(options.trackData);
    }

    this.startPolling();
  }

  setContext(context: TransportContext): void {
    this.chart = context.chart;
    this.measures = context.measures;
    this.delaySeconds = context.delaySeconds;
    this.countInEnabled = context.countInEnabled;
    this.minDurationSeconds = context.minDurationSeconds;
    this.beatGrid = context.chart
      ? getBeatGrid(context.measures, context.chart)
      : [];
  }

  setClickSettings(volume: number, tone: number): void {
    this.clickVolume = Math.max(0, Math.min(1, volume));
    this.clickTone = tone;
    this.clickTrack?.setTone(tone);
    this.applyClickVolume();
  }

  private applyClickVolume(): void {
    if (!this.clickTrack || !this.audioPlayer) {
      return;
    }

    if (this.state === 'playing') {
      this.clickTrack.cancelGain();
      this.clickTrack.setGain(this.clickVolume);
    } else if (
      this.state === 'counting-in' &&
      this.songStartCtx !== undefined
    ) {
      this.clickTrack.cancelGain();
      this.clickTrack.setGain(Math.max(this.clickVolume, COUNT_IN_MIN_VOLUME));
      this.clickTrack.setGain(this.clickVolume, this.songStartCtx);
    }
  }

  setDev(isDev: boolean): void {
    this.isDev = isDev;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlaybackSnapshot => this.snapshot;

  play(): void {
    if (!this.chart) {
      return;
    }

    const tick = secondsToTicks(
      Math.max(0, this.position - this.delaySeconds),
      this.chart.resolution,
      this.chart.tempos,
    );
    const measure = this.measures.find(
      (m) => tick >= m.startTick && tick < m.endTick,
    );

    this.playFromTick(measure?.startTick ?? 0);
  }

  playFromTick(tick: number): void {
    if (!this.chart || !this.audioPlayer) {
      return;
    }

    this.clearScheduling();
    this.audioPlayer.stop();

    const startTime = this.tickToTime(tick);

    this.setPosition(startTime);
    this.onSeekCb(tick);
    this.nextBeatIndex = this.firstBeatIndexAtOrAfter(startTime);

    void this.beginPlayback(tick, startTime);
  }

  private async beginPlayback(tick: number, startTime: number): Promise<void> {
    if (!this.chart || !this.audioPlayer || !this.clickTrack) {
      return;
    }

    const ctx = this.audioPlayer.context;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (this.disposed) {
      return;
    }

    if (!this.countInEnabled) {
      this.songStartCtx = ctx.currentTime;
      this.clickTrack.cancelGain();
      this.clickTrack.setGain(this.clickVolume);
      void this.audioPlayer.start(startTime);
      this.isStarted = true;
      this.state = 'playing';
      this.emit();

      return;
    }

    const { beats, beatDurationSeconds } = getCountInInfo(
      tick,
      this.measures,
      this.chart,
    );
    const now = ctx.currentTime;
    const songStart = now + beats * beatDurationSeconds;

    this.songStartCtx = songStart;
    this.countInStartCtx = now;
    this.countInBeatDuration = beatDurationSeconds;
    this.countInBeats = beats;
    this.countInBeat = 1;
    this.countInBeatMs = beatDurationSeconds * 1000;

    this.clickTrack.cancelGain();
    this.clickTrack.setGain(
      Math.max(this.clickVolume, COUNT_IN_MIN_VOLUME),
      now,
    );
    this.clickTrack.setGain(this.clickVolume, songStart);

    for (let i = 0; i < beats; i += 1) {
      this.clickTrack.scheduleClick(now + i * beatDurationSeconds, i === 0);
    }

    this.state = 'counting-in';
    this.emit();

    void this.audioPlayer.start(startTime, songStart);
  }

  pause(): void {
    if (!this.audioPlayer || this.state !== 'playing') {
      return;
    }

    this.setPosition(this.audioPlayer.currentTime);
    this.audioPlayer.pause();
    this.clickTrack?.clearPending();
    this.state = 'parked';
    this.emit();
  }

  cancel(): void {
    if (this.state !== 'counting-in') {
      return;
    }

    this.clearScheduling();
    this.audioPlayer?.stop();
    this.state = 'parked';
    this.emit();
  }

  seekSeconds(seconds: number): void {
    if (!this.audioPlayer) {
      return;
    }

    this.clearScheduling();
    this.isStarted = true;
    this.state = 'playing';
    this.setPosition(seconds);
    this.nextBeatIndex = this.firstBeatIndexAtOrAfter(seconds);

    if (this.chart) {
      this.onSeekCb(
        secondsToTicks(
          seconds - this.delaySeconds,
          this.chart.resolution,
          this.chart.tempos,
        ),
      );
    }

    this.songStartCtx = this.audioPlayer.context.currentTime;
    this.clickTrack?.cancelGain();
    this.clickTrack?.setGain(this.clickVolume);
    void this.audioPlayer.start(seconds);
    this.emit();
  }

  private firstBeatIndexAtOrAfter(songTime: number): number {
    const index = this.beatGrid.findIndex(
      (beat) => beat.timeSeconds + this.delaySeconds >= songTime - 1e-4,
    );

    return index < 0 ? this.beatGrid.length : index;
  }

  private clearScheduling(): void {
    this.clickTrack?.clearPending();
    this.clickTrack?.cancelGain();
    this.countInBeat = undefined;
    this.countInBeatMs = undefined;
    this.countInStartCtx = undefined;
    this.countInBeatDuration = undefined;
    this.countInBeats = undefined;
    this.songStartCtx = undefined;
  }

  setStemVolume(name: string, gain: number): void {
    this.audioPlayer?.audioTracks
      .find((track) => track.name === name)
      ?.setVolume(gain);
  }

  dispose(): void {
    this.disposed = true;
    this.clearScheduling();
    this.clickTrack?.dispose();

    if (this.raf !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.raf);
    }

    if (this.createdPlayer) {
      if (this.isDev) {
        this.createdPlayer.stop();
      } else {
        this.createdPlayer.destroy();
      }
    }

    this.listeners.clear();
  }

  private initAudio(trackData: TrackConfig[]): void {
    const player = new AudioPlayer(
      trackData,
      () => this.handleEnded(),
      () => this.minDurationSeconds,
    );

    this.createdPlayer = player;

    player.ready
      .then(() => {
        if (this.disposed) {
          return;
        }

        this.audioPlayer = player;
        this.clickTrack = new ClickTrack(player.context);
        this.clickTrack.setTone(this.clickTone);
        this.emit();
      })
      .catch(() => {
        if (this.disposed) {
          return;
        }

        this.onErrorCb();
      });
  }

  private startPolling(): void {
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }

    const poll = () => {
      if (this.disposed) {
        return;
      }

      if (this.state === 'playing' && this.audioPlayer?.isInitialised) {
        this.setPosition(this.audioPlayer.currentTime);
      }

      this.scheduleClicks();
      this.updateCountIn();

      this.raf = requestAnimationFrame(poll);
    };

    this.raf = requestAnimationFrame(poll);
  }

  private scheduleClicks(): void {
    if (
      !this.clickTrack ||
      !this.audioPlayer?.isInitialised ||
      (this.state !== 'playing' && this.state !== 'counting-in')
    ) {
      return;
    }

    const ctx = this.audioPlayer.context;
    const horizon = ctx.currentTime + LOOKAHEAD_SECONDS;

    while (this.nextBeatIndex < this.beatGrid.length) {
      const beat = this.beatGrid[this.nextBeatIndex];
      const songTime = beat.timeSeconds + this.delaySeconds;
      const contextTime = this.audioPlayer.contextTimeForSongTime(songTime);

      if (contextTime > horizon) {
        break;
      }

      this.clickTrack.scheduleClick(contextTime, beat.isDownbeat);
      this.nextBeatIndex += 1;
    }
  }

  private updateCountIn(): void {
    if (
      this.state !== 'counting-in' ||
      !this.audioPlayer ||
      this.countInStartCtx === undefined ||
      this.countInBeatDuration === undefined ||
      this.songStartCtx === undefined
    ) {
      return;
    }

    const now = this.audioPlayer.context.currentTime;

    if (now >= this.songStartCtx) {
      this.countInBeat = undefined;
      this.countInBeatMs = undefined;
      this.countInStartCtx = undefined;
      this.isStarted = true;
      this.state = 'playing';
      this.emit();

      return;
    }

    const elapsed = now - this.countInStartCtx;
    const beat = Math.min(
      this.countInBeats ?? 1,
      Math.max(1, Math.floor(elapsed / this.countInBeatDuration) + 1),
    );

    if (beat !== this.countInBeat) {
      this.countInBeat = beat;
      this.emit();
    }
  }

  private handleEnded(): void {
    this.state = 'ended';
    this.clickTrack?.clearPending();
    this.emit();
    this.onEndedCb();
  }

  private tickToTime(tick: number): number {
    return this.chart
      ? ticksToSeconds(tick, this.chart.resolution, this.chart.tempos) +
          this.delaySeconds
      : 0;
  }

  private setPosition(seconds: number): void {
    this.position = seconds;
    this.timeStore.set(seconds);
  }

  private buildSnapshot(): PlaybackSnapshot {
    return {
      state: this.state,
      isPlaying: this.state === 'playing',
      isCounting: this.state === 'counting-in',
      isStarted: this.isStarted,
      isEnded: this.state === 'ended',
      countInBeat: this.countInBeat,
      countInBeatMs: this.countInBeatMs,
      isReady: this.audioPlayer !== undefined,
      duration: this.audioPlayer?.duration ?? 0,
    };
  }

  private emit(): void {
    const next = this.buildSnapshot();

    if (SNAPSHOT_KEYS.every((key) => this.snapshot[key] === next[key])) {
      return;
    }

    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
