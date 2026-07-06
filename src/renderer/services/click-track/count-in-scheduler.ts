export class CountInScheduler {
  readonly songStartCtx: number;
  readonly beatMs: number;
  private readonly startCtx: number;
  private readonly beatDuration: number;
  private readonly beats: number;
  private currentBeat = 1;

  constructor(startCtx: number, beats: number, beatDuration: number) {
    this.startCtx = startCtx;
    this.beats = beats;
    this.beatDuration = beatDuration;
    this.songStartCtx = startCtx + beats * beatDuration;
    this.beatMs = beatDuration * 1000;
  }

  get beat(): number {
    return this.currentBeat;
  }

  isComplete(now: number): boolean {
    return now >= this.songStartCtx;
  }

  advanceTo(now: number): boolean {
    const beat = Math.min(
      this.beats,
      Math.max(1, Math.floor((now - this.startCtx) / this.beatDuration) + 1),
    );

    if (beat === this.currentBeat) {
      return false;
    }

    this.currentBeat = beat;

    return true;
  }
}
