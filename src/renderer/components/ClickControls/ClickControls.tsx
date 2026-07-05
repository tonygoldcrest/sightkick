import { useRef } from 'react';
import { faInfoCircle, faVolumeMute } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Slider } from 'antd';
import { Tooltip } from '../Tooltip';
import themedark from '../../theme';
import { DEFAULT_UNMUTE_VOLUME } from './constants';

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
  const lastAudibleVolume = useRef(DEFAULT_UNMUTE_VOLUME);
  const isMuted = volume === 0;
  const handleMute = () => {
    if (isMuted) {
      onVolumeChange(lastAudibleVolume.current);
    } else {
      lastAudibleVolume.current = volume;
      onVolumeChange(0);
    }
  };

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
      <div className="grid grid-cols-[max-content_1fr_max-content] items-center gap-x-2 gap-y-1">
        <div className="text-xs text-text">Volume</div>
        <Slider
          value={volume}
          onChange={(value) => {
            if (value > 0) {
              lastAudibleVolume.current = value;
            }

            onVolumeChange(value);
          }}
        />

        <Button
          type={isMuted ? 'primary' : 'default'}
          size="small"
          icon={<FontAwesomeIcon size="xs" icon={faVolumeMute} />}
          onClick={handleMute}
        />

        <div className="text-xs text-text">Tone</div>
        <Slider value={tone} onChange={onToneChange} className="col-span-2" />
      </div>
    </>
  );
}
