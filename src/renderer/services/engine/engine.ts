import { Measure, ParsedChart } from '../../../chart-parser/types';
import { InputMapping, ScoreData } from '../../../types';
import { secondsToTicks } from '../../../chart-parser/timing';
import { TimeStore } from '../time-store';
import { AudioPlayer } from '../audio-player/types';
import { playerFactoryForMode } from '../audio-player/factories';
import { Transport } from './transport';
import { Judge } from './judge';
import { GameRenderer } from './game-renderer';
import {
  EngineContext,
  EngineOptions,
  GameRendererRefs,
  EngineSettings,
  LoopRegion,
  PlaybackSnapshot,
} from './types';

export class Engine {
  private transport: Transport;
  private player: AudioPlayer | undefined;
  private judge = new Judge();
  private renderer = new GameRenderer((tick, key) =>
    this.judge.isHit(tick, key),
  );
  private onEndedCb: (score: ScoreData) => void;
  private chart: ParsedChart | undefined;
  private measures: Measure[] = [];
  private delaySeconds = 0;
  private mapping: InputMapping = {};
  private timeUnsub: () => void;
  private transportUnsub: () => void;
  private inputUnsub: () => void;

  constructor(options: EngineOptions) {
    this.onEndedCb = options.onEnded;

    const createPlayer = playerFactoryForMode(options.player);

    this.transport = new Transport({
      trackData: options.trackData,
      isDev: options.isDev,
      createPlayer: (trackConfigs, onEnded, getMinDurationSeconds) => {
        this.player = createPlayer(
          trackConfigs,
          onEnded,
          getMinDurationSeconds,
        );

        return this.player;
      },
      onEnded: () => this.handleEnded(),
      onError: options.onError,
      onSeek: (tick) => this.judge.rewindTo(tick),
    });
    this.timeUnsub = this.transport.timeStore.subscribe(this.handleFrame);
    this.transportUnsub = this.transport.subscribe(this.handleTransportChange);
    this.inputUnsub = options.subscribeInput((event) =>
      this.judge.handleInput(event),
    );
    this.judge.onHit((pos, prefixes) => this.renderer.paintHit(pos, prefixes));
  }

  get timeStore(): TimeStore {
    return this.transport.timeStore;
  }

  subscribe = (listener: () => void): (() => void) =>
    this.transport.subscribe(listener);

  getSnapshot = (): PlaybackSnapshot => this.transport.getSnapshot();

  setContext(context: EngineContext): void {
    this.chart = context.chart;
    this.measures = context.measures;
    this.delaySeconds = context.delaySeconds;
    this.renderer.setContext({
      chart: context.chart,
      renderData: context.renderData,
    });
    this.transport.setContext({
      chart: context.chart,
      measures: context.measures,
      delaySeconds: context.delaySeconds,
      countInEnabled: context.countInEnabled,
      minDurationSeconds: context.minDurationSeconds,
    });
    this.judge.setContext({
      chart: context.chart,
      measures: context.measures,
      mapping: this.mapping,
    });

    this.renderFrame();
  }

  setSettings(settings: EngineSettings): void {
    this.renderer.setSettings(settings.playheadStyle);
    this.renderFrame();
  }

  setClickSettings(volume: number, tone: number): void {
    this.transport.setClickSettings(volume, tone);
  }

  setMapping(mapping: InputMapping): void {
    this.mapping = mapping;
    this.judge.setContext({
      chart: this.chart,
      measures: this.measures,
      mapping,
    });
  }

  setRendererRefs(rendererRefs: GameRendererRefs): void {
    this.renderer.setRefs(rendererRefs);
    this.renderFrame();
  }

  setDev(isDev: boolean): void {
    this.transport.setDev(isDev);
  }

  setLoopRegion(region: LoopRegion | undefined): void {
    this.transport.setLoopRegion(region);
  }

  play(): void {
    this.transport.play();
  }

  playFromTick(tick: number): void {
    this.transport.playFromTick(tick);
  }

  pause(): void {
    this.transport.pause();
  }

  cancel(): void {
    this.transport.cancel();
  }

  seekSeconds(seconds: number): void {
    this.transport.seekSeconds(seconds);
  }

  setStemVolume(name: string, gain: number): void {
    this.transport.setStemVolume(name, gain);
  }

  setMasterVolume(gain: number): void {
    this.transport.setMasterVolume(gain);
  }

  setPlaybackSpeed(speed: number): void {
    this.transport.setPlaybackSpeed(speed);
  }

  renderFrame(): void {
    if (!this.chart) {
      return;
    }

    const chartTime = this.transport.timeStore.get() - this.delaySeconds;
    const tick = secondsToTicks(
      chartTime,
      this.chart.resolution,
      this.chart.tempos,
    );

    this.judge.setTick(tick);
    this.renderer.render(chartTime, tick);
  }

  dispose(): void {
    this.timeUnsub();
    this.transportUnsub();
    this.inputUnsub();
    this.transport.dispose();
  }

  private handleFrame = (): void => {
    this.renderFrame();
  };

  private handleTransportChange = (): void => {
    this.judge.setEnabled(this.transport.getSnapshot().isPlaying);
  };

  private handleEnded(): void {
    this.onEndedCb({
      hitNotes: this.judge.hitCount,
      falseHits: this.judge.falseHitCount,
      totalNotes: this.totalNotes(),
    });
  }

  private totalNotes(): number {
    return this.measures
      .flatMap((measure) => measure.notes)
      .filter((note) => !note.isRest)
      .reduce((sum, note) => sum + note.notes.length, 0);
  }
}
