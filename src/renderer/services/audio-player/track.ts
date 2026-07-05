export class AudioTrack {
  private gainNodes: GainNode[];

  private _volume: number = 1;

  private sources: AudioBufferSourceNode[] = [];

  duration: number;

  ended: boolean = false;

  endedListener: (() => void) | null = null;

  constructor(
    public buffers: AudioBuffer[],
    public name: string,
    public context: AudioContext,
    destination: AudioNode = context.destination,
  ) {
    this.gainNodes = new Array(buffers.length).fill(null).map(() => {
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
    this.gainNodes.forEach((gainNode) => {
      gainNode.gain.setValueAtTime(newVolume, this.context.currentTime);
    });
  }

  start(at: number, offset: number) {
    if (this.sources.length > 0) {
      this.stop();
    }

    this.ended = false;
    this.sources = this.buffers.map((buffer, index) => {
      const source = this.context.createBufferSource();

      source.buffer = buffer;
      source.start(at, offset);
      source.connect(this.gainNodes[index]);
      source.addEventListener('ended', this.endedEventListener);

      return source;
    });
  }

  stop() {
    this.sources.forEach((source) => this.stopSource(source));
    this.sources = [];
  }

  endedEventListener = (event: Event) => {
    const source = event.currentTarget as AudioBufferSourceNode;

    this.stopSource(source);
    this.sources.splice(this.sources.indexOf(source), 1);

    if (this.sources.length === 0) {
      this.ended = true;
      this.endedListener?.();
    }
  };

  stopSource(source: AudioBufferSourceNode) {
    source.stop();
    source.removeEventListener('ended', this.endedEventListener);
    source.disconnect();
  }

  destroy() {
    this.stop();
    this.gainNodes.forEach((node) => {
      node.disconnect();
    });
    this.gainNodes = [];
    this.endedListener = null;
  }
}
