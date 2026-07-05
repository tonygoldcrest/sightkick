import {
  ClickBuffers,
  DEFAULT_CLICK_TONE,
  renderClickBuffers,
} from './metronome';

export class ClickTrack {
  private gain: GainNode;
  private buffers: ClickBuffers;
  private tone = DEFAULT_CLICK_TONE;
  private pending = new Set<AudioBufferSourceNode>();

  constructor(private context: AudioContext) {
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(context.destination);
    this.buffers = renderClickBuffers(context, this.tone);
  }

  setTone(tone: number): void {
    if (tone === this.tone) {
      return;
    }

    this.tone = tone;
    this.buffers = renderClickBuffers(this.context, tone);
  }

  scheduleClick(atContextTime: number, isDownbeat: boolean): void {
    const source = this.context.createBufferSource();

    source.buffer = isDownbeat ? this.buffers.downbeat : this.buffers.beat;
    source.connect(this.gain);
    source.addEventListener('ended', () => this.pending.delete(source));
    source.start(Math.max(atContextTime, this.context.currentTime));
    this.pending.add(source);
  }

  setGain(value: number, atContextTime?: number): void {
    this.gain.gain.setValueAtTime(
      value,
      atContextTime ?? this.context.currentTime,
    );
  }

  cancelGain(): void {
    this.gain.gain.cancelScheduledValues(this.context.currentTime);
  }

  clearPending(): void {
    this.pending.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    this.pending.clear();
  }

  dispose(): void {
    this.clearPending();
    this.gain.disconnect();
  }
}
