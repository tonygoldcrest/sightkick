import { DefaultAudioTrack } from './track';
import { BaseAudioPlayer } from '../base-player';
import { AudioPlayer, LoopWindow, TrackConfig } from '../types';

export class DefaultAudioPlayer
  extends BaseAudioPlayer<DefaultAudioTrack>
  implements AudioPlayer
{
  onEnded: (() => void) | null;

  constructor(
    trackConfigs: TrackConfig[],
    onEnded: () => void,
    getMinDurationSeconds: () => number = () => 0,
  ) {
    super(trackConfigs, getMinDurationSeconds);
    this.onEnded = onEnded;
  }

  protected createTrack(
    buffers: AudioBuffer[],
    name: string,
  ): DefaultAudioTrack {
    const track = new DefaultAudioTrack(
      buffers,
      name,
      this.context,
      this.masterGain,
    );

    track.setLoop(this.loop);
    track.endedListener = this.trackEndedListener;

    return track;
  }

  setLoop(loop: LoopWindow | undefined) {
    if (this.loop?.start === loop?.start && this.loop?.end === loop?.end) {
      return;
    }

    const running = this.isInitialised && this.context.state === 'running';
    const resumeAt = running ? this.currentTime : undefined;
    const unwrapped =
      running && this.startedAt >= 0
        ? this.context.currentTime - this.startedAt + this.offset
        : 0;
    const hadWrapped = this.hasActiveLoop() && unwrapped >= this.loop.end;

    this.loop = loop;
    this.audioTracks.forEach((track) => track.setLoop(loop));

    if (
      hadWrapped &&
      resumeAt !== undefined &&
      (!loop || (resumeAt >= loop.start && resumeAt < loop.end))
    ) {
      void this.start(resumeAt);
    }
  }

  async start(offset: number = 0, startAt?: number) {
    if (this.isInitialised) {
      this.stop();
    }

    this.offset = offset;

    if (this.context.state === 'suspended') {
      await this.context.resume().catch(() => {});
    }

    const time = Math.max(
      startAt ?? this.context.currentTime,
      this.context.currentTime,
    );

    this.startedAt = time;
    this.audioTracks.forEach((track) => track.start(time, offset));
    this.isInitialised = true;
  }

  stop() {
    this.audioTracks.forEach((track) => track.stop());
    this.isInitialised = false;
    this.startedAt = -1;
  }

  get currentTime() {
    if (this.startedAt < 0) {
      return 0;
    }

    const latency = this.context.state === 'running' ? this.outputLatency : 0;
    const unwrapped = Math.max(
      this.offset,
      this.context.currentTime - this.startedAt + this.offset - latency,
    );

    return this.wrapLoopTime(unwrapped);
  }

  destroy() {
    super.destroy();
    this.onEnded = null;
  }

  trackEndedListener = () => {
    if (this.audioTracks.filter((track) => !track.ended).length !== 0) {
      return;
    }

    this.stop();
    this.onEnded?.();
  };
}
