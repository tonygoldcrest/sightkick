import { describe, expect, it, vi } from 'vitest';
import { StaveNote } from 'vexflow';
import {
  flashClass,
  forEachNoteHead,
  getScrollParent,
  keyPrefix,
  samePos,
} from './helpers';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(): SVGElement {
  return document.createElementNS(SVG_NS, 'path') as unknown as SVGElement;
}

describe('keyPrefix', () => {
  it('joins pitch and octave from a plain key', () => {
    expect(keyPrefix('c/5')).toBe('c/5');
    expect(keyPrefix('f/4')).toBe('f/4');
  });

  it('drops any modifier suffix after the octave', () => {
    expect(keyPrefix('g/5/x2')).toBe('g/5');
    expect(keyPrefix('a/4/x3/extra')).toBe('a/4');
  });
});

describe('samePos', () => {
  it('treats matching indices as equal', () => {
    expect(
      samePos({ measureIdx: 1, noteIdx: 2 }, { measureIdx: 1, noteIdx: 2 }),
    ).toBe(true);
  });

  it('treats differing indices as not equal', () => {
    expect(
      samePos({ measureIdx: 1, noteIdx: 2 }, { measureIdx: 1, noteIdx: 3 }),
    ).toBe(false);
  });

  it('compares undefined by identity', () => {
    expect(samePos(undefined, undefined)).toBe(true);
    expect(samePos({ measureIdx: 0, noteIdx: 0 }, undefined)).toBe(false);
    expect(samePos(undefined, { measureIdx: 0, noteIdx: 0 })).toBe(false);
  });
});

describe('flashClass', () => {
  it('adds the class then removes it once the animation ends', () => {
    const el = svg();

    flashClass(el, 'flash');
    expect(el.classList.contains('flash')).toBe(true);

    el.dispatchEvent(new Event('animationend'));
    expect(el.classList.contains('flash')).toBe(false);
  });

  it('does nothing when the class is already present', () => {
    const el = svg();

    el.classList.add('flash');

    const spy = vi.spyOn(el, 'addEventListener');

    flashClass(el, 'flash');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('forEachNoteHead', () => {
  it('invokes the callback with each note head element and its key prefix', () => {
    const head = svg();
    const note = {
      getKeys: () => ['c/5', 'g/5/x2'],
      noteHeads: [
        { getSVGElement: () => head },
        { getSVGElement: () => undefined },
      ],
    } as unknown as StaveNote;
    const cb = vi.fn();

    forEachNoteHead(note, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(head, 'c/5');
  });
});

describe('getScrollParent', () => {
  it('returns the nearest scrollable ancestor', () => {
    const scroller = document.createElement('div');

    scroller.style.overflowY = 'auto';
    Object.defineProperty(scroller, 'scrollHeight', { value: 100 });
    Object.defineProperty(scroller, 'clientHeight', { value: 50 });

    const child = document.createElement('div');

    scroller.appendChild(child);

    expect(getScrollParent(child)).toBe(scroller);
  });

  it('returns undefined when no ancestor scrolls', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');

    parent.appendChild(child);

    expect(getScrollParent(child)).toBeUndefined();
    expect(getScrollParent(undefined)).toBeUndefined();
  });
});
