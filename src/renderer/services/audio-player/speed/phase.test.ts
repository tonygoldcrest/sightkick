import { describe, expect, it } from 'vitest';
import { lockPhases, principalArgument } from './phase';

describe('principalArgument', () => {
  it('leaves values within range unchanged', () => {
    expect(principalArgument(0)).toBeCloseTo(0, 6);
    expect(principalArgument(1)).toBeCloseTo(1, 6);
    expect(principalArgument(-1)).toBeCloseTo(-1, 6);
  });

  it('wraps values outside [-pi, pi]', () => {
    expect(principalArgument(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 5);
    expect(principalArgument(-2 * Math.PI - 0.1)).toBeCloseTo(-0.1, 5);

    for (let angle = -20; angle <= 20; angle += 0.3) {
      const wrapped = principalArgument(angle);

      expect(wrapped).toBeGreaterThanOrEqual(-Math.PI - 1e-6);
      expect(wrapped).toBeLessThanOrEqual(Math.PI + 1e-6);
    }
  });
});

describe('lockPhases', () => {
  it('keeps the peak phase and locks neighbours relative to it', () => {
    const bins = 10;
    const magnitude = new Float32Array(bins);

    magnitude[5] = 1;

    const analysisPhase = Float32Array.from(
      { length: bins },
      (_, k) => k * 0.1,
    );
    const synthesisPhase = Float32Array.from(
      { length: bins },
      (_, k) => k * 0.2,
    );
    const lockedPhase = new Float32Array(bins);
    const peaks = new Int32Array(bins);

    lockPhases(
      magnitude,
      analysisPhase,
      synthesisPhase,
      lockedPhase,
      peaks,
      bins,
    );

    expect(lockedPhase[5]).toBeCloseTo(synthesisPhase[5], 6);
    expect(lockedPhase[3]).toBeCloseTo(
      synthesisPhase[5] + (analysisPhase[3] - analysisPhase[5]),
      6,
    );
  });

  it('falls back to synthesis phase when there are no peaks', () => {
    const bins = 8;
    const magnitude = new Float32Array(bins).fill(1);
    const analysisPhase = new Float32Array(bins).fill(0.3);
    const synthesisPhase = Float32Array.from(
      { length: bins },
      (_, k) => k * 0.5,
    );
    const lockedPhase = new Float32Array(bins);
    const peaks = new Int32Array(bins);

    lockPhases(
      magnitude,
      analysisPhase,
      synthesisPhase,
      lockedPhase,
      peaks,
      bins,
    );

    for (let k = 0; k < bins; k += 1) {
      expect(lockedPhase[k]).toBeCloseTo(synthesisPhase[k], 6);
    }
  });
});
