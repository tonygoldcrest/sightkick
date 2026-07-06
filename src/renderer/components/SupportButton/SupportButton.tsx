import { Button, Divider } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMugHot, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '../../context/AppContext';
import { IconButton } from '../IconButton';
import { Tooltip } from '../Tooltip';

const KOFI_URL = 'https://ko-fi.com/tonygoldcrest';

export function SupportButton() {
  const { supportDismissed, setSupportDismissed } = useApp();

  if (supportDismissed) {
    return undefined;
  }

  return (
    <>
      <Divider />
      <div className="flex items-center gap-1">
        <Button
          className="w-full"
          icon={<FontAwesomeIcon icon={faMugHot} />}
          onClick={() => window.open(KOFI_URL)}
        >
          Support the project
        </Button>
        <Tooltip title="Dismiss" placement="left">
          <IconButton
            icon={faXmark}
            onClick={() => setSupportDismissed(true)}
          />
        </Tooltip>
      </div>
    </>
  );
}
