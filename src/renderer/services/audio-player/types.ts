export interface TrackConfig {
  name: string;
  urls: string[];
}

export interface AudioTrackHandle {
  name: string;
  setVolume(gain: number): void;
}

export interface AudioPlayer {
  ready: Promise<unknown>;
  context: AudioContext;
  audioTracks: AudioTrackHandle[];
  duration: number;
  isInitialised: boolean;
  currentTime: number;
  start(offset?: number, startAt?: number): Promise<void> | void;
  stop(): void;
  pause(): void;
  setMasterVolume(volume: number): void;
  contextTimeForSongTime(songTime: number): number;
  destroy(): void;
}

export interface SpeedControllableAudioPlayer extends AudioPlayer {
  playbackSpeed: number;
  setPlaybackSpeed(speed: number): void;
}

export function isSpeedControllable(
  player: AudioPlayer,
): player is SpeedControllableAudioPlayer {
  return 'setPlaybackSpeed' in player;
}

export type AudioPlayerFactory = (
  trackConfigs: TrackConfig[],
  onEnded: () => void,
  getMinDurationSeconds: () => number,
) => AudioPlayer;
