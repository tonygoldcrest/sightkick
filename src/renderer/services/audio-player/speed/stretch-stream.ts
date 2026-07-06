import {
  buildUnits,
  scatterBlocks,
  StretchUnit,
  VoiceGroup,
} from './build-units';

export class StretchStream {
  private worker: Worker | undefined;
  private units: StretchUnit[] = [];
  private channels: Float32Array[] = [];
  private groups: VoiceGroup[] = [];
  private sampleRate = 44100;
  private onsetsByGroup: (number[] | undefined)[] = [];
  private pending = new Map<number, (blocks: Float32Array[]) => void>();
  private nextId = 0;

  constructor() {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      this.worker = new Worker(
        new URL('./stretch-worker.ts', import.meta.url),
        {
          type: 'module',
        },
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

  init(
    channels: Float32Array[],
    speed: number,
    groups: VoiceGroup[],
    sampleRate: number,
  ) {
    this.channels = channels;
    this.groups = groups;
    this.sampleRate = sampleRate;
    this.onsetsByGroup = new Array(groups.length).fill(undefined);

    if (this.worker) {
      this.worker.postMessage({
        type: 'init',
        channels,
        speed,
        groups,
        sampleRate,
      });

      return;
    }

    this.units = buildUnits(
      channels,
      groups,
      speed,
      sampleRate,
      this.onsetsByGroup,
    );
  }

  setSpeed(speed: number) {
    if (this.worker) {
      this.worker.postMessage({ type: 'setSpeed', speed });

      return;
    }

    this.units = buildUnits(
      this.channels,
      this.groups,
      speed,
      this.sampleRate,
      this.onsetsByGroup,
    );
  }

  seek(outputSample: number) {
    if (this.worker) {
      this.worker.postMessage({ type: 'seek', outputSample });

      return;
    }

    this.units.forEach((unit) => unit.seek(outputSample));
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
      scatterBlocks(this.units, this.channels.length, frames),
    );
  }

  destroy() {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
    this.units = [];
    this.channels = [];
    this.groups = [];
    this.onsetsByGroup = [];
  }
}
