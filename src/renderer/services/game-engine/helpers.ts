import { StaveNote } from 'vexflow';
import { NotePos } from './types';

export function keyPrefix(key: string): string {
  const [pitch, octave] = key.split('/');

  return `${pitch}/${octave}`;
}

export function samePos(
  a: NotePos | undefined,
  b: NotePos | undefined,
): boolean {
  if (!a || !b) {
    return a === b;
  }

  return a.measureIdx === b.measureIdx && a.noteIdx === b.noteIdx;
}

export function flashClass(el: SVGElement, cls: string): void {
  if (el.classList.contains(cls)) {
    return;
  }

  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), {
    once: true,
  });
}

export function forEachNoteHead(
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

export function getScrollParent(
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
