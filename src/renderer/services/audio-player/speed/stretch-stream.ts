import { ChannelStretcher } from './channel-stretcher';

export class StretchStream {
  private worker: Worker | undefined;
  private fallback: ChannelStretcher[] = [];
  private channels: Float32Array[] = [];
  private pending = new Map<number, (blocks: Float32Array[]) => void>();
  private nextId = 0;

  constructor() {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      this.worker = new Worker(
        new URL('./stretch-worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (
        event: MessageEvent<{ id: number; blocks: Float32Array[] }>,
      ) => {
        const resolve = this.pending.get(event.data.id);

        if (resolve) {
          this.pending.delete(event.data.id);
          resolve(event.data.blocks);
        }
      };
    } catch {
      this.worker = undefined;
    }
  }

  init(channels: Float32Array[], speed: number) {
    this.channels = channels;

    if (this.worker) {
      this.worker.postMessage({ type: 'init', channels, speed });

      return;
    }

    this.fallback = channels.map(
      (channel) => new ChannelStretcher(channel, speed),
    );
  }

  setSpeed(speed: number) {
    if (this.worker) {
      this.worker.postMessage({ type: 'setSpeed', speed });

      return;
    }

    this.fallback = this.channels.map(
      (channel) => new ChannelStretcher(channel, speed),
    );
  }

  seek(outputSample: number) {
    if (this.worker) {
      this.worker.postMessage({ type: 'seek', outputSample });

      return;
    }

    this.fallback.forEach((stretcher) => stretcher.seek(outputSample));
  }

  produce(frames: number): Promise<Float32Array[]> {
    if (this.worker) {
      const id = this.nextId;

      this.nextId += 1;

      return new Promise<Float32Array[]>((resolve) => {
        this.pending.set(id, resolve);
        this.worker?.postMessage({ type: 'produce', id, frames });
      });
    }

    return Promise.resolve(
      this.fallback.map((stretcher) => stretcher.produce(frames)),
    );
  }

  destroy() {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
    this.fallback = [];
    this.channels = [];
  }
}
