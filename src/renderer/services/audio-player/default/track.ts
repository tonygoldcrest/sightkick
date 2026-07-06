import { BaseAudioTrack } from '../base-track';

export class DefaultAudioTrack extends BaseAudioTrack {
  private sources: AudioBufferSourceNode[] = [];

  ended: boolean = false;

  endedListener: (() => void) | null = null;

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
    super.destroy();
    this.endedListener = null;
  }
}
