import { ReactElement } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackConfig } from '../services/audio-player/types';
import { AudioVolumeProps } from '../components/AudioVolume';
import { useVolumeControls } from './useVolumeControls';

const { settings } = vi.hoisted(() => ({
  settings: {
    mixerLevels: {},
    setMixerLevels: vi.fn(),
  },
}));

vi.mock('./usePersisted', () => ({
  usePersisted: () => [settings.mixerLevels, settings.setMixerLevels],
}));

type Result = { current: ReturnType<typeof useVolumeControls> };

function tracks(...names: string[]): TrackConfig[] {
  return names.map((name) => ({ name, urls: [`${name}.ogg`] }));
}

function render(names: string[], isReady = true) {
  const setStemVolume = vi.fn();
  const view = renderHook(
    ({ data, ready }: { data: TrackConfig[]; ready: boolean }) =>
      useVolumeControls(data, setStemVolume, ready),
    { initialProps: { data: tracks(...names), ready: isReady } },
  );
  const rerenderTracks = (next: string[]) =>
    view.rerender({ data: tracks(...next), ready: isReady });

  return { ...view, setStemVolume, rerenderTracks };
}

function control(result: Result, name: string) {
  const found = result.current.volumeControls.find((c) => c.stemName === name);

  if (!found) {
    throw new Error(`no control for ${name}`);
  }

  return found;
}

function sliderProps(result: Result, name: string): AudioVolumeProps {
  const el = result.current.volumeSliders.find(
    (s) => (s as ReactElement<AudioVolumeProps>).props.name === name,
  ) as ReactElement<AudioVolumeProps> | undefined;

  if (!el) {
    throw new Error(`no slider for ${name}`);
  }

  return el.props;
}

function mute(result: Result, name: string) {
  act(() => sliderProps(result, name).onMuteClick());
}

function solo(result: Result, name: string) {
  const { onSoloClick } = sliderProps(result, name);

  if (!onSoloClick) {
    throw new Error(`no solo handler for ${name}`);
  }

  act(() => onSoloClick());
}

function setVolume(result: Result, name: string, value: number) {
  act(() => sliderProps(result, name).onChange(value));
}

