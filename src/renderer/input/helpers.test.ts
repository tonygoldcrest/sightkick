import { describe, expect, it } from 'vitest';
import {
  controlLabel,
  controlSource,
  isTypingTarget,
  makeControlId,
} from './helpers';

describe('makeControlId', () => {
  it('namespaces a numeric raw control under its source', () => {
    expect(makeControlId('midi', 38)).toBe('midi:38');
  });

  it('namespaces a string raw control under its source', () => {
    expect(makeControlId('keyboard', 'KeyJ')).toBe('keyboard:KeyJ');
  });

  it('round-trips through controlSource and controlLabel', () => {
    const id = makeControlId('midi', 'Pad 1');

    expect(controlSource(id)).toBe('midi');
    expect(controlLabel(id)).toBe('Pad 1');
  });
});

describe('controlSource', () => {
  it('returns the part before the first colon', () => {
    expect(controlSource('keyboard:KeyJ')).toBe('keyboard');
  });

  it('splits only on the first colon', () => {
    expect(controlSource('midi:a:b')).toBe('midi');
  });

  it('returns the whole id when there is no colon', () => {
    expect(controlSource('bare')).toBe('bare');
  });

  it('returns an empty source for a leading colon', () => {
    expect(controlSource(':38')).toBe('');
  });
});

describe('controlLabel', () => {
  it('returns the part after the first colon', () => {
    expect(controlLabel('keyboard:KeyJ')).toBe('KeyJ');
  });

  it('keeps later colons in the label', () => {
    expect(controlLabel('midi:a:b')).toBe('a:b');
  });

  it('returns the whole id when there is no colon', () => {
    expect(controlLabel('bare')).toBe('bare');
  });

  it('returns an empty label for a trailing colon', () => {
    expect(controlLabel('midi:')).toBe('');
  });
});

describe('isTypingTarget', () => {
  it('is true for input and textarea elements', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    const el = document.createElement('div');

    Object.defineProperty(el, 'isContentEditable', { value: true });

    expect(isTypingTarget(el)).toBe(true);
  });

  it('is false for a non-editable element and for null', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
