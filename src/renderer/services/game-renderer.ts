import { StaveNote } from 'vexflow';
import { ParsedChart, RenderData } from '../../chart-parser/types';
import { PlayheadStyle } from '../types';
import { keyPrefix } from './judge';
import { getCursorX, getNoteSvg } from '../views/utils';

export type IsHit = (tick: number, prefix: string) => boolean;

export interface GameRendererContext {
  chart: ParsedChart | undefined;
  renderData: RenderData[];
}

export interface GameRendererRefs {
  cursorEl: HTMLElement | undefined;
  highlightEls: (HTMLElement | undefined)[];
}

interface NotePos {
  measureIdx: number;
  noteIdx: number;
}

interface ActiveNote extends NotePos {
  noteHeadEls: SVGElement[];
}

function samePos(a: NotePos | undefined, b: NotePos | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }

  return a.measureIdx === b.measureIdx && a.noteIdx === b.noteIdx;
}

const ACTIVE_CLASS = 'vf-note-active';
const POP_CLASS = 'vf-note-pop';
const MISS_CLASS = 'vf-note-miss';
const HIT_CLASS = 'vf-note-hit';
const MISSED_CLASS = 'vf-note-missed';

function flashClass(el: SVGElement, cls: string): void {
  if (el.classList.contains(cls)) {
    return;
  }

  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), {
    once: true,
  });
}

function forEachNoteHead(
  note: StaveNote,
  cb: (el: SVGElement, prefix: string) => void,
): void {
  note.getKeys().forEach((key, i) => {
    const el = note.noteHeads[i]?.getSVGElement();

    if (el) {
      cb(el, keyPrefix(key));
    }
  });
}

function getScrollParent(
  node: HTMLElement | undefined,
): HTMLElement | undefined {
  let el = node?.parentElement ?? undefined;

  while (el) {
    const { overflowY } = getComputedStyle(el);

    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }

    el = el.parentElement ?? undefined;
  }

  return undefined;
}

export class GameRenderer {
  private chart: ParsedChart | undefined;
  private renderData: RenderData[] = [];
  private playheadStyle: PlayheadStyle = 'Cursor';
  private cursorEl: HTMLElement | undefined;
  private cursorShown = false;
  private cursorHeight = -1;
  private highlightEls: (HTMLElement | undefined)[] = [];
  private scrollContainer: HTMLElement | undefined;
  private measureIdx = -1;
  private activePos: NotePos | undefined;
  private coloredPos: NotePos | undefined;
  private activeEls: SVGElement[] = [];
  private filledEls = new Set<SVGElement>();

  constructor(private isHit: IsHit) {}

  setContext(context: GameRendererContext): void {
    const renderDataChanged = this.renderData !== context.renderData;

    this.chart = context.chart;
    this.renderData = context.renderData;

    if (renderDataChanged) {
      this.reset();
    }
  }

  setSettings(playheadStyle: PlayheadStyle): void {
    this.playheadStyle = playheadStyle;
    this.activePos = undefined;
    this.coloredPos = undefined;

    if (this.measureIdx >= 0) {
      this.updateHighlight(this.measureIdx);
    }
  }

  setRefs(refs: GameRendererRefs): void {
    this.cursorEl = refs.cursorEl;
    this.highlightEls = refs.highlightEls;
    this.scrollContainer = undefined;
    this.reset();
  }

  render(chartTime: number, tick: number): void {
    this.syncMeasure(tick);
    this.syncActiveNote(tick);
    this.updateCursor(chartTime);
  }

  paintHit(note: StaveNote, prefixes: string[]): void {
    note.getKeys().forEach((key, i) => {
      if (!prefixes.includes(keyPrefix(key))) {
        return;
      }

      const el = note.noteHeads[i]?.getSVGElement();

      if (!el) {
        return;
      }

      el.classList.remove(MISSED_CLASS);
      el.classList.add(HIT_CLASS);
      this.filledEls.add(el);
      flashClass(el, POP_CLASS);
    });
  }

