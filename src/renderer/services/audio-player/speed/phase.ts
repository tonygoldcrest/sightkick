const TWO_PI = 2 * Math.PI;

export function principalArgument(angle: number): number {
  return angle - TWO_PI * Math.round(angle / TWO_PI);
}

export function lockPhases(
  magnitude: Float32Array,
  analysisPhase: Float32Array,
  synthesisPhase: Float32Array,
  lockedPhase: Float32Array,
  peaks: Int32Array,
  bins: number,
): void {
  let peakCount = 0;

  for (let k = 2; k < bins - 2; k += 1) {
    const value = magnitude[k];

    if (
      value > magnitude[k - 1] &&
      value > magnitude[k + 1] &&
      value > magnitude[k - 2] &&
      value > magnitude[k + 2]
    ) {
      peaks[peakCount] = k;
      peakCount += 1;
    }
  }

  if (peakCount === 0) {
    lockedPhase.set(synthesisPhase.subarray(0, bins));

    return;
  }

  for (let p = 0; p < peakCount; p += 1) {
    const peak = peaks[p];
    const low = p === 0 ? 0 : ((peaks[p - 1] + peak) >> 1) + 1;
    const high = p === peakCount - 1 ? bins - 1 : (peak + peaks[p + 1]) >> 1;
    const peakSynthesis = synthesisPhase[peak];
    const peakAnalysis = analysisPhase[peak];

    for (let k = low; k <= high; k += 1) {
      lockedPhase[k] = peakSynthesis + (analysisPhase[k] - peakAnalysis);
    }

    lockedPhase[peak] = peakSynthesis;
  }
}
