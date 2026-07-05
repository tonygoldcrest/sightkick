import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from '../hooks/test-support';
import {
  SongViewSettingsProvider,
  useSongViewSettings,
} from './SongViewSettingsContext';

function wrapper({ children }: { children: ReactNode }) {
  return <SongViewSettingsProvider>{children}</SongViewSettingsProvider>;
}

beforeEach(() => {
  installLocalStorage();
});

describe('SongViewSettingsContext', () => {
  it('defaults showReference to on', () => {
    const { result } = renderHook(() => useSongViewSettings(), { wrapper });

    expect(result.current.showReference).toBe(true);
  });

  it('persists showReference when toggled off', () => {
    const { result } = renderHook(() => useSongViewSettings(), { wrapper });

    act(() => result.current.setShowReference(false));

    expect(result.current.showReference).toBe(false);
    expect(window.localStorage.getItem('settings.showReference')).toBe('false');
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSongViewSettings())).toThrow(
      'useSongViewSettings must be used within SongViewSettingsProvider',
    );
  });
});
