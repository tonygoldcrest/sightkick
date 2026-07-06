const TWO_PI = 2 * Math.PI;

export function makeHann(size: number): Float32Array {
  const window = new Float32Array(size);

  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((TWO_PI * i) / (size - 1)));
  }

  return window;
}
