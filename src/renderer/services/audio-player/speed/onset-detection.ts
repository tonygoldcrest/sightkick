const FRAME_SIZE = 1024;
const HOP = 512;
const MIN_IOI_SECONDS = 0.04;
const THRESHOLD_MULTIPLIER = 1.6;
const THRESHOLD_WINDOW = 8;

export function detectOnsets(mono: Float32Array, sampleRate: number): number[] {
  const frameCount = Math.floor((mono.length - FRAME_SIZE) / HOP) + 1;

  if (frameCount <= 2) {
    return [];
  }

  const flux = new Float32Array(frameCount);
  let previousEnergy = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * HOP;
    let energy = 0;

    for (let i = 0; i < FRAME_SIZE; i += 1) {
      const sample = mono[start + i];

      energy += sample * sample;
    }

    flux[frame] = energy > previousEnergy ? energy - previousEnergy : 0;
    previousEnergy = energy;
  }

  const minIoiFrames = Math.max(
    1,
    Math.round((MIN_IOI_SECONDS * sampleRate) / HOP),
  );
  const onsets: number[] = [];
  let lastOnsetFrame = -minIoiFrames;

  for (let frame = 1; frame < frameCount - 1; frame += 1) {
    const value = flux[frame];

    if (value <= 0 || value < flux[frame - 1] || value < flux[frame + 1]) {
      continue;
    }

    let sum = 0;
    let count = 0;

    for (
      let j = frame - THRESHOLD_WINDOW;
      j <= frame + THRESHOLD_WINDOW;
      j += 1
    ) {
      if (j >= 0 && j < frameCount) {
        sum += flux[j];
        count += 1;
      }
    }

    const mean = count > 0 ? sum / count : 0;

    if (value < mean * THRESHOLD_MULTIPLIER) {
      continue;
    }

    if (frame - lastOnsetFrame < minIoiFrames) {
      continue;
    }

    onsets.push(frame * HOP);
    lastOnsetFrame = frame;
  }

  return onsets;
}
