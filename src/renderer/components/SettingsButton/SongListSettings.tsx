import { Button, Divider, Progress, Switch } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faDrum,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { StemToolsPanel } from '../../context/StemToolsContext';
import { useApp } from '../../context/AppContext';
import { Tooltip } from '../Tooltip';
import { SettingLabel } from './SettingLabel';
import { SupportButton } from '../SupportButton/SupportButton';
import { DISCORD_URL } from './constants';

interface Props {
  scanPercent?: number;
  onSetupInput: () => void;
  currentInputName?: string;
}

export function SongListSettings({
  scanPercent,
  onSetupInput,
  currentInputName,
}: Props) {
  const { currentPath, autoPreview, setAutoPreview } = useApp();
  const isScanning = scanPercent !== undefined;
  const selectFolder = () =>
    window.electron.ipcRenderer.sendMessage('rescan-songs');
  const rescan = () =>
    window.electron.ipcRenderer.sendMessage('rescan-songs', false);

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
            onClick={selectFolder}
            disabled={isScanning}
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
              onClick={rescan}
            />
          </Tooltip>
        ) : null}
      </div>
      {isScanning && (
        <div className="flex flex-col gap-1" data-testid="scan-progress">
          <div className="text-sm text-text-muted">Scanning songs</div>
          <Progress percent={scanPercent} />
        </div>
      )}

      <Tooltip
        title="Hook up your e-kit (or keyboard) so we can score your hits"
        placement="bottom"
      >
        <Button
          data-testid="setup-input"
          icon={<FontAwesomeIcon icon={faDrum} />}
          onClick={onSetupInput}
        >
          {currentInputName ?? 'Setup input'}
        </Button>
      </Tooltip>

      <Divider />

      <div className="flex items-center justify-between gap-3">
        <SettingLabel
          label="Preview on select"
          tooltip="Play a song from its middle while it is selected in your library."
        />
        <Switch
          size="small"
          data-testid="setting-auto-preview"
          checked={autoPreview}
          onChange={setAutoPreview}
        />
      </div>

      <Divider />

      <StemToolsPanel />

      <Divider />

      <Tooltip title="Join the community" placement="bottom">
        <Button
          icon={<FontAwesomeIcon icon={faDiscord} />}
          onClick={() => window.open(DISCORD_URL)}
        >
          Discord
        </Button>
      </Tooltip>

      <SupportButton />
    </>
  );
}
