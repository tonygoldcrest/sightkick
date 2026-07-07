import { GameMode, PlayheadStyle } from './types';

export interface ModePolicy {
  player: 'default' | 'speed';
  scoring: boolean;
  allowScrubbing: boolean;
  looping: boolean;
  speedControl: boolean;
  playheadOverride?: PlayheadStyle;
  parkAtStartOnEnd: boolean;
}

export const MODE_POLICIES: Record<GameMode, ModePolicy> = {
  perform: {
    player: 'default',
    scoring: true,
    allowScrubbing: false,
    looping: false,
    speedControl: false,
    parkAtStartOnEnd: false,
  },
  practice: {
    player: 'speed',
    scoring: false,
    allowScrubbing: true,
    looping: true,
    speedControl: true,
    playheadOverride: 'Cursor',
    parkAtStartOnEnd: true,
  },
};

export function resolveModePolicy(gameMode: GameMode | undefined): ModePolicy {
  return MODE_POLICIES[gameMode ?? 'perform'];
}
