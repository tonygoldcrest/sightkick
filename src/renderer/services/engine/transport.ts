import { Measure, ParsedChart } from '../../../chart-parser/types';
import {
  AudioPlayer,
  AudioPlayerFactory,
  isSpeedControllable,
  SpeedControllableAudioPlayer,
  TrackConfig,
} from '../audio-player';
import { TimeStore } from '../time-store';
import { secondsToTicks, ticksToSeconds } from '../../../chart-parser/timing';
import {
  ClickTrack,
  CountInScheduler,
  DEFAULT_CLICK_TONE,
} from '../click-track';
import { Beat, getBeatGrid, getCountInInfo } from '../beat-grid';
import {
  LoopRegion,
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
  private createPlayer: AudioPlayerFactory;
  private createdPlayer: AudioPlayer | undefined;
  private audioPlayer: AudioPlayer | undefined;
  private speedPlayer: SpeedControllableAudioPlayer | undefined;
  private state: PlaybackState = 'idle';
  private isStarted = false;
  private position = 0;
  private clickTrack: ClickTrack | undefined;
  private clickVolume = 0;
  private clickTone = DEFAULT_CLICK_TONE;
  private beatGrid: Beat[] = [];
  private nextBeatIndex = 0;
  private countIn: CountInScheduler | undefined;
  private songStartCtx: number | undefined;
  private raf: number | undefined;
  private loopRegion: LoopRegion | undefined;
  private loopRestarting = false;
  private playGeneration = 0;
  private pendingSpeed: number | undefined;
  private disposed = false;
  private listeners = new Set<() => void>();
  private snapshot: PlaybackSnapshot;

  constructor(options: TransportOptions) {
    this.isDev = options.isDev;
    this.createPlayer = options.createPlayer;
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

  setPlaybackSpeed(speed: number): void {
    if (this.state === 'counting-in') {
      this.pendingSpeed = speed;

      return;
    }

    this.pendingSpeed = undefined;
    this.applyPlaybackSpeed(speed);
  }

  private applyPlaybackSpeed(speed: number): void {
    this.speedPlayer?.setPlaybackSpeed(speed);
  }

  setLoopRegion(region: LoopRegion | undefined): void {
    const previous = this.loopRegion;

    this.loopRegion = region;

    if (
      !region ||
      (previous &&
        previous.startTick === region.startTick &&
        previous.endTick === region.endTick)
    ) {
      return;
    }

    const active = this.state === 'playing' || this.state === 'counting-in';

    if (!active) {
      return;
    }

    const startTime = this.tickToTime(region.startTick);
    const endTime = this.tickToTime(region.endTick);

    if (this.position >= startTime && this.position < endTime) {
      return;
    }

    this.playFromTick(region.startTick);
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

    if (this.loopRegion) {
      this.playFromTick(this.loopRegion.startTick);

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

    this.playGeneration += 1;

    const generation = this.playGeneration;

    this.clearScheduling();
    this.audioPlayer.stop();

    const startTime = this.tickToTime(tick);

    this.setPosition(startTime);
    this.onSeekCb(tick);
    this.nextBeatIndex = this.firstBeatIndexAtOrAfter(startTime);

    void this.beginPlayback(tick, startTime, generation);
  }

  private get playbackSpeed(): number {
    return this.speedPlayer?.playbackSpeed ?? 1;
  }

  private async beginPlayback(
    tick: number,
    startTime: number,
    generation: number,
  ): Promise<void> {
    if (!this.chart || !this.audioPlayer || !this.clickTrack) {
      return;
    }

    const ctx = this.audioPlayer.context;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (this.disposed || generation !== this.playGeneration) {
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
    const realBeatDuration = beatDurationSeconds / this.playbackSpeed;
    const now = ctx.currentTime;

    this.countIn = new CountInScheduler(now, beats, realBeatDuration);
    this.songStartCtx = this.countIn.songStartCtx;

    this.clickTrack.cancelGain();
    this.clickTrack.setGain(
      Math.max(this.clickVolume, COUNT_IN_MIN_VOLUME),
      now,
    );
    this.clickTrack.setGain(this.clickVolume, this.songStartCtx);

    for (let i = 0; i < beats; i += 1) {
      this.clickTrack.scheduleClick(now + i * realBeatDuration, i === 0);
    }

    this.state = 'counting-in';
    this.emit();

    void this.audioPlayer.start(startTime, this.songStartCtx);
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

    this.playGeneration += 1;
    this.clearScheduling();
    this.audioPlayer?.stop();
    this.state = 'parked';
    this.emit();
  }

  seekSeconds(seconds: number): void {
    if (!this.audioPlayer) {
      return;
    }

    this.playGeneration += 1;

    const wasActive = this.state === 'playing' || this.state === 'counting-in';

    this.clearScheduling();
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

    if (!wasActive) {
      this.audioPlayer.stop();
      this.state = 'parked';
      this.emit();

      return;
    }

    this.isStarted = true;
    this.state = 'playing';
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
    this.countIn = undefined;
    this.songStartCtx = undefined;
  }

  setStemVolume(name: string, gain: number): void {
    this.audioPlayer?.audioTracks
      .find((track) => track.name === name)
      ?.setVolume(gain);
  }

  setMasterVolume(gain: number): void {
    this.audioPlayer?.setMasterVolume(gain);
  }

  dispose(): void {
    this.disposed = true;
    this.playGeneration += 1;
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
    const player = this.createPlayer(
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
        this.speedPlayer = isSpeedControllable(player) ? player : undefined;
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
        this.checkLoop();
      }

      this.scheduleClicks();
      this.updateCountIn();

      this.raf = requestAnimationFrame(poll);
    };

    this.raf = requestAnimationFrame(poll);
  }

  private checkLoop(): void {
    if (!this.loopRegion || !this.audioPlayer) {
      return;
    }

    const endTime = this.tickToTime(this.loopRegion.endTick);

    if (this.audioPlayer.currentTime >= endTime) {
      this.restartLoop();
    } else {
      this.loopRestarting = false;
    }
  }

  private restartLoop(): void {
    if (this.loopRestarting || !this.loopRegion) {
      return;
    }

    this.loopRestarting = true;
    this.playFromTick(this.loopRegion.startTick);
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
    if (this.state !== 'counting-in' || !this.audioPlayer || !this.countIn) {
      return;
    }

    const now = this.audioPlayer.context.currentTime;

    if (this.countIn.isComplete(now)) {
      this.countIn = undefined;
      this.isStarted = true;
      this.state = 'playing';

      if (this.pendingSpeed !== undefined) {
        this.applyPlaybackSpeed(this.pendingSpeed);
        this.pendingSpeed = undefined;
      }

      this.emit();

      return;
    }

    if (this.countIn.advanceTo(now)) {
      this.emit();
    }
  }

  private handleEnded(): void {
    if (this.loopRegion) {
      this.restartLoop();

      return;
    }

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
      countInBeat: this.countIn?.beat,
      countInBeatMs: this.countIn?.beatMs,
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
