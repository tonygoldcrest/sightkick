import { Button, Modal } from 'antd';
import { useMemo } from 'react';
import { ScoreData, SongData } from '../../../types';
import { Difficulty } from 'scan-chart';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat } from '@fortawesome/free-solid-svg-icons';
import { calculateAccuracy, getStarRating } from '../../views/utils';
import { MODAL_ABOVE_POPOVER_Z_INDEX, modalStyles } from '../../overlayStyles';
import { Stars } from '../Stars';

interface Props {
  isOpen: boolean;
  onRetry: () => void;
  onNextSong: () => void;
  songData: SongData | null;
  difficulty: Difficulty;
  scoreData?: ScoreData;
}

export function ScoreSummary({
  isOpen,
  onRetry,
  onNextSong,
  songData,
  difficulty,
  scoreData,
}: Props) {
  const starRating = useMemo(() => {
    if (!scoreData) {
      return 0;
    }

    return getStarRating(scoreData);
  }, [scoreData]);
  const isPerfect = useMemo(() => {
    if (!scoreData) {
      return false;
    }

    return calculateAccuracy(scoreData) === 1;
  }, [scoreData]);
  const header = (
    <>
      <div className="text-accent-text font-semibold text-xs uppercase">
        Song Complete
      </div>
      <div>
        <div className="text-text-body text-2xl font-bold">
          {songData?.name}
        </div>
        <div className="text-text-faint flex items-center gap-1 text-sm">
          <div>{songData?.artist}</div>
          <div>·</div>
          <div>{difficulty}</div>
        </div>
      </div>
    </>
  );
  const footer = (
    <div className="flex gap-3 w-full">
      <Button
        className="grow"
        onClick={() => onRetry()}
        icon={<FontAwesomeIcon icon={faRepeat} />}
        size="large"
      >
        Retry
      </Button>
      <Button
        className="grow"
        type="primary"
        onClick={() => onNextSong()}
        size="large"
      >
        Next song
      </Button>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      title={header}
      footer={footer}
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      width={560}
      destroyOnHidden
      centered
      styles={modalStyles}
      wrapProps={{ 'data-testid': 'score-modal' }}
      zIndex={MODAL_ABOVE_POPOVER_Z_INDEX}
    >
      <div className="flex flex-col gap-5 items-center">
        <Stars
          rating={starRating}
          perfect={isPerfect}
          glow
          size="3x"
          className="gap-3"
        />
        {isPerfect ? (
          <div className="text-text-muted text-[18px]">Perfect</div>
        ) : (
          <div className="text-text-muted text-[18px]">
            {Math.round((scoreData ? calculateAccuracy(scoreData) : 0) * 100)}%
            accuracy
          </div>
        )}
        <div className="flex flex-col gap-1 items-center">
          <div className="flex items-center text-text-muted text-[18px] gap-2">
            <div className="text-text-body font-bold text-4xl">
              {scoreData?.hitNotes ?? 0}
            </div>
            <div>/</div>
            <div>{scoreData?.totalNotes} notes hit</div>
          </div>
          <div className="flex items-center text-text-dim text-[14px] gap-2">
            {scoreData?.falseHits} false hits
          </div>
        </div>
      </div>
    </Modal>
  );
}