  reset(): void {
    this.measureIdx = -1;
    this.activePos = undefined;
    this.coloredPos = undefined;
    this.scrollContainer = undefined;
    this.cursorShown = false;
    this.cursorHeight = -1;
    this.activeEls.forEach((el) => el.classList.remove(ACTIVE_CLASS));
    this.activeEls = [];
    this.filledEls.forEach((el) =>
      el.classList.remove(HIT_CLASS, MISSED_CLASS),
    );
    this.filledEls.clear();
  }

  private syncMeasure(tick: number): void {
    const idx = this.seekMeasure(tick);

    if (idx < 0 || idx === this.measureIdx) {
      return;
    }

    this.measureIdx = idx;
    this.updateHighlight(idx);
    this.updateScroll(idx);
  }

  private seekMeasure(tick: number): number {
    const rd = this.renderData;

    if (rd.length === 0) {
      return -1;
    }

    let idx =
      this.measureIdx < 0 ? 0 : Math.min(this.measureIdx, rd.length - 1);

    while (idx + 1 < rd.length && tick >= rd[idx + 1].measure.startTick) {
      idx++;
    }

    while (idx > 0 && tick < rd[idx].measure.startTick) {
      idx--;
    }

    const { measure } = rd[idx];

    return tick >= measure.startTick && tick < measure.endTick ? idx : -1;
  }

  private syncActiveNote(tick: number): void {
    const pos = this.locateActiveNote(tick);

    if (samePos(pos, this.activePos)) {
      return;
    }

    this.activePos = pos;

    const target = pos ? this.toActiveNote(pos) : undefined;

    this.applyActive(target);
    this.applyColoring(target);
  }

  private locateActiveNote(tick: number): NotePos | undefined {
    const mIdx = this.measureIdx;

    if (mIdx < 0) {
      return undefined;
    }

    const notes = this.renderData[mIdx]?.renderedNotes;

    if (!notes) {
      return undefined;
    }

    let nIdx =
      this.activePos?.measureIdx === mIdx ? this.activePos.noteIdx : -1;

    while (nIdx + 1 < notes.length && notes[nIdx + 1].tick <= tick) {
      nIdx++;
    }

    while (nIdx >= 0 && notes[nIdx].tick > tick) {
      nIdx--;
    }

    return nIdx < 0 ? undefined : { measureIdx: mIdx, noteIdx: nIdx };
  }

  private toActiveNote(pos: NotePos): ActiveNote | undefined {
    const note =
      this.renderData[pos.measureIdx].renderedNotes[pos.noteIdx].note;
    const noteHeadEls = getNoteSvg(note);

    return noteHeadEls.length === 0 ? undefined : { ...pos, noteHeadEls };
  }

  private applyActive(target: ActiveNote | undefined): void {
    this.activeEls.forEach((el) => el.classList.remove(ACTIVE_CLASS));
    this.activeEls = target?.noteHeadEls ?? [];
    this.activeEls.forEach((el) => el.classList.add(ACTIVE_CLASS));
  }

