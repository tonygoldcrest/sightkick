import { ClickBuffers, ClickSpec } from './types';
import {
  ATTACK_DECAY_SECONDS,
  BEAT_CLICK,
  DECAY_CURVE,
  DECAY_MAX_SECONDS,
  DECAY_MIN_SECONDS,
  DEFAULT_SAMPLE_RATE,
  DOWNBEAT_CLICK,
  MASTER_GAIN,
  MAX_DURATION_SECONDS,
} from './constants';

function decaySeconds(tone: number): number {
  const shaped = tone ** DECAY_CURVE;

  return DECAY_MIN_SECONDS * (DECAY_MAX_SECONDS / DECAY_MIN_SECONDS) ** shaped;
}

function renderClick(
  ctx: AudioContext,
  spec: ClickSpec,
  tone: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate || DEFAULT_SAMPLE_RATE;
  const tau = decaySeconds(tone);
  const duration = Math.min(MAX_DURATION_SECONDS, 0.015 + tau * 7);
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const modeAmplitudes = spec.modes.map(
    (mode) => mode.amplitude * (1 - (mode.toneWeight ?? 0) * (1 - tone)),
  );
  const amplitudeSum = modeAmplitudes.reduce((sum, amp) => sum + amp, 0);
  const normalize = 1 / amplitudeSum;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t / tau);
    let body = 0;

    for (let m = 0; m < spec.modes.length; m += 1) {
      body +=
        modeAmplitudes[m] * Math.cos(2 * Math.PI * spec.modes[m].frequency * t);
    }

    const ring = body * normalize * envelope;
    const attack = spec.attackGain * Math.exp(-t / ATTACK_DECAY_SECONDS);
    const sample = (ring + attack) * spec.gain * MASTER_GAIN;

    data[i] = Math.tanh(sample);
  }

  return buffer;
}

export function renderClickBuffers(
  ctx: AudioContext,
  tone: number,
): ClickBuffers {
  const clamped = Math.max(0, Math.min(1, tone));

  return {
    downbeat: renderClick(ctx, DOWNBEAT_CLICK, clamped),
    beat: renderClick(ctx, BEAT_CLICK, clamped),
  };
}
