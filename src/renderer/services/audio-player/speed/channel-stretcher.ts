import { FFT } from './fft';
import { makeHann } from './window';
import { lockPhases, principalArgument } from './phase';
import { SampleBlock } from '../types';

const FFT_SIZE = 2048;
const SYNTHESIS_HOP = FFT_SIZE / 4;
const PHASE_LOCKING = true;
const TWO_PI = 2 * Math.PI;

export class ChannelStretcher {
  private readonly size = FFT_SIZE;
  private readonly half = FFT_SIZE / 2;
  private readonly bins = FFT_SIZE / 2 + 1;
  private readonly synthesisHop = SYNTHESIS_HOP;
  private readonly analysisHop: number;
  private readonly window = makeHann(FFT_SIZE);
  private readonly fft = new FFT(FFT_SIZE);
  private readonly omega = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly re = new Float32Array(FFT_SIZE);
  private readonly im = new Float32Array(FFT_SIZE);
  private readonly magnitude = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly analysisPhase = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly previousPhase = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly synthesisPhase = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly lockedPhase = new Float32Array(FFT_SIZE / 2 + 1);
  private readonly peaks = new Int32Array(FFT_SIZE / 2 + 1);
  private readonly accumulator = new Float32Array(FFT_SIZE);
  private readonly accumulatorNorm = new Float32Array(FFT_SIZE);
  private frameIndex = 0;
  private firstFrame = true;
  private onsetIndex = 0;

  constructor(
    private readonly input: Float32Array,
    speed: number,
    private readonly onsets: number[] = [],
  ) {
    this.analysisHop = this.synthesisHop * speed;

    for (let k = 0; k < this.bins; k += 1) {
      this.omega[k] = (TWO_PI * k) / this.size;
    }
  }

  seek(outputSample: number) {
    this.frameIndex = Math.max(0, Math.round(outputSample / this.synthesisHop));
    this.firstFrame = true;
    this.accumulator.fill(0);
    this.accumulatorNorm.fill(0);
    this.previousPhase.fill(0);
    this.synthesisPhase.fill(0);

    const sourcePosition = this.frameIndex * this.analysisHop;

    this.onsetIndex = 0;

    while (
      this.onsetIndex < this.onsets.length &&
      this.onsets[this.onsetIndex] < sourcePosition
    ) {
      this.onsetIndex += 1;
    }
  }

  produce(frames: number): SampleBlock {
    const hop = this.synthesisHop;
    const output = new Float32Array(frames * hop);

    for (let frame = 0; frame < frames; frame += 1) {
      this.processFrame();

      for (let i = 0; i < hop; i += 1) {
        const norm = this.accumulatorNorm[i];

        output[frame * hop + i] =
          norm > 1e-8 ? this.accumulator[i] / norm : this.accumulator[i];
      }

      this.accumulator.copyWithin(0, hop);
      this.accumulator.fill(0, this.size - hop);
      this.accumulatorNorm.copyWithin(0, hop);
      this.accumulatorNorm.fill(0, this.size - hop);
    }

    return output;
  }

  private processFrame() {
    const { size, half, bins } = this;
    const start = Math.round(this.frameIndex * this.analysisHop);
    const windowCenter = start + half;
    let onsetFrame = false;

    while (
      this.onsetIndex < this.onsets.length &&
      this.onsets[this.onsetIndex] <= windowCenter
    ) {
      onsetFrame = true;
      this.onsetIndex += 1;
    }

    this.frameIndex += 1;

    for (let i = 0; i < size; i += 1) {
      const index = start + i;

      this.re[i] =
        (index >= 0 && index < this.input.length ? this.input[index] : 0) *
        this.window[i];
      this.im[i] = 0;
    }

    this.fft.transform(this.re, this.im);

    for (let k = 0; k < bins; k += 1) {
      const real = this.re[k];
      const imag = this.im[k];

      this.magnitude[k] = Math.sqrt(real * real + imag * imag);
      this.analysisPhase[k] = Math.atan2(imag, real);
    }

    if (this.firstFrame || onsetFrame) {
      this.synthesisPhase.set(this.analysisPhase);
      this.firstFrame = false;
    } else {
      for (let k = 0; k < bins; k += 1) {
        const expected = this.omega[k] * this.analysisHop;
        const deviation = principalArgument(
          this.analysisPhase[k] - this.previousPhase[k] - expected,
        );
        const trueFrequency = this.omega[k] + deviation / this.analysisHop;

        this.synthesisPhase[k] += trueFrequency * this.synthesisHop;
      }
    }

    this.previousPhase.set(this.analysisPhase);

    if (PHASE_LOCKING) {
      lockPhases(
        this.magnitude,
        this.analysisPhase,
        this.synthesisPhase,
        this.lockedPhase,
        this.peaks,
        bins,
      );
    } else {
      this.lockedPhase.set(this.synthesisPhase);
    }

    for (let k = 0; k < bins; k += 1) {
      this.re[k] = this.magnitude[k] * Math.cos(this.lockedPhase[k]);
      this.im[k] = this.magnitude[k] * Math.sin(this.lockedPhase[k]);
    }

    this.im[0] = 0;
    this.im[half] = 0;

    for (let k = 1; k < half; k += 1) {
      this.re[size - k] = this.re[k];
      this.im[size - k] = -this.im[k];
    }

    this.fft.inverse(this.re, this.im);

    for (let i = 0; i < size; i += 1) {
      const weight = this.window[i];

      this.accumulator[i] += this.re[i] * weight;
      this.accumulatorNorm[i] += weight * weight;
    }
  }
}
