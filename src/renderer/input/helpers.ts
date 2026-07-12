import { SourceId } from './types';

export function makeControlId(
  sourceId: SourceId,
  raw: string | number,
): string {
  return `${sourceId}:${raw}`;
}

export function controlSource(controlId: string): string {
  const index = controlId.indexOf(':');

  return index === -1 ? controlId : controlId.slice(0, index);
}

export function controlLabel(controlId: string): string {
  const index = controlId.indexOf(':');

  return index === -1 ? controlId : controlId.slice(index + 1);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;

  return Boolean(
    el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable),
  );
}
