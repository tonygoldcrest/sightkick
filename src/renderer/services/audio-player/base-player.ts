import { BaseAudioTrack } from './base-track';
import { TrackConfig } from './types';
import { trimTrailingSilence } from './helpers';

export abstract class BaseAudioPlayer<TTrack extends BaseAudioTrack> {
  context: AudioContext;
  masterGain: GainNode;
  audioTracks: TTrack[] = [];
  ready: Promise<TTrack[]>;
  duration: number = 0;
  isInitialised: boolean = false;
  protected startedAt: number = -1;
  protected offset: number = 0;
  protected getMinDurationSeconds: () => number;

  constructor(
    trackConfigs: TrackConfig[],
    getMinDurationSeconds: () => number = () => 0,
  ) {
    this.context = new AudioContext({ latencyHint: 'playback' });
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.getMinDurationSeconds = getMinDurationSeconds;
    this.ready = this.createTracks(trackConfigs);
    this.ready
      .then((tracks) => {
        this.duration = Math.max(0, ...tracks.map((track) => track.duration));

        return this.duration;
      })
      .catch(() => {});
  }

  protected abstract createTrack(buffers: AudioBuffer[], name: string): TTrack;

  private async createTracks(trackConfigs: TrackConfig[]): Promise<TTrack[]> {
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
        const track = this.createTrack(audioBuffers, name);

        this.audioTracks.push(track);

        return track;
      }),
    );
  }

  pause(): void {
    this.context.suspend();
  }

  get outputLatency(): number {
    return this.context.outputLatency || this.context.baseLatency || 0;
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
  }

  contextTimeForSongTime(songTime: number): number {
    if (this.startedAt < 0) {
      return this.context.currentTime;
    }

    return this.startedAt + (songTime - this.offset);
  }

  abstract get currentTime(): number;

  abstract start(offset?: number, startAt?: number): Promise<void> | void;

  abstract stop(): void;

  destroy(): void {
    this.audioTracks.forEach((track) => track.destroy());
    this.audioTracks = [];
    this.masterGain.disconnect();
    this.context.close();
  }
}
