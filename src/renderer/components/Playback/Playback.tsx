import { Progress, Slider } from 'antd';
import { formatTime } from '../../util';
import { TimeStore } from '../../services/time-store';
import { useThrottledCurrentTime } from '../../hooks/useCurrentTime';

export interface PlaybackProps {
  timeStore: TimeStore;
  duration: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  allowScrubbing: boolean;
}

export function Playback({
  timeStore,
  duration,
  onChange,
  disabled,
  allowScrubbing,
}: PlaybackProps) {
  const currentTime = useThrottledCurrentTime(timeStore);

  return (
    <div className="flex items-center grow gap-5">
      <div className="text-xs text-text-muted">{formatTime(currentTime)}</div>
      {allowScrubbing ? (
        <Slider
          className="grow"
          defaultValue={0}
          disabled={disabled}
          tooltip={{ open: false }}
          value={(currentTime / duration) * 100}
          onChange={onChange}
        />
      ) : (
        <Progress percent={(currentTime / duration) * 100} showInfo={false} />
      )}
      <div className="text-xs text-text-muted">{formatTime(duration)}</div>
    </div>
  );
}