  private applyColoring(target: ActiveNote | undefined): void {
    const clearAll = () => {
      this.filledEls.forEach((el) => {
        el.classList.remove(HIT_CLASS, MISSED_CLASS);
      });
      this.filledEls.clear();
    };

    if (!target) {
      clearAll();
      this.coloredPos = undefined;

      return;
    }

    const { measureIdx, noteIdx } = target;
    const curNotes = this.renderData[measureIdx].renderedNotes;
    const prev = this.coloredPos;
    const isBackward =
      prev !== undefined &&
      (measureIdx < prev.measureIdx ||
        (measureIdx === prev.measureIdx && noteIdx < prev.noteIdx));
    const flashMisses = !isBackward;
    const colorNote = (
      el: SVGElement,
      tick: number,
      key: string,
      isRest: boolean,
    ) => {
      const hit = this.isHit(tick, key);

      el.classList.remove(hit ? MISSED_CLASS : HIT_CLASS);
      el.classList.add(hit ? HIT_CLASS : MISSED_CLASS);
      this.filledEls.add(el);

      if (flashMisses && !hit && !isRest) {
        flashClass(el, MISS_CLASS);
      }
    };

    if (isBackward) {
      clearAll();

      for (let m = 0; m < measureIdx; m++) {
        this.renderData[m]?.renderedNotes.forEach(({ note, tick }) =>
          forEachNoteHead(note, (el, key) =>
            colorNote(el, tick, key, note.isRest()),
          ),
        );
      }

      for (let i = 0; i < noteIdx; i++) {
        const { note, tick } = curNotes[i];

        forEachNoteHead(note, (el, key) =>
          colorNote(el, tick, key, note.isRest()),
        );
      }
    } else {
      const fromMeasure = prev?.measureIdx ?? 0;
      const fromNote = prev?.noteIdx ?? 0;

      if (fromMeasure === measureIdx) {
        for (let i = fromNote; i < noteIdx; i++) {
          const { note, tick } = curNotes[i];

          forEachNoteHead(note, (el, key) =>
            colorNote(el, tick, key, note.isRest()),
          );
        }
      } else {
        const prevMeasureNotes =
          this.renderData[fromMeasure]?.renderedNotes ?? [];

        for (let i = fromNote; i < prevMeasureNotes.length; i++) {
          const { note, tick } = prevMeasureNotes[i];

          forEachNoteHead(note, (el, key) =>
            colorNote(el, tick, key, note.isRest()),
          );
        }

        for (let m = fromMeasure + 1; m < measureIdx; m++) {
          this.renderData[m]?.renderedNotes.forEach(({ note, tick }) =>
            forEachNoteHead(note, (el, key) =>
              colorNote(el, tick, key, note.isRest()),
            ),
          );
        }

        for (let i = 0; i < noteIdx; i++) {
          const { note, tick } = curNotes[i];

          forEachNoteHead(note, (el, key) =>
            colorNote(el, tick, key, note.isRest()),
          );
        }
      }
    }

    this.coloredPos = { measureIdx, noteIdx };
  }

  private updateHighlight(index: number): void {
    this.highlightEls.forEach((el, i) => {
      if (!el) {
        return;
      }

      const on = this.playheadStyle === 'Measure' && i === index;

      el.style.backgroundColor = on ? 'var(--color-accent-soft-bg)' : '';
      el.style.border = on ? '2px solid var(--color-accent-bright)' : '';
    });
  }

  private updateCursor(chartTime: number): void {
    const el = this.cursorEl;

    if (!el) {
      return;
    }

    const measureData = this.renderData[this.measureIdx];

    if (this.playheadStyle !== 'Cursor' || !this.chart || !measureData) {
      el.style.display = 'none';
      this.cursorShown = false;

      return;
    }

    const x = getCursorX(chartTime, this.chart, measureData);
    const y = measureData.yOffset + measureData.stave.getY();
    const height = measureData.stave.getHeight() + 30;

    el.style.transform = `translate3d(${x}px, ${y}px, 0) translateX(-50%)`;

    if (height !== this.cursorHeight) {
      el.style.height = `${height}px`;
      this.cursorHeight = height;
    }

    if (!this.cursorShown) {
      el.style.display = '';
      this.cursorShown = true;
    }
  }

  private updateScroll(index: number): void {
    const el = this.highlightEls[index];

    if (!el) {
      return;
    }

    const container =
      this.scrollContainer ?? (this.scrollContainer = getScrollParent(el));

    if (!container) {
      return;
    }

    const elRect = el.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    const margin = parentRect.height * 0.25;
    const outOfView =
      elRect.top < parentRect.top + margin ||
      elRect.bottom > parentRect.bottom - margin;

    if (outOfView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
