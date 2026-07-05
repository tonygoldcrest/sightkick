import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMuteToggle } from './useMuteToggle';

function render(volume: number, defaultUnmuteVolume = 80) {
  const onChange = vi.fn();
  const view = renderHook(
    ({ value }: { value: number }) =>
      useMuteToggle(value, onChange, defaultUnmuteVolume),
    { initialProps: { value: volume } },
  );
  const setVolume = (next: number) => view.rerender({ value: next });

  return { ...view, onChange, setVolume };
}

describe('useMuteToggle', () => {
  it('reports muted only when the volume is zero', () => {
    const { result, setVolume } = render(50);

    expect(result.current.isMuted).toBe(false);

    setVolume(0);
    expect(result.current.isMuted).toBe(true);
  });

  it('mutes to zero and restores the volume held before muting', () => {
    const { result, onChange, setVolume } = render(70);

    act(() => result.current.toggleMute());
    expect(onChange).toHaveBeenLastCalledWith(0);

    setVolume(0);
    act(() => result.current.toggleMute());
    expect(onChange).toHaveBeenLastCalledWith(70);
  });

  it('restores the default unmute volume when muted from the start', () => {
    const { result, onChange } = render(0, 80);

    act(() => result.current.toggleMute());

    expect(onChange).toHaveBeenLastCalledWith(80);
  });

  it('remembers a manual change as the volume to restore', () => {
    const { result, onChange, setVolume } = render(70);

    act(() => result.current.handleChange(30));
    expect(onChange).toHaveBeenLastCalledWith(30);

    setVolume(30);
    act(() => result.current.toggleMute());
    expect(onChange).toHaveBeenLastCalledWith(0);

    setVolume(0);
    act(() => result.current.toggleMute());
    expect(onChange).toHaveBeenLastCalledWith(30);
  });

  it('does not remember a manual mute-by-drag to zero as the restore point', () => {
    const { result, onChange, setVolume } = render(70);

    act(() => result.current.handleChange(0));
    expect(onChange).toHaveBeenLastCalledWith(0);

    setVolume(0);
    act(() => result.current.toggleMute());

    expect(onChange).toHaveBeenLastCalledWith(80);
  });
});
