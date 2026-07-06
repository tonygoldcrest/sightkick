import { BaseAudioTrack } from '../base-track';

export class SpeedAudioTrack extends BaseAudioTrack {
  private sources: AudioBufferSourceNode[] = [];

  scheduleChunk(fileIndex: number, buffer: AudioBuffer, at: number) {
    const source = this.context.createBufferSource();

    source.buffer = buffer;
    source.connect(this.gainNodes[fileIndex]);
    source.start(at);
    source.addEventListener('ended', () => {
      source.disconnect();
      this.sources.splice(this.sources.indexOf(source), 1);
    });
    this.sources.push(source);
  }

  stop() {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        source.disconnect();
      }

      source.disconnect();
    });
    this.sources = [];
  }
}
