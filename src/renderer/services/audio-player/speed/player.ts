import { SpeedAudioTrack } from './track';
import { StretchStream } from './stretch-stream';
import { VoiceGroup } from './build-units';
import { SYNTHESIS_HOP } from './channel-stretcher';
import { BaseAudioPlayer } from '../base-player';
import {
  LoopWindow,
  SampleBlock,
  SpeedControllableAudioPlayer,
  TrackConfig,
} from '../types';

const FRAMES_PER_CHUNK = 64;
const LOOKAHEAD_SECONDS = 2;
const SCHEDULER_INTERVAL_MS = 100;
const START_LEAD_SECONDS = 0.1;
const DRUM_TRACK_NAME = 'drums';

interface ChunkTarget {
  track: SpeedAudioTrack;
  fileIndex: number;
  channels: number;
  voiceStart: number;
  sampleRate: number;
}

interface ProducedChunk {
  blocks: SampleBlock[];
  sampleCount: number;
}

export class SpeedAudioPlayer
  extends BaseAudioPlayer<SpeedAudioTrack>
  implements SpeedControllableAudioPlayer
{
  prepared: Promise<void> = Promise.resolve();
  onEnded: (() => void) | undefined;
  private _playbackSpeed: number = 1;
  private stream: StretchStream = new StretchStream();
  private voices: Float32Array[] = [];
  private targets: ChunkTarget[] = [];
  private groups: VoiceGroup[] = [];
  private voicesBuilt: boolean = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private scheduledUntil: number = 0;
  private outputProducedSeconds: number = 0;
  private totalOutputSeconds: number = 0;
  private totalScheduledSamples: number = 0;
  private loopPass: number = 0;
  private pumping: boolean = false;
  private epoch: number = 0;

  constructor(
    trackConfigs: TrackConfig[],
    onEnded: () => void,
    getMinDurationSeconds: () => number = () => 0,
  ) {
    super(trackConfigs, getMinDurationSeconds);
    this.onEnded = onEnded;
    this.prepare();
  }

  protected createTrack(buffers: AudioBuffer[], name: string): SpeedAudioTrack {
    return new SpeedAudioTrack(buffers, name, this.context, this.masterGain);
  }

  contextTimeForSongTime(songTime: number): number {
    if (this.startedAt < 0) {
      return this.context.currentTime;
    }

    return this.startedAt + (songTime - this.offset) / this._playbackSpeed;
  }

  get playbackSpeed() {
    return this._playbackSpeed;
  }

  setPlaybackSpeed(speed: number) {
    if (speed === this._playbackSpeed) {
      return;
    }

    const running = this.isInitialised && this.context.state === 'running';
    const resumeAt = running ? this.currentTime : undefined;
    const deferredStart =
      running && this.startedAt > this.context.currentTime
        ? this.startedAt
        : undefined;

    this._playbackSpeed = speed;
    this.prepare();

    if (resumeAt !== undefined) {
      void this.start(resumeAt, deferredStart);
    }
  }

  setLoop(loop: LoopWindow | undefined) {
    if (this.loop?.start === loop?.start && this.loop?.end === loop?.end) {
      return;
    }

    const running = this.isInitialised && this.context.state === 'running';

    if (!running) {
      this.loop = loop;

      return;
    }

    const resumeAt = this.currentTime;
    const deferredStart =
      this.startedAt > this.context.currentTime ? this.startedAt : undefined;
    const scheduledSongEnd =
      this.offset +
      (this.totalScheduledSamples / this.context.sampleRate) *
        this._playbackSpeed;
    const needsRestart =
      this.loopPass > 0 ||
      (loop !== undefined &&
        loop.end > loop.start &&
        scheduledSongEnd > loop.end);

    this.loop = loop;

    if (
      needsRestart &&
      (!loop || (resumeAt >= loop.start && resumeAt < loop.end))
    ) {
      void this.start(resumeAt, deferredStart);
    }
  }

  private prepare() {
    const speed = this._playbackSpeed;

    this.prepared = this.ready
      .then((tracks) => {
        if (!this.voicesBuilt) {
          this.buildVoices(tracks);
          this.stream.init(
            this.voices,
            speed,
            this.groups,
            this.context.sampleRate,
          );
          this.voicesBuilt = true;
        } else {
          this.stream.setSpeed(speed);
        }
      })
      .catch(() => {});
  }

  private buildVoices(tracks: SpeedAudioTrack[]) {
    this.voices = [];
    this.targets = [];
    this.groups = [];

    tracks.forEach((track) => {
      track.buffers.forEach((buffer, fileIndex) => {
        const voiceStart = this.voices.length;

        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
          this.voices.push(buffer.getChannelData(channel));
        }

        this.targets.push({
          track,
          fileIndex,
          channels: buffer.numberOfChannels,
          voiceStart,
          sampleRate: buffer.sampleRate,
        });

        this.groups.push({
          start: voiceStart,
          count: buffer.numberOfChannels,
          kind: track.name === DRUM_TRACK_NAME ? 'transient' : 'vocoder',
        });
      });
    });
  }

  async start(offset: number = 0, requestedStartAt?: number) {
    if (this.isInitialised) {
      this.stop();
    }

    this.offset = offset;
    this.epoch += 1;

    const epoch = this.epoch;

    await this.prepared;

    if (this.context.state === 'suspended') {
      await this.context.resume().catch(() => {});
    }

    if (epoch !== this.epoch) {
      return;
    }

    const speed = this._playbackSpeed;
    const { sampleRate } = this.context;

    this.totalOutputSeconds = this.duration / speed;
    this.totalScheduledSamples = 0;
    this.loopPass = 0;

    const outputStartSeconds = offset / speed;

    this.stream.seek(Math.round(outputStartSeconds * sampleRate));
    this.outputProducedSeconds = outputStartSeconds;

    const firstChunk = await this.produceNextChunk(epoch);

    if (epoch !== this.epoch) {
      return;
    }

    const leadStartAt = this.context.currentTime + START_LEAD_SECONDS;
    const startAt = Math.max(requestedStartAt ?? leadStartAt, leadStartAt);

    this.startedAt = startAt;
    this.scheduledUntil = startAt;
    this.isInitialised = true;

    if (firstChunk) {
      this.commitChunk(firstChunk);
    }

    this.timer = setInterval(this.pump, SCHEDULER_INTERVAL_MS);
  }

  private async produceNextChunk(
    epoch: number,
  ): Promise<ProducedChunk | undefined> {
    if (!this.hasActiveLoop()) {
      const blocks = await this.stream.produce(FRAMES_PER_CHUNK);

      if (epoch !== this.epoch || blocks.length === 0) {
        return undefined;
      }

      return { blocks, sampleCount: blocks[0].length };
    }

    const speed = this._playbackSpeed;
    const { sampleRate } = this.context;
    const { start, end } = this.loop;
    const span = end - start;
    let remainingInPass = this.remainingSamplesInLoopPass(
      start,
      end,
      span,
      speed,
      sampleRate,
    );

    if (remainingInPass <= 0) {
      this.loopPass += 1;
      this.stream.seek(Math.round((start / speed) * sampleRate));
      remainingInPass = this.remainingSamplesInLoopPass(
        start,
        end,
        span,
        speed,
        sampleRate,
      );
    }

    const maxChunkSamples = FRAMES_PER_CHUNK * SYNTHESIS_HOP;
    const sampleCount = Math.min(maxChunkSamples, remainingInPass);
    const frames = Math.max(1, Math.ceil(sampleCount / SYNTHESIS_HOP));
    const wrapsAtEnd = sampleCount === remainingInPass;
    const blocks = await this.stream.produce(frames);

    if (epoch !== this.epoch || blocks.length === 0) {
      return undefined;
    }

    if (wrapsAtEnd && this.hasActiveLoop()) {
      this.loopPass += 1;
      this.stream.seek(
        Math.round((this.loop.start / this._playbackSpeed) * sampleRate),
      );
    }

    return {
      blocks,
      sampleCount: Math.min(sampleCount, blocks[0].length),
    };
  }

  private remainingSamplesInLoopPass(
    start: number,
    end: number,
    span: number,
    speed: number,
    sampleRate: number,
  ): number {
    const unwrappedLoopEnd = end + this.loopPass * span;
    const targetEndSamples = Math.round(
      ((unwrappedLoopEnd - this.offset) / speed) * sampleRate,
    );

    return targetEndSamples - this.totalScheduledSamples;
  }

  private commitChunk({ blocks, sampleCount }: ProducedChunk) {
    if (sampleCount <= 0) {
      return;
    }

    this.scheduleBlocks(blocks, this.scheduledUntil, sampleCount);

    const chunkDuration = sampleCount / this.context.sampleRate;

    this.scheduledUntil += chunkDuration;
    this.totalScheduledSamples += sampleCount;
    this.outputProducedSeconds += chunkDuration;
  }

  private scheduleBlocks(
    blocks: SampleBlock[],
    at: number,
    sampleCount: number,
  ) {
    this.targets.forEach((target) => {
      const length = Math.min(sampleCount, blocks[target.voiceStart].length);
      const buffer = this.context.createBuffer(
        target.channels,
        length,
        target.sampleRate,
      );

      for (let channel = 0; channel < target.channels; channel += 1) {
        buffer.copyToChannel(
          blocks[target.voiceStart + channel].subarray(0, length),
          channel,
        );
      }

      target.track.scheduleChunk(target.fileIndex, buffer, at);
    });
  }

  private pump = async () => {
    if (this.pumping || !this.isInitialised) {
      return;
    }

    this.pumping = true;

    const epoch = this.epoch;

    try {
      while (
        epoch === this.epoch &&
        this.isInitialised &&
        this.scheduledUntil < this.context.currentTime + LOOKAHEAD_SECONDS &&
        (this.hasActiveLoop() ||
          this.outputProducedSeconds < this.totalOutputSeconds)
      ) {
        const chunk = await this.produceNextChunk(epoch);

        if (epoch !== this.epoch || !this.isInitialised || !chunk) {
          break;
        }

        this.commitChunk(chunk);
      }
    } finally {
      this.pumping = false;
    }

    if (
      epoch === this.epoch &&
      this.isInitialised &&
      !this.hasActiveLoop() &&
      this.outputProducedSeconds >= this.totalOutputSeconds &&
      this.context.currentTime >= this.scheduledUntil
    ) {
      this.stop();
      this.onEnded?.();
    }
  };

  stop() {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.audioTracks.forEach((track) => track.stop());
    this.isInitialised = false;
    this.startedAt = -1;
    this.epoch += 1;
  }

  get currentTime() {
    if (this.startedAt < 0) {
      return 0;
    }

    const latency = this.context.state === 'running' ? this.outputLatency : 0;
    const unwrapped = Math.max(
      this.offset,
      (this.context.currentTime - this.startedAt) * this._playbackSpeed +
        this.offset -
        latency * this._playbackSpeed,
    );

    if (this.hasActiveLoop()) {
      return this.wrapLoopTime(unwrapped);
    }

    return Math.min(this.duration, unwrapped);
  }

  destroy() {
    this.stop();
    super.destroy();
    this.onEnded = undefined;
    this.stream.destroy();
  }
}
