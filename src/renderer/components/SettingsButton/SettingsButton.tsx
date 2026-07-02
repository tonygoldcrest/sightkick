import { ReactNode, memo, useEffect, useState } from 'react';
import { Button, Popover } from 'antd';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '../../context/AppContext';
import { popoverOpenChange, popoverStyles } from '../../overlayStyles';
import { InputConfig, useInputConfig } from '../InputConfig';
import { SongListSettings } from './SongListSettings';
import { SongViewSettings } from './SongViewSettings';

interface Props {
  volumeSliders?: ReactNode[];
  page: 'song-list' | 'song-view';
  scanPercent?: number;
  onExportPdf?: () => void;
  isExporting?: boolean;
}

export const SettingsButton = memo(function Settings({
  volumeSliders,
  page,
  scanPercent,
  onExportPdf,
  isExporting,
}: Props) {
  const {
    difficulty,
    setDifficulty,
    playheadStyle,
    setPlayheadStyle,
    enableColors,
    setEnableColors,
    showBarNumbers,
    setShowBarNumbers,
    showTempo,
    setShowTempo,
    countIn,
    setCountIn,
    currentPath,
    showReference,
    setShowReference,
  } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [inputConfigOpen, setInputConfigOpen] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const inputConfig = useInputConfig(inputConfigOpen);
  const currentInputName = inputConfig.selectedDeviceName;
  const { pathname } = useLocation();

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('check-dev');
    window.electron.ipcRenderer.once('check-dev', (dev: boolean) => {
      setIsDev(dev);
    });
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const openInput = () => setInputConfigOpen(true);

  return (
    <>
      <InputConfig
        isOpen={inputConfigOpen}
        onClose={() => setInputConfigOpen(false)}
        {...inputConfig}
      />

      <Popover
        open={isOpen}
        onOpenChange={popoverOpenChange(setIsOpen)}
        trigger="click"
        placement="bottomRight"
        styles={popoverStyles}
        content={
          <div className="min-w-90 flex flex-col gap-3">
            {page === 'song-list' ? (
              <SongListSettings
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
                currentPath={currentPath}
                onSelectFolder={() =>
                  window.electron.ipcRenderer.sendMessage('rescan-songs')
                }
                onRescan={() =>
                  window.electron.ipcRenderer.sendMessage('rescan-songs', false)
                }
                scanPercent={scanPercent}
                onSetupInput={openInput}
                currentInputName={currentInputName}
              />
            ) : (
              <SongViewSettings
                playheadStyle={playheadStyle}
                onPlayheadStyleChange={setPlayheadStyle}
                enableColors={enableColors}
                onEnableColorsChange={setEnableColors}
                showBarNumbers={showBarNumbers}
                onShowBarNumbersChange={setShowBarNumbers}
                showTempo={showTempo}
                onShowTempoChange={setShowTempo}
                countIn={countIn}
                onCountInChange={setCountIn}
                isDev={isDev}
                onSetupInput={openInput}
                onExportPdf={onExportPdf}
                isExporting={isExporting}
                volumeSliders={volumeSliders}
                currentInputName={currentInputName}
                showReference={showReference}
                onShowReferenceChange={setShowReference}
              />
            )}
          </div>
        }
      >
        <Button
          icon={<FontAwesomeIcon icon={faCog} />}
          size="large"
          data-testid="settings-trigger"
        />
      </Popover>
    </>
  );
});
