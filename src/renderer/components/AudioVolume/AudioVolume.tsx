import { faS, faVolumeMute } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Slider } from 'antd';
import { cn } from '../../cn';

export interface AudioVolumeProps {
  name: string;
  volume: number;
  isMuted: boolean;
  canSolo?: boolean;
  isSoloed?: boolean;
  onChange: (value: number) => void;
  onSoloClick?: () => void;
  onMuteClick: () => void;
}

export function AudioVolume({
  name,
  volume,
  onChange,
  isMuted,
  canSolo = true,
  isSoloed,
  onSoloClick,
  onMuteClick,
}: AudioVolumeProps) {
  return (
    <>
      <div className="capitalize text-xs text-text">{name}</div>
      <Slider
        value={volume}
        onChange={onChange}
        className={cn({ 'col-span-2': !canSolo })}
      />
      <Button
        data-testid={`mute-${name}`}
        aria-pressed={isMuted}
        type={isMuted ? 'primary' : 'default'}
        size="small"
        icon={<FontAwesomeIcon size="xs" icon={faVolumeMute} />}
        onClick={onMuteClick}
      />
      {canSolo && (
        <Button
          data-testid={`solo-${name}`}
          aria-pressed={Boolean(isSoloed)}
          type={isSoloed ? 'primary' : 'default'}
          size="small"
          icon={<FontAwesomeIcon size="xs" icon={faS} />}
          onClick={onSoloClick}
        />
      )}
    </>
  );
}
