import { ReactNode, memo, useEffect, useState } from 'react';
import { Button, Popover } from 'antd';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { popoverOpenChange, popoverStyles } from '../../overlayStyles';
import { InputConfig, useInputConfig } from '../InputConfig';
import { SongListSettings } from './SongListSettings';
import { SongViewSettings } from './SongViewSettings';

interface Props {
  volumeSliders?: ReactNode[];
  clickControls?: ReactNode;
  masterVolumeControl?: ReactNode;
  page: 'song-list' | 'song-view';
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
        styles={popoverStyles}
        content={
          <div className="min-w-90 flex flex-col gap-3">
            {page === 'song-list' ? (
              <SongListSettings
                scanPercent={scanPercent}
                onSetupInput={openInput}
                currentInputName={currentInputName}
              />
            ) : (
              <SongViewSettings
                onSetupInput={openInput}
                currentInputName={currentInputName}
                onExportPdf={onExportPdf}
                isExporting={isExporting}
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
