import { ParsedChart, RenderData } from '../../../chart-parser/types';
import { InputElement, InputMapping } from '../../../types';
import { InputEvent } from '../../input/types';
import { secondsToTicks, ticksToSeconds } from '../../views/utils';
import { JudgeContext, JudgeHitHandler } from './types';
import {
  ACCENT_VALUE_THRESHOLD,
  ELEMENT_TO_KEYS,
  GHOST_VALUE_THRESHOLD,
  HIT_TOLERANCE_SECONDS,
} from './constants';
import { keyPrefix } from './helpers';

export class Judge {
  private chart: ParsedChart | undefined;
  private renderData: RenderData[] = [];
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
    this.renderData = context.renderData;

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
    const containing = this.renderData.find(
      ({ measure }) =>
        measure !== undefined &&
        tick >= measure.startTick &&
        tick < measure.endTick,
    );

    if (!containing) {
      return false;
    }

    return containing.renderedNotes.every((rn) => rn.note.isRest());
  }

  private hasScoreableNoteNear(tick: number, toleranceTicks: number): boolean {
    for (const { renderedNotes } of this.renderData) {
      for (const rn of renderedNotes) {
        if (!rn.note.isRest() && Math.abs(rn.tick - tick) <= toleranceTicks) {
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

    const mapping = this.mapping;
    const hitElements = (Object.keys(mapping) as InputElement[]).filter(
      (key) => ELEMENT_TO_KEYS[key] && mapping[key]?.includes(controlId),
    );

    if (hitElements.length === 0) {
      return;
    }

    const expectedPrefixes = new Set(
      hitElements.flatMap((el) => ELEMENT_TO_KEYS[el] ?? []),
    );
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
    let bestNote: RenderData['renderedNotes'][number] | undefined;

    for (const { renderedNotes } of this.renderData) {
      for (const rn of renderedNotes) {
        if (rn.note.isRest()) {
          continue;
        }

        const dist = Math.abs(rn.tick - tick);

        if (dist > toleranceTicks || dist >= bestDist) {
          continue;
        }

        const hasMatchingKey = rn.note
          .getKeys()
          .some((k) => expectedPrefixes.has(keyPrefix(k)));

        if (hasMatchingKey) {
          bestDist = dist;
          bestNote = rn;
        }
      }
    }

    if (!bestNote) {
      if (
        !this.isInSilentMeasure(tick) ||
        this.hasScoreableNoteNear(tick, toleranceTicks)
      ) {
        this.falseHitTicks.push(tick);
      }

      return;
    }

    const hit = bestNote;
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
    const newPrefixes = hit.note
      .getKeys()
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
    this.hitListeners.forEach((listener) => listener(hit.note, newPrefixes));
  }
}
