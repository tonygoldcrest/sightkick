import { vi } from 'vitest';

export class FakeAudioBuffer {
  private channels: Float32Array[];

  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  get duration() {
    return this.length / this.sampleRate;
  }

  getChannelData(channel: number) {
    return this.channels[channel];
  }

  copyToChannel(source: Float32Array, channel: number) {
    this.channels[channel].set(source.subarray(0, this.length));
  }
}

export function makeBuffer(
  channelData: number[][],
  sampleRate = 1000,
): FakeAudioBuffer {
  const length = channelData[0]?.length ?? 0;
  const buffer = new FakeAudioBuffer(channelData.length, length, sampleRate);

  channelData.forEach((data, channel) => {
    buffer.getChannelData(channel).set(data);
  });

  return buffer;
}

export class FakeAudioParam {
  value = 1;

  calls: { value: number; time: number }[] = [];

  ramps: { value: number; time: number }[] = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.calls.push({ value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.ramps.push({ value, time });
  }

  cancelScheduledValues(_time: number) {}
}

export class FakeGainNode {
  gain = new FakeAudioParam();

  connectedTo: unknown[] = [];

  disconnected = false;

  connect(destination: unknown) {
    this.connectedTo.push(destination);
  }

  disconnect() {
    this.disconnected = true;
  }
}

export class FakeBufferSource {
  buffer: unknown = undefined;

  starts: { at: number; offset: number }[] = [];

  stopped = false;

  connectedTo: unknown = undefined;

  disconnected = false;

  private listeners = new Map<string, Set<(event: Event) => void>>();

  start(at: number, offset: number) {
    this.starts.push({ at, offset });
  }

  stop() {
    this.stopped = true;
  }

  connect(node: unknown) {
    this.connectedTo = node;
  }

  disconnect() {
    this.disconnected = true;
  }

  addEventListener(type: string, fn: (event: Event) => void) {
    const set = this.listeners.get(type) ?? new Set();

    set.add(fn);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, fn: (event: Event) => void) {
    this.listeners.get(type)?.delete(fn);
  }

  emitEnded() {
    const event = { currentTarget: this } as unknown as Event;

    [...(this.listeners.get('ended') ?? [])].forEach((fn) => fn(event));
  }
}

export class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  sampleRate = 44100;
  currentTime = 0;
  baseLatency = 0;
  outputLatency = 0;
  destination = { id: 'destination' };
  gainNodes: FakeGainNode[] = [];
  bufferSources: FakeBufferSource[] = [];

  resume = vi.fn(() => {
    this.state = 'running';

    return Promise.resolve();
  });

  suspend = vi.fn(() => {
    this.state = 'suspended';

    return Promise.resolve();
  });

  close = vi.fn(() => {
    this.state = 'closed';

    return Promise.resolve();
  });

  createGain() {
    const node = new FakeGainNode();

    this.gainNodes.push(node);

    return node;
  }

  createBufferSource() {
    const source = new FakeBufferSource();

    this.bufferSources.push(source);

    return source;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  decodeAudioData(data: ArrayBuffer) {
    return Promise.resolve(new FakeAudioBuffer(1, data.byteLength, 1));
  }
}

export function installWebAudio() {
  const context = new FakeAudioContext();
  const Ctor = function AudioContextStub(this: unknown) {
    return context;
  } as unknown as typeof AudioContext;

  vi.stubGlobal('AudioContext', Ctor);

  return context;
}

export function installFetchByByteLength(
  lengthForUrl: (url: string) => number,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(lengthForUrl(url))),
      }),
    ),
  );
}
