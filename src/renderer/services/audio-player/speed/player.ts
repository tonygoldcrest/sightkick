import { SpeedAudioTrack } from './track';
import { StretchStream } from './stretch-stream';
import { BaseAudioPlayer } from '../base-player';
import { SpeedControllableAudioPlayer, TrackConfig } from '../types';

const FRAMES_PER_CHUNK = 64;
const LOOKAHEAD_SECONDS = 2;
const SCHEDULER_INTERVAL_MS = 100;
const START_LEAD_SECONDS = 0.1;

interface ChunkTarget {
  track: SpeedAudioTrack;
  fileIndex: number;
  channels: number;
  voiceStart: number;
  sampleRate: number;
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
  private voicesBuilt: boolean = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private scheduledUntil: number = 0;
  private outputProducedSeconds: number = 0;
  private totalOutputSeconds: number = 0;
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

    const resumeAt =
      this.isInitialised && this.context.state === 'running'
        ? this.currentTime
        : undefined;

    this._playbackSpeed = speed;
    this.prepare();

    if (resumeAt !== undefined) {
      void this.start(resumeAt);
    }
  }

  private prepare() {
    const speed = this._playbackSpeed;

    this.prepared = this.ready
      .then((tracks) => {
        if (!this.voicesBuilt) {
          this.buildVoices(tracks);
          this.stream.init(this.voices, speed);
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

    const outputStartSeconds = offset / speed;

    this.stream.seek(Math.round(outputStartSeconds * sampleRate));
    this.outputProducedSeconds = outputStartSeconds;

    const firstBlocks = await this.stream.produce(FRAMES_PER_CHUNK);

    if (epoch !== this.epoch) {
      return;
    }

    const leadStartAt = this.context.currentTime + START_LEAD_SECONDS;
    const startAt = Math.max(requestedStartAt ?? leadStartAt, leadStartAt);

    this.startedAt = startAt;
    this.scheduledUntil = startAt;
    this.isInitialised = true;

    if (firstBlocks.length > 0) {
      this.scheduleBlocks(firstBlocks, this.scheduledUntil);

      const chunkDuration = firstBlocks[0].length / sampleRate;

      this.scheduledUntil += chunkDuration;
      this.outputProducedSeconds += chunkDuration;
    }

    this.timer = setInterval(this.pump, SCHEDULER_INTERVAL_MS);
  }

  private scheduleBlocks(blocks: Float32Array[], at: number) {
    this.targets.forEach((target) => {
      const length = blocks[target.voiceStart].length;
      const buffer = this.context.createBuffer(
        target.channels,
        length,
        target.sampleRate,
      );

      for (let channel = 0; channel < target.channels; channel += 1) {
        buffer.copyToChannel(
          blocks[target.voiceStart + channel] as Float32Array<ArrayBuffer>,
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
        this.outputProducedSeconds < this.totalOutputSeconds
      ) {
        const blocks = await this.stream.produce(FRAMES_PER_CHUNK);

        if (
          epoch !== this.epoch ||
          !this.isInitialised ||
          blocks.length === 0
        ) {
          break;
        }

        this.scheduleBlocks(blocks, this.scheduledUntil);

        const chunkDuration = blocks[0].length / this.context.sampleRate;

        this.scheduledUntil += chunkDuration;
        this.outputProducedSeconds += chunkDuration;
      }
    } finally {
      this.pumping = false;
    }

    if (
      epoch === this.epoch &&
      this.isInitialised &&
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

    return Math.min(
      this.duration,
      Math.max(
        this.offset,
        (this.context.currentTime - this.startedAt) * this._playbackSpeed +
          this.offset -
          latency,
      ),
    );
  }

  destroy() {
    this.stop();
    super.destroy();
    this.onEnded = undefined;
    this.stream.destroy();
  }
}