describe('useVolumeControls', () => {
  it('initialises a control per track at full volume', () => {
    const { result } = render(['drums', 'guitar']);

    expect(result.current.volumeControls).toHaveLength(2);
    result.current.volumeControls.forEach((c) => {
      expect(c.volume).toBe(100);
      expect(c.isSoloed).toBe(false);
    });
  });

  it('returns nothing with no tracks', () => {
    const { result } = render([]);

    expect(result.current.volumeControls).toEqual([]);
    expect(result.current.volumeSliders).toEqual([]);
  });

  it('builds no sliders before the audio is ready', () => {
    const { result } = render(['drums'], false);

    expect(result.current.volumeControls).toHaveLength(1);
    expect(result.current.volumeSliders).toEqual([]);
  });

  it('pushes the initial volume to each track', () => {
    const { setStemVolume } = render(['drums', 'guitar']);

    expect(setStemVolume).toHaveBeenCalledWith('drums', 1);
    expect(setStemVolume).toHaveBeenCalledWith('guitar', 1);
  });

  it('mutes to zero and restores the previous volume', () => {
    const { result, setStemVolume } = render(['drums']);

    setVolume(result, 'drums', 80);
    mute(result, 'drums');

    expect(control(result, 'drums').volume).toBe(0);
    expect(setStemVolume).toHaveBeenLastCalledWith('drums', 0);

    mute(result, 'drums');

    expect(control(result, 'drums').volume).toBe(80);
    expect(setStemVolume).toHaveBeenLastCalledWith('drums', 0.8);
  });

  it('soloing one track mutes the others', () => {
    const { result } = render(['drums', 'guitar', 'bass']);

    solo(result, 'drums');

    expect(control(result, 'drums').isSoloed).toBe(true);
    expect(control(result, 'drums').volume).toBe(100);
    expect(control(result, 'guitar').volume).toBe(0);
  });

  it('un-soloing the only soloed track restores everyone', () => {
    const { result } = render(['drums', 'guitar']);

    solo(result, 'drums');
    solo(result, 'drums');

    expect(control(result, 'drums').isSoloed).toBe(false);
    expect(control(result, 'guitar').volume).toBe(100);
  });

  it('supports soloing a second track alongside the first', () => {
    const { result } = render(['drums', 'guitar', 'bass']);

    solo(result, 'drums');
    solo(result, 'guitar');

    expect(control(result, 'drums').isSoloed).toBe(true);
    expect(control(result, 'guitar').isSoloed).toBe(true);
    expect(control(result, 'guitar').volume).toBe(100);
  });

  it('un-soloing one of two soloed tracks mutes only that track', () => {
    const { result } = render(['drums', 'guitar', 'bass']);

    solo(result, 'drums');
    solo(result, 'guitar');
    solo(result, 'drums');

    expect(control(result, 'drums').isSoloed).toBe(false);
    expect(control(result, 'drums').volume).toBe(0);
    expect(control(result, 'guitar').isSoloed).toBe(true);
  });

  it('restores the muted volume a solo captured, not a stale default', () => {
    const { result } = render(['drums', 'guitar']);

    setVolume(result, 'guitar', 40);
    solo(result, 'drums');

    expect(control(result, 'guitar').volume).toBe(0);

    solo(result, 'drums');

    expect(control(result, 'guitar').volume).toBe(40);
  });

  it('rebuilds controls when the track list changes', () => {
    const { result, rerenderTracks } = render(['drums']);

    mute(result, 'drums');
    expect(control(result, 'drums').volume).toBe(0);

    rerenderTracks(['drums', 'guitar']);

    expect(result.current.volumeControls).toHaveLength(2);
    expect(control(result, 'drums').volume).toBe(100);
  });

  describe('persistence', () => {
    beforeEach(() => {
      settings.setMixerLevels.mockClear();
      settings.mixerLevels = {};
    });

    it('initialises from a persisted level', () => {
      settings.mixerLevels = { drums: 60, guitar: 80 };

      const { result } = render(['drums', 'guitar']);

      expect(control(result, 'drums').volume).toBe(60);
      expect(control(result, 'guitar').volume).toBe(80);
    });

    it('falls back to 100 for a stem with no persisted level', () => {
      settings.mixerLevels = { drums: 60 };

      const { result } = render(['drums', 'guitar']);

      expect(control(result, 'guitar').volume).toBe(100);
    });

    it('uses the persisted level when the track list changes, not the transient muted volume', () => {
      settings.mixerLevels = { drums: 80 };

      const { result, rerenderTracks } = render(['drums']);

      mute(result, 'drums');
      expect(control(result, 'drums').volume).toBe(0);

      rerenderTracks(['drums', 'guitar']);

      expect(control(result, 'drums').volume).toBe(80);
    });

    it('writes to mixerLevels when the slider changes', () => {
      const { result } = render(['drums']);

      setVolume(result, 'drums', 75);

      expect(settings.setMixerLevels).toHaveBeenCalledWith({ drums: 75 });
    });

    it('writes zero to mixerLevels when muting', () => {
      const { result } = render(['drums']);

      setVolume(result, 'drums', 80);
      settings.setMixerLevels.mockClear();
      mute(result, 'drums');

      expect(settings.setMixerLevels).toHaveBeenCalledWith({ drums: 0 });
    });

    it('writes the restored volume to mixerLevels when unmuting', () => {
      const { result } = render(['drums']);

      setVolume(result, 'drums', 80);
      mute(result, 'drums');
      settings.setMixerLevels.mockClear();
      mute(result, 'drums');

      expect(settings.setMixerLevels).toHaveBeenCalledWith({ drums: 80 });
    });

    it('does not write to mixerLevels when soloing the first track', () => {
      const { result } = render(['drums', 'guitar']);

      solo(result, 'drums');

      expect(settings.setMixerLevels).not.toHaveBeenCalled();
    });

    it('does not write to mixerLevels when un-soloing the last soloed track', () => {
      const { result } = render(['drums', 'guitar']);

      solo(result, 'drums');
      settings.setMixerLevels.mockClear();
      solo(result, 'drums');

      expect(settings.setMixerLevels).not.toHaveBeenCalled();
    });

    it('does not write to mixerLevels when soloing a second track', () => {
      const { result } = render(['drums', 'guitar', 'bass']);

      solo(result, 'drums');
      settings.setMixerLevels.mockClear();
      solo(result, 'guitar');

      expect(settings.setMixerLevels).not.toHaveBeenCalled();
    });

    it('does not write to mixerLevels when un-soloing one of multiple soloed tracks', () => {
      const { result } = render(['drums', 'guitar', 'bass']);

      solo(result, 'drums');
      solo(result, 'guitar');
      settings.setMixerLevels.mockClear();
      solo(result, 'drums');

      expect(settings.setMixerLevels).not.toHaveBeenCalled();
    });
  });
});
