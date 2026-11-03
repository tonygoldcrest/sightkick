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
            className="mt-auto mobile:h-11 mobile:w-11"
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
          'grid min-w-0 grow grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-5 rounded-[11px] border border-border-soft bg-surface p-2 no-underline transition-all duration-100 ease-in-out cursor-default mobile:grid-cols-[3.75rem_minmax(0,1fr)_auto] mobile:gap-x-2 mobile:gap-y-1',
          {
            'hover:bg-accent-soft-bg hover:border-accent-soft-border cursor-pointer':
              Boolean(local),
            'bg-accent-soft-bg border-accent-soft-border outline-2 outline-accent':
              focused,
          },
        )}
      >
        <img
          src={albumCover ?? appIcon}
          onError={(e) => {
            e.currentTarget.src = appIcon;
          }}
          className="aspect-square h-15 w-auto shrink-0 rounded-lg object-contain shadow-frame mobile:row-span-2"
        />

        <div className="min-w-0">
          <div className="mb-1 truncate font-display text-[18px] font-bold text-text-body mobile:mb-0 mobile:text-base">
            {name}
          </div>
          <div className="truncate font-ui text-sm text-text-muted">
            {artist}
          </div>
        </div>

        {(charter || local) && (
          <div className="flex min-w-0 items-center justify-end gap-5 mobile:col-start-2 mobile:row-start-2 mobile:w-full mobile:gap-3">
            {charter && (
              <div className="flex max-w-36 shrink flex-col items-end mobile:mr-auto mobile:min-w-0 mobile:max-w-none mobile:flex-1 mobile:flex-row mobile:items-baseline mobile:gap-1">
                <div className="text-xs text-text-dim">charter</div>
                <div className="mt-1 max-w-full truncate text-sm text-text-muted mobile:mt-0">
                  {charter.replace(/<\S+?>/g, '')}
                </div>
              </div>
            )}

            {local && (
              <div className="flex shrink-0 flex-col items-center gap-1 mobile:flex-row mobile:gap-2">
                <div className="text-xs text-text-dim">{difficulty}</div>

                <Stars
                  rating={score ? score.starRating : 0}
                  perfect={Boolean(score && score.accuracy === 1)}
                  size="xs"
                  className="gap-1"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-5 mobile:col-start-3 mobile:row-span-2 mobile:row-start-1 mobile:gap-2">
          <DifficultyRing value={drumDifficulty} />

          {indicator}
        </div>
      </div>
    </div>
  );
}
