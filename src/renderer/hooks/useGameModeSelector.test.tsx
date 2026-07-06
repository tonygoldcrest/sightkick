import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameMode } from '../types';

let handlers: Partial<Record<string, () => void>> = {};

vi.mock('../context/InputContext', () => ({
  useInput: () => ({ controlMapping: {} }),
}));

vi.mock('./useInputControls', () => ({
  useInputControls: (
    _mapping: unknown,
    given: Partial<Record<string, () => void>>,
  ) => {
    handlers = given;
  },
}));

import { useGameModeSelector } from './useGameModeSelector';

type OpenResult = Promise<GameMode | undefined>;

beforeEach(() => {
  handlers = {};
});

describe('useGameModeSelector', () => {
  it('opens and resolves with the confirmed mode', async () => {
    const { result } = renderHook(() => useGameModeSelector());
    let promise!: OpenResult;

    act(() => {
      promise = result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => handlers.confirm?.());

    await expect(promise).resolves.toBe('perform');
    expect(result.current.isOpen).toBe(false);
  });

  it('confirms the mode the focus has moved to', async () => {
    const { result } = renderHook(() => useGameModeSelector());
    let promise!: OpenResult;

    act(() => {
      promise = result.current.open();
    });
    act(() => handlers.down?.());
    act(() => handlers.confirm?.());

    await expect(promise).resolves.toBe('practice');
  });

  it('resolves undefined when dismissed with back', async () => {
    const { result } = renderHook(() => useGameModeSelector());
    let promise!: OpenResult;

    act(() => {
      promise = result.current.open();
    });
    act(() => handlers.back?.());

    await expect(promise).resolves.toBeUndefined();
    expect(result.current.isOpen).toBe(false);
  });

  it('resolves a previous pending open with undefined when reopened', async () => {
    const { result } = renderHook(() => useGameModeSelector());
    let first!: OpenResult;

    act(() => {
      first = result.current.open();
    });
    act(() => {
      result.current.open();
    });

    await expect(first).resolves.toBeUndefined();
  });
});
