import { DefaultAudioPlayer } from './default/player';
import { SpeedAudioPlayer } from './speed/player';
import { AudioPlayerFactory } from './types';

export type PlayerMode = 'default' | 'speed';

export const createDefaultPlayer: AudioPlayerFactory = (
  trackConfigs,
  onEnded,
  getMinDurationSeconds,
) => new DefaultAudioPlayer(trackConfigs, onEnded, getMinDurationSeconds);

export const createSpeedPlayer: AudioPlayerFactory = (
  trackConfigs,
  onEnded,
  getMinDurationSeconds,
) => new SpeedAudioPlayer(trackConfigs, onEnded, getMinDurationSeconds);

export function playerFactoryForMode(mode: PlayerMode): AudioPlayerFactory {
  return mode === 'speed' ? createSpeedPlayer : createDefaultPlayer;
}
