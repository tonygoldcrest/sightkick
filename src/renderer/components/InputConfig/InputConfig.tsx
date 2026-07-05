import { Button, Modal, Select, Tabs } from 'antd';
import { ElementMapping, InputElement } from '../../../types';
import { controlLabel, InputDevice } from '../../input';
import { modalStyles, MODAL_ABOVE_POPOVER_Z_INDEX } from '../../overlayStyles';
import { IconButton } from '../IconButton';
import themedark from '../../theme';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowsRotate,
  faArrowUp,
  faBook,
  faCheck,
  faChevronLeft,
  faDumbbell,
  faInfoCircle,
  faPause,
  faPlus,
  faSort,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { MappingElement } from '../../types';
import { KIT_ELEMENTS } from '../../constants';
import { Tooltip } from '../Tooltip';

const CONTROL_ELEMENTS: MappingElement[] = [
  {
    value: 'up',
    displayName: 'Up',
    color: themedark.color.textMuted,
    icon: faArrowUp,
    type: 'control',
  },
  {
    value: 'down',
    displayName: 'Down',
    color: themedark.color.textMuted,
    icon: faArrowDown,
    type: 'control',
  },
  {
    value: 'left',
    displayName: 'Left',
    color: themedark.color.textMuted,
    icon: faArrowLeft,
    type: 'control',
  },
  {
    value: 'right',
    displayName: 'Right',
    color: themedark.color.textMuted,
    icon: faArrowRight,
    type: 'control',
  },
  {
    value: 'confirm',
    displayName: 'Confirm',
    color: themedark.color.textMuted,
    icon: faCheck,
    type: 'control',
  },
  {
    value: 'back',
    displayName: 'Back',
    color: themedark.color.textMuted,
    icon: faChevronLeft,
    type: 'control',
  },
  {
    value: 'difficulty',
    displayName: 'Difficulty',
    color: themedark.color.textMuted,
    icon: faDumbbell,
    type: 'control',
  },
  {
    value: 'library',
    displayName: 'Library',
    color: themedark.color.textMuted,
    icon: faBook,
    type: 'control',
  },
  {
    value: 'sort',
    displayName: 'Sort',
    color: themedark.color.textMuted,
    icon: faSort,
    type: 'control',
  },
  {
    value: 'pause',
    displayName: 'Pause',
    color: themedark.color.textMuted,
    icon: faPause,
    type: 'control',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  devices: InputDevice[];
  selectedDeviceId: string | undefined;
  onSelectDevice: (id: string | undefined) => void;
  mapping: ElementMapping;
  listeningTo: InputElement | undefined;
  onLearn: (element: InputElement) => void;
  onStopLearn: () => void;
  onRemoveControl: (element: InputElement, control: string) => void;
  onRefreshDevices: () => void;
}

export function InputConfig({
  isOpen,
  onClose,
  devices,
  selectedDeviceId,
  onSelectDevice,
  mapping,
  listeningTo,
  onLearn,
  onStopLearn,
  onRemoveControl,
  onRefreshDevices,
}: Props) {
  const renderElement = (element: MappingElement) => (
    <div
      key={element.value}
      className="bg-surface text-text-body border border-border p-2 rounded-md flex flex-col"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 w-40 shrink-0 overflow-hidden">
          <FontAwesomeIcon
            style={{
              color: element.color,
            }}
            icon={element.icon}
            size="lg"
            className="w-5"
          />

          <div className="flex items-center">
            <div className="font-semibold text-nowrap">
              {element.displayName}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {mapping[element.value]?.map((control) => (
            <div
              className="font-semibold text-xs bg-surface-raised p-1 border-border-soft border rounded-md flex items-center gap-1"
              key={control}
            >
              {controlLabel(control)}
              <IconButton
                type="primary"
                size="sm"
                icon={faXmark}
                className="focus-visible:outline-accent-hover focus-visible:outline-1"
                onClick={() => onRemoveControl(element.value, control)}
              />
            </div>
          ))}
        </div>
        {element.value === listeningTo ? (
          <Button
            className="ml-auto animate-pulse"
            type="primary"
            onClick={onStopLearn}
          >
            Listening
          </Button>
        ) : (
          <Button
            icon={<FontAwesomeIcon icon={faPlus} />}
            className="ml-auto"
            type="default"
            onClick={() => onLearn(element.value)}
          >
            Learn
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title={<div className="font-semibold text-xl">Configure input</div>}
      footer={
        <Button type="primary" onClick={onClose}>
          Done
        </Button>
      }
      width={640}
      destroyOnHidden
      centered
      styles={modalStyles}
      zIndex={MODAL_ABOVE_POPOVER_Z_INDEX}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="text-text-faint text-[12px] font-semibold uppercase">
            Input Device
          </div>
          <div className="flex items-center gap-2">
            <Select
              className="grow"
              value={selectedDeviceId}
              onChange={(value) => onSelectDevice(value)}
              options={[
                { value: undefined, label: '- None -' },
                ...devices.map(({ id, name }) => ({ value: id, label: name })),
              ]}
            />
            <Tooltip title="Refresh device list" placement="top">
              <Button
                icon={<FontAwesomeIcon icon={faArrowsRotate} />}
                type="default"
                onClick={onRefreshDevices}
                aria-label="Refresh device list"
              />
            </Tooltip>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div
              className="grow h-px"
              style={{ background: 'var(--gradient-faint-fade-reverse)' }}
            />
            <div className="flex items-center gap-2">
              <div className="text-text-faint uppercase font-semibold text-[13px]">
                Mappings
              </div>

              <Tooltip
                title="
                    If a drum/cymbal sends a different signal depending on where you hit it, add
                    each one so every hit counts.
                "
                placement="bottom"
              >
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  color={themedark.color.textFaint}
                />
              </Tooltip>
            </div>
            <div
              className="grow h-px"
              style={{ background: 'var(--gradient-faint-fade)' }}
            />
          </div>

          <Tabs
            size="small"
            defaultActiveKey="kit"
            centered
            items={[
              {
                key: 'kit',
                label: 'Kit',
                children: (
                  <div className="flex flex-col gap-2">
                    {[...KIT_ELEMENTS.values()].map(renderElement)}
                  </div>
                ),
              },
              {
                key: 'control',
                label: 'App Navigation',
                children: (
                  <div className="flex flex-col gap-2">
                    {CONTROL_ELEMENTS.map(renderElement)}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}
