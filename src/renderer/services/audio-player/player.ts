import { AudioTrack } from './track';
import { TrackConfig } from './types';
import { trimTrailingSilence } from './helpers';

export class AudioPlayer {
  context: AudioContext;
  masterGain: GainNode;
  audioTracks: AudioTrack[] = [];
  ready: Promise<AudioTrack[]>;
  isInitialised: boolean = false;
  onEnded: (() => void) | null;
  private startedAt: number = -1;
  private offset: number = 0;
  private getMinDurationSeconds: () => number;
  duration: number = 0;

  constructor(
    trackConfigs: TrackConfig[],
    onEnded: () => void,
    getMinDurationSeconds: () => number = () => 0,
  ) {
    this.context = new AudioContext({ latencyHint: 'playback' });
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.getMinDurationSeconds = getMinDurationSeconds;
    this.ready = this.createTracks(trackConfigs);
    this.onEnded = onEnded;
    this.ready
      .then((tracks) => {
        this.duration = Math.max(...tracks.map((track) => track.duration));

        return this.duration;
      })
      .catch(() => {});
  }

  async createTracks(trackConfigs: TrackConfig[]) {
    return Promise.all(
      trackConfigs.map(async ({ name, urls }) => {
        const dataBuffers = await Promise.all(
          urls.map((url) => fetch(url).then((res) => res.arrayBuffer())),
        );
        const decodedBuffers = await Promise.all(
          dataBuffers.map((buf) => this.context.decodeAudioData(buf)),
        );
        const minDurationSeconds = this.getMinDurationSeconds();
        const audioBuffers = decodedBuffers.map((buffer) =>
          trimTrailingSilence(
            buffer,
            this.context,
            undefined,
            minDurationSeconds,
          ),
        );
        const audioTrack = new AudioTrack(
          audioBuffers,
          name,
          this.context,
          this.masterGain,
        );

        audioTrack.endedListener = this.trackEndedListener;
        this.audioTracks.push(audioTrack);

        return audioTrack;
      }),
    );
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

  contextTimeForSongTime(songTime: number): number {
    if (this.startedAt < 0) {
      return this.context.currentTime;
    }

    return this.startedAt + (songTime - this.offset);
  }

  stop() {
    this.audioTracks.forEach((track) => track.stop());
    this.isInitialised = false;
    this.startedAt = -1;
  }

  pause() {
    this.context.suspend();
  }

  get outputLatency() {
    return this.context.outputLatency || this.context.baseLatency || 0;
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

  setMasterVolume(volume: number) {
    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
  }

  destroy() {
    this.audioTracks.forEach((track) => track.destroy());
    this.audioTracks = [];
    this.masterGain.disconnect();
    this.onEnded = null;
    this.context.close();
  }

  trackEndedListener = () => {
    if (this.audioTracks.filter((track) => !track.ended).length !== 0) {
      return;
    }

    this.stop();
    this.onEnded?.();
  };
}
