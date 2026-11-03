import { ReactNode, memo, useEffect, useState } from 'react';
import { Button, Popover } from 'antd';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { popoverOpenChange, popoverStyles } from '../../overlayStyles';
import { InputConfig, useInputConfig } from '../InputConfig';
import { SongListSettings } from './SongListSettings';
import { SongViewSettings } from './SongViewSettings';
import { GameMode } from '../../types';

interface Props {
  volumeSliders?: ReactNode[];
  clickControls?: ReactNode;
  masterVolumeControl?: ReactNode;
  page: 'song-list' | 'song-view';
  gameMode?: GameMode;
  scanPercent?: number;
  onExportPdf?: () => void;
  isExporting?: boolean;
}

export const SettingsButton = memo(function Settings({
  volumeSliders,
  clickControls,
  masterVolumeControl,
  page,
  scanPercent,
  gameMode,
  onExportPdf,
  isExporting,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputConfigOpen, setInputConfigOpen] = useState(false);
  const inputConfig = useInputConfig(inputConfigOpen);
  const currentInputName = inputConfig.selectedDeviceName;
  const { pathname } = useLocation();

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
        classNames={{ root: 'settings-popover' }}
        styles={{
          ...popoverStyles,
          container: {
            ...popoverStyles.container,
            maxHeight: 'min(32rem, calc(100vh - 5rem))',
            overflow: 'auto',
          },
        }}
        content={
          <div className="@container flex w-[min(22.5rem,calc(100vw-1.5rem))] max-w-full min-w-0 flex-col gap-3 max-[900px]:w-full">
            {page === 'song-list' ? (
              <SongListSettings
                scanPercent={scanPercent}
                onSetupInput={openInput}
                currentInputName={currentInputName}
              />
            ) : (
              <SongViewSettings
                onExportPdf={onExportPdf}
                isExporting={isExporting}
                gameMode={gameMode}
                masterVolumeControl={masterVolumeControl}
                volumeSliders={volumeSliders}
                clickControls={clickControls}
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
