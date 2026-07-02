import { Button, Divider, Progress } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faDrum,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';
import { Difficulty } from 'scan-chart';
import { StemToolsPanel } from '../../context/StemToolsContext';
import { ALL_DIFFICULTIES } from '../../../constants';
import { SettingLabel } from './SettingLabel';
import { Tooltip } from '../Tooltip';

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  currentPath: string | null;
  onSelectFolder: () => void;
  onRescan: () => void;
  scanPercent?: number;
  onSetupInput: () => void;
  currentInputName?: string;
}

export function SongListSettings({
  difficulty,
  onDifficultyChange,
  currentPath,
  onSelectFolder,
  onRescan,
  scanPercent,
  onSetupInput,
  currentInputName,
}: Props) {
  return (
    <>
      <div className="flex gap-2 grow">
        <Tooltip
          title={
            currentPath ?? 'Point this at the folder where your songs will live'
          }
          placement="bottom"
        >
          <Button
            icon={<FontAwesomeIcon icon={faFolder} />}
            onClick={onSelectFolder}
            className="grow"
          >
            {currentPath ? currentPath.split(/[\\/]/).pop() : 'Select folder'}
          </Button>
        </Tooltip>
        {currentPath ? (
          <Tooltip
            title="Picks up any songs you've added since last time"
            placement="bottomLeft"
          >
            <Button
              icon={<FontAwesomeIcon icon={faArrowsRotate} />}
              data-testid="rescan-folder"
              onClick={onRescan}
            />
          </Tooltip>
        ) : null}
      </div>
      {scanPercent !== undefined && (
        <div className="flex flex-col gap-1" data-testid="scan-progress">
          <div className="text-sm text-text-muted">Scanning songs</div>
          <Progress percent={scanPercent} />
        </div>
      )}

      <Tooltip
        title="Hook up your e-kit (or keyboard if you fancy) so we can score your hits"
        placement="bottom"
      >
        <Button icon={<FontAwesomeIcon icon={faDrum} />} onClick={onSetupInput}>
          {currentInputName ?? 'Setup input'}
        </Button>
      </Tooltip>

      <Divider />

      <div className="flex flex-col gap-3">
        <SettingLabel
          label="Difficulty"
          tooltip="Pick how hard you wanna go. Songs that don't have this difficulty just won't show up."
        />
        <div className="flex gap-2">
          {ALL_DIFFICULTIES.map((d) => (
            <Button
              key={d}
              className="grow capitalize"
              type={difficulty === d ? 'primary' : 'default'}
              data-testid={`difficulty-${d}`}
              onClick={() => onDifficultyChange(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      <Divider />

      <StemToolsPanel />
    </>
  );
}
