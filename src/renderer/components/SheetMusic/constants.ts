import { noteTypes } from 'scan-chart';
import { Lane } from './types';

export const TYPE_BY_LANE: Record<Lane, number> = {
  kick: noteTypes.kick,
  snare: noteTypes.redDrum,
  yellow: noteTypes.yellowDrum,
  blue: noteTypes.blueDrum,
  green: noteTypes.greenDrum,
};

export const LANE_BY_TYPE: Record<number, Lane> = {
  [noteTypes.kick]: 'kick',
  [noteTypes.redDrum]: 'snare',
  [noteTypes.yellowDrum]: 'yellow',
  [noteTypes.blueDrum]: 'blue',
  [noteTypes.greenDrum]: 'green',
};

export const CYMBAL_LANES = new Set<Lane>(['yellow', 'blue', 'green']);
