import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputMapping } from '../../types';
import { InputEvent } from '../input/types';
import { InputControlHandlers, useInputControls } from './useInputControls';

const { listeners } = vi.hoisted(() => ({
  listeners: new Set<(event: InputEvent) => void>(),
}));

vi.mock('../input', () => ({
  inputBus: {
    subscribe: (listener: (event: InputEvent) => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  },
}));

interface Props {
  mapping: InputMapping;
  handlers: InputControlHandlers;
  enabled?: boolean;
  blockedControlIds?: Set<string>;
}

function setup(initial: Props) {
  return renderHook(
    ({ mapping, handlers, enabled = true, blockedControlIds }: Props) =>
      useInputControls(mapping, handlers, enabled, blockedControlIds),
    { initialProps: initial },
  );
}

function press(controlId: string, value = 100) {
  act(() => listeners.forEach((listener) => listener({ controlId, value })));
}

describe('useInputControls', () => {
  it('subscribes to the input bus and stops on unmount', () => {
    const { unmount } = setup({
      mapping: { snare: ['midi:38'] },
      handlers: {},
    });

    expect(listeners.size).toBe(1);

    unmount();

    expect(listeners.size).toBe(0);
  });

  it('invokes the handler mapped to the incoming control', () => {
    const snare = vi.fn();

    setup({
      mapping: { snare: ['midi:38'], kick: ['midi:36'] },
      handlers: { snare },
    });

    press('midi:38');

    expect(snare).toHaveBeenCalledTimes(1);
  });

  it('routes different controls to their own handlers', () => {
    const snare = vi.fn();
    const kick = vi.fn();

    setup({
      mapping: { snare: ['midi:38'], kick: ['midi:36'] },
      handlers: { snare, kick },
    });

    press('midi:36');

    expect(kick).toHaveBeenCalledTimes(1);
    expect(snare).not.toHaveBeenCalled();
  });

  it('does nothing for an unmapped control', () => {
    const snare = vi.fn();

    setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
    });

    press('midi:99');

    expect(snare).not.toHaveBeenCalled();
  });

  it('does nothing when no handler is registered for the element', () => {
    setup({
      mapping: { snare: ['midi:38'] },
      handlers: {},
    });

    expect(() => press('midi:38')).not.toThrow();
  });

  it('ignores input with zero value', () => {
    const snare = vi.fn();

    setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
    });

    press('midi:38', 0);

    expect(snare).not.toHaveBeenCalled();
  });

  it('ignores hits while disabled', () => {
    const snare = vi.fn();

    setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
      enabled: false,
    });

    press('midi:38');

    expect(snare).not.toHaveBeenCalled();
  });

  it('reacts to the enabled flag changing without resubscribing', () => {
    const snare = vi.fn();
    const { rerender } = setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
      enabled: false,
    });

    press('midi:38');
    expect(snare).not.toHaveBeenCalled();

    rerender({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
      enabled: true,
    });

    expect(listeners.size).toBe(1);

    press('midi:38');
    expect(snare).toHaveBeenCalledTimes(1);
  });

  it('uses the latest handlers without resubscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare: first },
    });

    rerender({
      mapping: { snare: ['midi:38'] },
      handlers: { snare: second },
    });

    press('midi:38');

    expect(listeners.size).toBe(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('uses the latest mapping without resubscribing', () => {
    const snare = vi.fn();
    const { rerender } = setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
    });

    rerender({
      mapping: { snare: ['midi:40'] },
      handlers: { snare },
    });

    press('midi:38');
    expect(snare).not.toHaveBeenCalled();

    press('midi:40');
    expect(snare).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
  });

  it('skips controls that are blocked', () => {
    const snare = vi.fn();
    const kick = vi.fn();

    setup({
      mapping: { snare: ['midi:38'], kick: ['keyboard:Enter'] },
      handlers: { snare, kick },
      blockedControlIds: new Set(['midi:38']),
    });

    press('midi:38');
    press('keyboard:Enter');

    expect(snare).not.toHaveBeenCalled();
    expect(kick).toHaveBeenCalledTimes(1);
  });

  it('reacts to the blocked set changing without resubscribing', () => {
    const snare = vi.fn();
    const { rerender } = setup({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
    });

    press('midi:38');
    expect(snare).toHaveBeenCalledTimes(1);

    rerender({
      mapping: { snare: ['midi:38'] },
      handlers: { snare },
      blockedControlIds: new Set(['midi:38']),
    });

    press('midi:38');
    expect(snare).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
  });
});
