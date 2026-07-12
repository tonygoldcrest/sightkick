import { Measure, Note, ParsedChart } from '../../../chart-parser/types';
import { InputMapping } from '../../../types';
import { InputEvent } from '../../input/types';
import { secondsToTicks, ticksToSeconds } from '../../../chart-parser/timing';
import { JudgeContext, JudgeHitHandler, NoteEntry, NotePos } from './types';
import {
  ACCENT_VALUE_THRESHOLD,
  ELEMENT_TO_KEYS,
  GHOST_VALUE_THRESHOLD,
  HIT_TOLERANCE_SECONDS,
} from './constants';
import { keyPrefix } from './helpers';
import { lowerBound } from '../../helpers';

export class Judge {
  private chart: ParsedChart | undefined;
  private measures: Measure[] = [];
  private noteIndex: NoteEntry[] = [];
  private mapping: InputMapping = {};
  private enabled = false;
  private currentTick: number | undefined;
  private hits = new Map<number, Set<string>>();
  private hitTotal = 0;
  private falseHitTicks: number[] = [];
  private hitListeners = new Set<JudgeHitHandler>();

  setContext(context: JudgeContext): void {
    const chartChanged = this.chart !== context.chart;
    const measuresChanged = this.measures !== context.measures;

    this.chart = context.chart;
    this.mapping = context.mapping;
    this.measures = context.measures;

    if (measuresChanged) {
      this.buildNoteIndex();
    }

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
    for (const [hitTick, prefixes] of this.hits) {
      if (hitTick >= tick) {
        this.hitTotal -= prefixes.size;
        this.hits.delete(hitTick);
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
    return this.hits.get(tick)?.has(prefix) ?? false;
  }

  get hitCount(): number {
    return this.hitTotal;
  }

  get falseHitCount(): number {
    return this.falseHitTicks.length;
  }

  reset(): void {
    this.hits.clear();
    this.hitTotal = 0;
    this.falseHitTicks = [];
  }

  private buildNoteIndex(): void {
    const index: NoteEntry[] = [];

    this.measures.forEach((measure, measureIdx) => {
      measure.notes.forEach((note, noteIdx) => {
        if (!note.isRest) {
          index.push({ tick: note.tick, note, pos: { measureIdx, noteIdx } });
        }
      });
    });

    index.sort((a, b) => a.tick - b.tick);
    this.noteIndex = index;
  }

  private firstNoteAtOrAfter(tick: number): number {
    return lowerBound(
      this.noteIndex.length,
      (index) => this.noteIndex[index].tick >= tick,
    );
  }

  private recordHit(tick: number, prefix: string): void {
    let prefixes = this.hits.get(tick);

    if (!prefixes) {
      prefixes = new Set();
      this.hits.set(tick, prefixes);
    }

    if (!prefixes.has(prefix)) {
      prefixes.add(prefix);
      this.hitTotal += 1;
    }
  }

  private containingMeasure(tick: number): Measure | undefined {
    const firstAfter = lowerBound(
      this.measures.length,
      (index) => this.measures[index].startTick > tick,
    );
    const candidate = this.measures[firstAfter - 1];

    if (candidate && tick >= candidate.startTick && tick < candidate.endTick) {
      return candidate;
    }

    return undefined;
  }

  private isInSilentRegion(tick: number): boolean {
    const containing = this.containingMeasure(tick);

    if (!containing) {
      return true;
    }

    return containing.notes.every((note) => note.isRest);
  }

  private hasScoreableNoteNear(tick: number, toleranceTicks: number): boolean {
    const entry =
      this.noteIndex[this.firstNoteAtOrAfter(tick - toleranceTicks)];

    return entry !== undefined && entry.tick <= tick + toleranceTicks;
  }

  private maybeRecordFalseHit(tick: number, toleranceTicks: number): void {
    if (
      !this.isInSilentRegion(tick) ||
      this.hasScoreableNoteNear(tick, toleranceTicks)
    ) {
      this.falseHitTicks.push(tick);
    }
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

    for (
      let i = this.firstNoteAtOrAfter(tick - toleranceTicks);
      i < this.noteIndex.length;
      i += 1
    ) {
      const entry = this.noteIndex[i];

      if (entry.tick > tick + toleranceTicks) {
        break;
      }

      const dist = Math.abs(entry.tick - tick);

      if (dist >= bestDist) {
        continue;
      }

      const hasMatchingKey = entry.note.notes.some((k) =>
        expectedPrefixes.has(keyPrefix(k)),
      );

      if (hasMatchingKey) {
        bestDist = dist;
        bestNote = entry.note;
        bestPos = entry.pos;
      }
    }

    if (!bestNote || !bestPos) {
      this.maybeRecordFalseHit(tick, toleranceTicks);

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
          !this.isHit(hit.tick, p) &&
          passesVelocity(p),
      );

    if (newPrefixes.length === 0) {
      this.maybeRecordFalseHit(tick, toleranceTicks);

      return;
    }

    newPrefixes.forEach((p) => this.recordHit(hit.tick, p));
    this.hitListeners.forEach((listener) => listener(pos, newPrefixes));
  }
}
