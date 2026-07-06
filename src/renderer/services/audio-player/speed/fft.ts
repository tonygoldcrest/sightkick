const TWO_PI = 2 * Math.PI;

export class FFT {
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly reversal: Uint32Array;

  constructor(private readonly size: number) {
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);

    for (let i = 0; i < size / 2; i += 1) {
      this.cos[i] = Math.cos((-TWO_PI * i) / size);
      this.sin[i] = Math.sin((-TWO_PI * i) / size);
    }

    const bits = Math.round(Math.log2(size));

    this.reversal = new Uint32Array(size);

    for (let i = 0; i < size; i += 1) {
      let value = i;
      let reversed = 0;

      for (let bit = 0; bit < bits; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }

      this.reversal[i] = reversed;
    }
  }

  transform(re: Float32Array, im: Float32Array) {
    const { size } = this;

    for (let i = 0; i < size; i += 1) {
      const j = this.reversal[i];

      if (j > i) {
        let temp = re[i];

        re[i] = re[j];
        re[j] = temp;
        temp = im[i];
        im[i] = im[j];
        im[j] = temp;
      }
    }

    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1;
      const step = size / span;

      for (let start = 0; start < size; start += span) {
        for (let i = start, k = 0; i < start + half; i += 1, k += step) {
          const tre = this.cos[k] * re[i + half] - this.sin[k] * im[i + half];
          const tim = this.cos[k] * im[i + half] + this.sin[k] * re[i + half];

          re[i + half] = re[i] - tre;
          im[i + half] = im[i] - tim;
          re[i] += tre;
          im[i] += tim;
        }
      }
    }
  }

  inverse(re: Float32Array, im: Float32Array) {
    const { size } = this;

    for (let i = 0; i < size; i += 1) {
      im[i] = -im[i];
    }

    this.transform(re, im);

    const scale = 1 / size;

    for (let i = 0; i < size; i += 1) {
      re[i] *= scale;
      im[i] = -im[i] * scale;
    }
  }
}
