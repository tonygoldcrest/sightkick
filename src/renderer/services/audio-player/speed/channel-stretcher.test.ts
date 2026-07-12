import { describe, expect, it } from 'vitest';
import { ChannelStretcher } from './channel-stretcher';

const HOP = 512;
const SIZE = 2048;

function sine(length: number, bin: number): Float32Array {
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * bin * i) / SIZE);
  }

  return samples;
}

describe('ChannelStretcher', () => {
  it('produces frames * hop samples', () => {
    const stretcher = new ChannelStretcher(sine(8192, 64), 1);

    expect(stretcher.produce(4)).toHaveLength(4 * HOP);
  });

  it('reconstructs a bin-aligned sine at speed 1', () => {
    const input = sine(8192, 64);
    const output = new ChannelStretcher(input, 1).produce(12);

    for (let i = 2560; i < 4096; i += 1) {
      expect(Math.abs(output[i] - input[i])).toBeLessThan(0.02);
    }
  });

  it('is deterministic for identical inputs', () => {
    const input = sine(8192, 40);
    const a = new ChannelStretcher(input, 0.5).produce(8);
    const b = new ChannelStretcher(input, 0.5).produce(8);

    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('seek resets state so output repeats', () => {
    const input = sine(8192, 40);
    const stretcher = new ChannelStretcher(input, 0.5);
    const first = Array.from(stretcher.produce(6));

    stretcher.seek(0);

    expect(Array.from(stretcher.produce(6))).toEqual(first);
  });

  it('phase-resets at an onset, changing the output', () => {
    const input = sine(8192, 43);
    const plain = Array.from(new ChannelStretcher(input, 0.5).produce(8));
    const withOnset = Array.from(
      new ChannelStretcher(input, 0.5, [2000]).produce(8),
    );

    expect(withOnset).not.toEqual(plain);
  });

  it('is deterministic with onsets', () => {
    const input = sine(8192, 40);
    const a = Array.from(new ChannelStretcher(input, 0.5, [2000]).produce(8));
    const b = Array.from(new ChannelStretcher(input, 0.5, [2000]).produce(8));

    expect(a).toEqual(b);
  });

  it('seek re-aligns onset tracking so output repeats', () => {
    const input = sine(8192, 40);
    const stretcher = new ChannelStretcher(input, 0.5, [2000]);
    const first = Array.from(stretcher.produce(8));

    stretcher.seek(0);

    expect(Array.from(stretcher.produce(8))).toEqual(first);
  });
});
