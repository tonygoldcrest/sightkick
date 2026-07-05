import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from '../hooks/test-support';
import { AppProvider, useApp } from './AppContext';

function wrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

beforeEach(() => {
  installLocalStorage();
});

describe('AppContext', () => {
  it('defaults difficulty to expert', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    expect(result.current.difficulty).toBe('expert');
  });

  it('persists difficulty when changed', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => result.current.setDifficulty('hard'));

    expect(result.current.difficulty).toBe('hard');
    expect(window.localStorage.getItem('settings.difficulty')).toBe('"hard"');
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useApp())).toThrow(
      'useApp must be used within AppProvider',
    );
  });
});
