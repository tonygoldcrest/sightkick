import { describe, expect, it } from 'vitest';
import { FFT } from './fft';

describe('FFT', () => {
  it('transforms a DC signal into bin zero only', () => {
    const n = 8;
    const re = new Float32Array(n).fill(1);
    const im = new Float32Array(n);

    new FFT(n).transform(re, im);

    expect(re[0]).toBeCloseTo(n, 4);
    expect(im[0]).toBeCloseTo(0, 4);

    for (let k = 1; k < n; k += 1) {
      expect(Math.hypot(re[k], im[k])).toBeCloseTo(0, 4);
    }
  });

  it('puts a cosine into its frequency bin', () => {
    const n = 8;
    const re = new Float32Array(n);
    const im = new Float32Array(n);

    for (let i = 0; i < n; i += 1) {
      re[i] = Math.cos((2 * Math.PI * i) / n);
    }

    new FFT(n).transform(re, im);

    expect(Math.hypot(re[1], im[1])).toBeCloseTo(n / 2, 4);
    expect(Math.hypot(re[n - 1], im[n - 1])).toBeCloseTo(n / 2, 4);
    expect(Math.hypot(re[2], im[2])).toBeCloseTo(0, 4);
  });

  it('reconstructs the original signal through inverse', () => {
    const n = 16;
    const original = Float32Array.from(
      { length: n },
      (_, i) => Math.sin(i) + 0.5 * Math.cos(2 * i),
    );
    const re = Float32Array.from(original);
    const im = new Float32Array(n);
    const fft = new FFT(n);

    fft.transform(re, im);
    fft.inverse(re, im);

    for (let i = 0; i < n; i += 1) {
      expect(re[i]).toBeCloseTo(original[i], 4);
      expect(im[i]).toBeCloseTo(0, 4);
    }
  });
});
