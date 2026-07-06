import { DefaultAudioTrack } from './track';
import { BaseAudioPlayer } from '../base-player';
import { AudioPlayer, TrackConfig } from '../types';

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

    track.endedListener = this.trackEndedListener;

    return track;
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

    return Math.max(
      this.offset,
      this.context.currentTime - this.startedAt + this.offset - latency,
    );
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
