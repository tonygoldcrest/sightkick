export abstract class BaseAudioTrack {
  protected gainNodes: GainNode[];

  private _volume: number = 1;

  duration: number;

  constructor(
    public buffers: AudioBuffer[],
    public name: string,
    public context: AudioContext,
    destination: AudioNode = context.destination,
  ) {
    this.gainNodes = new Array(buffers.length).fill(undefined).map(() => {
      const gainNode = context.createGain();

      gainNode.connect(destination);

      return gainNode;
    });
    this.duration = Math.max(...this.buffers.map((buffer) => buffer.duration));
  }

  get volume() {
    return this._volume;
  }

  setVolume(newVolume: number) {
    this._volume = newVolume;
    this.gainNodes.forEach((gainNode) => {
      gainNode.gain.setValueAtTime(newVolume, this.context.currentTime);
    });
  }

  abstract stop(): void;

  destroy() {
    this.stop();
    this.gainNodes.forEach((node) => {
      node.disconnect();
    });
    this.gainNodes = [];
  }
}
