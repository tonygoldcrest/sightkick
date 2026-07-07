import { Button, Divider, Progress } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faDrum,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';
import { StemToolsPanel } from '../../context/StemToolsContext';
import { useApp } from '../../context/AppContext';
import { Tooltip } from '../Tooltip';
import { SupportButton } from '../SupportButton/SupportButton';

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
  const { currentPath } = useApp();
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
        title="Hook up your e-kit (or keyboard if you fancy) so we can score your hits"
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

      <StemToolsPanel />

      <SupportButton />
    </>
  );
}
