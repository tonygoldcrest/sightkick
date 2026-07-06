export type {
  AudioPlayer,
  AudioPlayerFactory,
  AudioTrackHandle,
  SpeedControllableAudioPlayer,
  TrackConfig,
} from './types';

export { isSpeedControllable } from './types';

export { DefaultAudioPlayer } from './default/player';

export { SpeedAudioPlayer } from './speed/player';

export {
  createDefaultPlayer,
  createSpeedPlayer,
  playerFactoryForMode,
} from './factories';
