import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Slider } from 'antd';
import { Tooltip } from '../Tooltip';
import themedark from '../../theme';
import { DEFAULT_UNMUTE_VOLUME } from './constants';
import { AudioVolume } from '../AudioVolume';
import { useMuteToggle } from '../../hooks/useMuteToggle';

export interface ClickControlsProps {
  volume: number;
  onVolumeChange: (value: number) => void;
  tone: number;
  onToneChange: (value: number) => void;
}

export function ClickControls({
  volume,
  onVolumeChange,
  tone,
  onToneChange,
}: ClickControlsProps) {
  const { isMuted, toggleMute, handleChange } = useMuteToggle(
    volume,
    onVolumeChange,
    DEFAULT_UNMUTE_VOLUME,
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className="grow h-px"
          style={{ background: 'var(--gradient-faint-fade-reverse)' }}
        />
        <div className="flex items-center gap-2">
          <div className="text-text-faint uppercase font-semibold text-[13px]">
            Click Track
          </div>

          <Tooltip title="A metronome click on every beat" placement="bottom">
            <FontAwesomeIcon
              icon={faInfoCircle}
              color={themedark.color.textFaint}
            />
          </Tooltip>
        </div>
        <div
          className="grow h-px"
          style={{ background: 'var(--gradient-faint-fade)' }}
        />
      </div>
      <div className="grid grid-cols-[max-content_1fr_max-content_max-content] items-center gap-x-2 gap-y-1">
        <AudioVolume
          name="Volume"
          volume={volume}
          onChange={handleChange}
          isMuted={isMuted}
          canSolo={false}
          onMuteClick={toggleMute}
        />

        <div className="text-xs text-text">Tone</div>
        <Slider value={tone} onChange={onToneChange} className="col-span-3" />
      </div>
    </>
  );
}
