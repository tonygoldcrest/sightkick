import { useState } from 'react';
import { Popover } from 'antd';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { useStemToolsContext } from '../../context/StemToolsContext';
import { popoverOpenChange, popoverStyles } from '../../overlayStyles';
import { IconButton } from '../IconButton';
import { SongMenuContent } from './SongMenuContent';

interface Props {
  dir: string;
  canSplit: boolean;
  splitting: boolean;
  onSplit: () => void;
  onDelete: () => void;
}

export function SongMenu({
  dir,
  canSplit,
  splitting,
  onSplit,
  onDelete,
}: Props) {
  const { stemToolsStatus } = useStemToolsContext();
  const [isOpen, setIsOpen] = useState(false);
  const showSplit = stemToolsStatus === 'ready' && canSplit;
  const close = () => setIsOpen(false);

  return (
    <Popover
      open={isOpen}
      onOpenChange={popoverOpenChange(setIsOpen)}
      trigger="click"
      placement="bottomRight"
      styles={{
        ...popoverStyles,
        container: { ...popoverStyles.container, padding: 0 },
      }}
      content={
        <div onClick={(event) => event.stopPropagation()}>
          <SongMenuContent
            showSplit={showSplit}
            splitting={splitting}
            onOpenDirectory={() => {
              window.electron.ipcRenderer.sendMessage(
                'open-song-directory',
                dir,
              );
              close();
            }}
            onSplit={() => {
              onSplit();
              close();
            }}
            onDelete={() => {
              onDelete();
              close();
            }}
          />
        </div>
      }
    >
      <IconButton
        data-testid="song-menu-trigger"
        className="mt-auto"
        icon={faEllipsisVertical}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
    </Popover>
  );
}
