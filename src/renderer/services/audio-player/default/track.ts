import { BaseAudioTrack } from '../base-track';
import { LoopWindow } from '../types';

export class DefaultAudioTrack extends BaseAudioTrack {
  private sources: AudioBufferSourceNode[] = [];
  private loop: LoopWindow | undefined;

  ended: boolean = false;

  endedListener: (() => void) | null = null;

  setLoop(loop: LoopWindow | undefined) {
    this.loop = loop;
    this.sources.forEach((source) => this.applyLoop(source));
  }

  private applyLoop(source: AudioBufferSourceNode) {
    if (this.loop && this.loop.end > this.loop.start) {
      source.loop = true;
      source.loopStart = this.loop.start;
      source.loopEnd = this.loop.end;
    } else {
      source.loop = false;
    }
  }

  start(at: number, offset: number) {
    if (this.sources.length > 0) {
      this.stop();
    }

    this.ended = false;
    this.sources = this.buffers.map((buffer, index) => {
      const source = this.context.createBufferSource();

      source.buffer = buffer;
      this.applyLoop(source);
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
