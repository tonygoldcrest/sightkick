import { Song } from '../../../types';
import appIcon from '../../../../assets/icon.png';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { IconButton } from '../IconButton';

type Props = {
  songData: Song;
  progress: number;
  onCancel: () => void;
};

export function SongSplitProgress({
  songData: { albumCover, name },
  progress,
  onCancel,
}: Props) {
  return (
    <div className="border-2 rounded-md border-border-soft flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-2 pb-1">
        <img
          src={albumCover ?? appIcon}
          onError={(e) => {
            e.currentTarget.src = appIcon;
          }}
          className="h-7 w-auto object-contain aspect-square rounded-xs shadow-frame"
        />

        <div className="text-[13px] font-bold text-text-muted font-ui">
          {name}
        </div>

        <IconButton icon={faXmark} onClick={onCancel} />
      </div>

      <div
        className="h-0.75"
        style={{
          background: 'var(--gradient-slider-fill)',
          width: `${progress}%`,
        }}
      ></div>
    </div>
  );
}
