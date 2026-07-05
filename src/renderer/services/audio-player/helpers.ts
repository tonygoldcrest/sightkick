const SILENCE_THRESHOLD = 0.005;
const WINDOW_SECONDS = 0.02;
const TAIL_PADDING_SECONDS = 0.1;

function findLastAudibleSample(buffer: AudioBuffer, threshold: number): number {
  const windowSize = Math.max(
    1,
    Math.floor(WINDOW_SECONDS * buffer.sampleRate),
  );
  const thresholdSquared = threshold * threshold;
  const channels: Float32Array[] = [];

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }

  for (let end = buffer.length; end > 0; end -= windowSize) {
    const start = Math.max(0, end - windowSize);
    let sumSquares = 0;

    for (let i = start; i < end; i += 1) {
      for (let channel = 0; channel < channels.length; channel += 1) {
        const sample = channels[channel][i];

        sumSquares += sample * sample;
      }
    }

    const meanSquare = sumSquares / ((end - start) * channels.length);

    if (meanSquare > thresholdSquared) {
      return end - 1;
    }
  }

  return 0;
}

export function trimTrailingSilence(
  buffer: AudioBuffer,
  context: BaseAudioContext,
  threshold: number = SILENCE_THRESHOLD,
  minDurationSeconds: number = 0,
): AudioBuffer {
  const lastSample = findLastAudibleSample(buffer, threshold);
  const padding = Math.floor(TAIL_PADDING_SECONDS * buffer.sampleRate);
  const minLength = Math.ceil(minDurationSeconds * buffer.sampleRate);
  const newLength = Math.min(
    buffer.length,
    Math.max(lastSample + 1 + padding, minLength),
  );

  if (newLength >= buffer.length) {
    return buffer;
  }

  const trimmed = context.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    trimmed.copyToChannel(
      buffer.getChannelData(channel).subarray(0, newLength),
      channel,
    );
  }

  return trimmed;
}
