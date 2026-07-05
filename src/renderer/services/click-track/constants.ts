import { ClickSpec } from './types';

export const DEFAULT_SAMPLE_RATE = 44100;

export const DEFAULT_CLICK_TONE = 0.5;

export const DECAY_MIN_SECONDS = 0.0004;

export const DECAY_MAX_SECONDS = 0.05;

export const DECAY_CURVE = 1.7;

export const ATTACK_DECAY_SECONDS = 0.0006;

export const MAX_DURATION_SECONDS = 0.35;

export const MASTER_GAIN = 2;

export const DOWNBEAT_CLICK: ClickSpec = {
  modes: [
    { frequency: 698, amplitude: 1 },
    { frequency: 1046, amplitude: 0.6, toneWeight: 0.9 },
  ],
  attackGain: 0.7,
  gain: 1,
};

export const BEAT_CLICK: ClickSpec = {
  modes: [
    { frequency: 1046, amplitude: 1 },
    { frequency: 2092, amplitude: 0.18, toneWeight: 0.9 },
  ],
  attackGain: 0.5,
  gain: 0.6,
};
