import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart as faHeartSolid,
  faDownload,
  faSpinner,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import appIcon from '../../../../assets/icon.png';
import { Song } from '../../../types';
import { cn } from '../../cn';
import { Button, Tooltip } from 'antd';
import { useMemo } from 'react';
import { SongMenu } from '../SongMenu';
import { Stars } from '../Stars';
import { IconButton } from '../IconButton';
import { Difficulty } from 'scan-chart';
import { calculateAccuracy, getStarRating } from '../../scoring';
import { DifficultyRing } from './DifficultyRing';
import { OnlineSong } from '../../types';

export interface SongListItemProps {
  songData: Song | OnlineSong;
  onLikeChange: (id: string, liked: boolean) => void;
  onDownload: (id: string) => void;
  onClick: () => void;
  onSplit: (id: string) => void;
  downloading?: boolean;
  difficulty: Difficulty;
  splitting: boolean;
  downloaded?: boolean;
  downloadingDisabled: boolean;
  focused?: boolean;
}

export function SongListItem({
  songData,
  onLikeChange,
  onDownload,
  onClick,
  downloading,
  downloaded,
  difficulty,
  splitting,
  onSplit,
  downloadingDisabled,
  focused,
}: SongListItemProps) {
  const local = 'source' in songData ? undefined : songData;
  const { albumCover, id, name, artist, charter, drumDifficulty } = songData;
  const score = useMemo(() => {
    const result = local?.scoreData?.[difficulty];

    return result
      ? {
          starRating: getStarRating(result),
          accuracy: calculateAccuracy(result),
        }
      : null;
  }, [local, difficulty]);
  const indicator = useMemo(() => {
    if (local) {
      return (
        <div className="flex flex-col gap-2 items-center h-full">
          <SongMenu
            dir={local.dir}
            canSplit={(local.audio?.length ?? 0) === 1}
            splitting={splitting}
            onSplit={() => onSplit(id)}
          />

          <IconButton
            data-testid="like-toggle"
            type={local.liked ? 'primary' : 'default'}
            className="mt-auto"
            icon={local.liked ? faHeartSolid : faHeart}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLikeChange(id, !local.liked);
            }}
          />
        </div>
      );
    }

    if (!downloading && !downloaded) {
      const button = (
        <Button
          icon={<FontAwesomeIcon icon={faDownload} />}
          disabled={downloadingDisabled}
          data-testid="download-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDownload(id);
          }}
        />
      );

      return downloadingDisabled ? (
        <Tooltip
          title="To enable download, select library folder"
          placement="left"
        >
          {button}
        </Tooltip>
      ) : (
        button
      );
    }

    return (
      <FontAwesomeIcon
        className={cn(downloading ? 'text-text-dim' : 'text-accent', 'px-1.5')}
        size="xl"
        icon={downloading ? faSpinner : faCheck}
        spin={downloading}
        data-testid={
          downloading ? 'downloading-indicator' : 'downloaded-indicator'
        }
      />
    );
  }, [
    downloading,
    downloaded,
    onDownload,
    id,
    local,
    onLikeChange,
    downloadingDisabled,
    onSplit,
    splitting,
  ]);

  return (
    <div className="relative inline-flex w-full">
      <div
        onClick={onClick}
        data-testid={`song-item-${id}`}
        data-focused={focused ? 'true' : undefined}
        className={cn(
          'flex border border-border-soft grow no-underline bg-surface rounded-[11px] transition-all duration-100 ease-in-out cursor-default p-2',
          {
            'hover:bg-accent-soft-bg hover:border-accent-soft-border cursor-pointer':
              Boolean(local),
            'bg-accent-soft-bg border-accent-soft-border outline-2 outline-accent':
              focused,
          },
        )}
      >
        <div className="flex items-center">
          <img
            src={albumCover ?? appIcon}
            onError={(e) => {
              e.currentTarget.src = appIcon;
            }}
            className="h-15 w-auto object-contain aspect-square rounded-lg shadow-frame"
          />

          <div className="ml-2">
            <div className="text-[18px] font-bold mb-1 text-text-body font-display">
              {name}
            </div>
            <div className="text-text-muted font-ui text-sm">{artist}</div>
          </div>
        </div>

        <div className="flex ml-auto items-center gap-5">
          {charter && (
            <div className="flex items-end flex-col">
              <div className="text-text-dim text-xs">charter</div>
              <div className="text-text-muted text-sm mt-1">
                {charter.replace(/<\S+?>/g, '')}
              </div>
            </div>
          )}

          {local && (
            <div className="flex flex-col gap-1 items-center">
              <div className="text-xs text-text-dim">{difficulty}</div>

              <Stars
                rating={score ? score.starRating : 0}
                perfect={Boolean(score && score.accuracy === 1)}
                size="xs"
                className="gap-1"
              />
            </div>
          )}

          <DifficultyRing value={drumDifficulty} />

          {indicator}
        </div>
      </div>
    </div>
  );
}
