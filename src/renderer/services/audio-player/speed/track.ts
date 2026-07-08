import { BaseAudioTrack } from '../base-track';

export class SpeedAudioTrack extends BaseAudioTrack {
  private sources: AudioBufferSourceNode[] = [];

  scheduleChunk(fileIndex: number, buffer: AudioBuffer, at: number) {
    const source = this.context.createBufferSource();

    source.buffer = buffer;
    source.connect(this.gainNodes[fileIndex]);
    source.start(at);
    source.addEventListener('ended', this.endedEventListener);
    this.sources.push(source);
  }

  stop() {
    this.sources.forEach((source) => this.stopSource(source));
    this.sources = [];
  }

  endedEventListener = (event: Event) => {
    const source = event.currentTarget as AudioBufferSourceNode;

    source.disconnect();

    const idx = this.sources.indexOf(source);

    if (idx !== -1) {
      this.sources.splice(idx, 1);
    }
  };

  stopSource(source: AudioBufferSourceNode) {
    source.stop();
    source.removeEventListener('ended', this.endedEventListener);
    source.disconnect();
  }
}
