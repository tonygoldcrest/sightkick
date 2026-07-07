import { Button, Divider, Popconfirm } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMugHot } from '@fortawesome/free-solid-svg-icons';
import { useApp } from '../../context/AppContext';
import { popoverStyles } from '../../overlayStyles';

const KOFI_URL = 'https://ko-fi.com/tonygoldcrest';

export function SupportButton() {
  const { supportDismissed, setSupportDismissed } = useApp();

  if (supportDismissed) {
    return undefined;
  }

  return (
    <>
      <Divider />
      <div className="flex flex-col items-center gap-1">
        <Button
          className="w-full"
          icon={<FontAwesomeIcon icon={faMugHot} />}
          onClick={() => window.open(KOFI_URL)}
        >
          Support the project
        </Button>
        <Popconfirm
          title="Hide the support button?"
          description="You can still support any time from Ko-fi."
          okText="I already supported"
          cancelText="Cancel"
          okType="default"
          cancelButtonProps={{ type: 'primary' }}
          placement="top"
          icon={null}
          styles={popoverStyles}
          onConfirm={() => setSupportDismissed(true)}
        >
          <button
            type="button"
            className="bg-transparent border-0 p-0 cursor-pointer text-xs text-text-dim underline hover:brightness-150"
          >
            Already supported
          </button>
        </Popconfirm>
      </div>
    </>
  );
}
