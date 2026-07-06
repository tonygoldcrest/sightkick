import { Measure, Note, ParsedChart } from '../../../chart-parser/types';
import { InputMapping } from '../../../types';
import { InputEvent } from '../../input/types';
import { secondsToTicks, ticksToSeconds } from '../../../chart-parser/timing';
import { JudgeContext, JudgeHitHandler, NotePos } from './types';
import {
  ACCENT_VALUE_THRESHOLD,
  ELEMENT_TO_KEYS,
  GHOST_VALUE_THRESHOLD,
  HIT_TOLERANCE_SECONDS,
} from './constants';
import { keyPrefix } from './helpers';

export class Judge {
  private chart: ParsedChart | undefined;
  private measures: Measure[] = [];
  private mapping: InputMapping = {};
  private enabled = false;
  private currentTick: number | undefined;
  private hitKeys = new Set<string>();
  private falseHitTicks: number[] = [];
  private hitListeners = new Set<JudgeHitHandler>();

  setContext(context: JudgeContext): void {
    const chartChanged = this.chart !== context.chart;

    this.chart = context.chart;
    this.mapping = context.mapping;
    this.measures = context.measures;

    if (chartChanged) {
      this.reset();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setTick(tick: number | undefined): void {
    this.currentTick = tick;
  }

  rewindTo(tick: number): void {
    for (const key of this.hitKeys) {
      if (parseInt(key, 10) >= tick) {
        this.hitKeys.delete(key);
      }
    }

    this.falseHitTicks = this.falseHitTicks.filter((t) => t < tick);
    this.currentTick = tick;
  }

  onHit(listener: JudgeHitHandler): () => void {
    this.hitListeners.add(listener);

    return () => {
      this.hitListeners.delete(listener);
    };
  }

  isHit(tick: number, prefix: string): boolean {
    return this.hitKeys.has(`${tick}:${prefix}`);
  }

  get hitCount(): number {
    return this.hitKeys.size;
  }

  get falseHitCount(): number {
    return this.falseHitTicks.length;
  }

  reset(): void {
    this.hitKeys.clear();
    this.falseHitTicks = [];
  }

  private isInSilentMeasure(tick: number): boolean {
    const containing = this.measures.find(
      (measure) => tick >= measure.startTick && tick < measure.endTick,
    );

    if (!containing) {
      return false;
    }

    return containing.notes.every((note) => note.isRest);
  }

  private hasScoreableNoteNear(tick: number, toleranceTicks: number): boolean {
    for (const measure of this.measures) {
      for (const note of measure.notes) {
        if (!note.isRest && Math.abs(note.tick - tick) <= toleranceTicks) {
          return true;
        }
      }
    }

    return false;
  }

  handleInput({ controlId, value }: InputEvent): void {
    if (value === 0 || !this.enabled) {
      return;
    }

    const expectedPrefixes = new Set(
      Object.entries(this.mapping).flatMap(([element, controls]) =>
        controls?.includes(controlId) ? ELEMENT_TO_KEYS[element] ?? [] : [],
      ),
    );

    if (expectedPrefixes.size === 0) {
      return;
    }

    const tick = this.currentTick;
    const chart = this.chart;

    if (tick === undefined || chart === undefined) {
      return;
    }

    const currentTimeS = ticksToSeconds(tick, chart.resolution, chart.tempos);
    const toleranceTicks =
      secondsToTicks(
        currentTimeS + HIT_TOLERANCE_SECONDS,
        chart.resolution,
        chart.tempos,
      ) - tick;
    let bestDist = Infinity;
    let bestNote: Note | undefined;
    let bestPos: NotePos | undefined;

    this.measures.forEach((measure, measureIdx) => {
      measure.notes.forEach((note, noteIdx) => {
        if (note.isRest) {
          return;
        }

        const dist = Math.abs(note.tick - tick);

        if (dist > toleranceTicks || dist >= bestDist) {
          return;
        }

        const hasMatchingKey = note.notes.some((k) =>
          expectedPrefixes.has(keyPrefix(k)),
        );

        if (hasMatchingKey) {
          bestDist = dist;
          bestNote = note;
          bestPos = { measureIdx, noteIdx };
        }
      });
    });

    if (!bestNote || !bestPos) {
      if (
        !this.isInSilentMeasure(tick) ||
        this.hasScoreableNoteNear(tick, toleranceTicks)
      ) {
        this.falseHitTicks.push(tick);
      }

      return;
    }

    const hit = bestNote;
    const pos = bestPos;
    const accentPrefixes = new Set((hit.accents ?? []).map(keyPrefix));
    const ghostPrefixes = new Set((hit.ghosts ?? []).map(keyPrefix));
    const passesVelocity = (prefix: string) => {
      if (accentPrefixes.has(prefix)) {
        return value > ACCENT_VALUE_THRESHOLD;
      }

      if (ghostPrefixes.has(prefix)) {
        return value < GHOST_VALUE_THRESHOLD;
      }

      return true;
    };
    const newPrefixes = hit.notes
      .map(keyPrefix)
      .filter(
        (p) =>
          expectedPrefixes.has(p) &&
          !this.hitKeys.has(`${hit.tick}:${p}`) &&
          passesVelocity(p),
      );

    if (newPrefixes.length === 0) {
      if (
        !this.isInSilentMeasure(tick) ||
        this.hasScoreableNoteNear(tick, toleranceTicks)
      ) {
        this.falseHitTicks.push(tick);
      }

      return;
    }

    newPrefixes.forEach((p) => this.hitKeys.add(`${hit.tick}:${p}`));
    this.hitListeners.forEach((listener) => listener(pos, newPrefixes));
  }
}
