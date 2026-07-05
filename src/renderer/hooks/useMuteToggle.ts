import { useRef } from 'react';

interface MuteToggle {
  isMuted: boolean;
  toggleMute: () => void;
  handleChange: (value: number) => void;
}

export function useMuteToggle(
  volume: number,
  onChange: (value: number) => void,
  defaultUnmuteVolume: number,
): MuteToggle {
  const lastAudibleVolume = useRef(defaultUnmuteVolume);
  const isMuted = volume === 0;
  const toggleMute = () => {
    if (isMuted) {
      onChange(lastAudibleVolume.current);
    } else {
      lastAudibleVolume.current = volume;
      onChange(0);
    }
  };
  const handleChange = (value: number) => {
    if (value > 0) {
      lastAudibleVolume.current = value;
    }

    onChange(value);
  };

  return { isMuted, toggleMute, handleChange };
}
