import { Button, Modal, Select, Tabs } from 'antd';
import { ElementMapping, InputElement } from '../../../types';
import { controlLabel, InputDevice } from '../../input';
import { modalStyles, MODAL_ABOVE_POPOVER_Z_INDEX } from '../../overlayStyles';
import { IconButton } from '../IconButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { MappingElement } from '../../types';
import { GROUPED_CONTROL_ELEMENTS, KIT_ELEMENTS } from '../../constants';
import { Tooltip } from '../Tooltip';

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
      styles={{
        ...modalStyles,
        container: {
          ...modalStyles.container,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 32px)',
        },
        body: {
          ...modalStyles.body,
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      zIndex={MODAL_ABOVE_POPOVER_Z_INDEX}
    >
      <div className="flex flex-col gap-6 min-h-0 flex-1">
        <div className="flex flex-col gap-1 shrink-0">
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

        <div className="flex flex-col min-h-0 flex-1">
          <Tabs
            size="small"
            defaultActiveKey="kit"
            centered
            className="flex flex-col min-h-0 flex-1 [&_.ant-tabs-content-holder]:min-h-0 [&_.ant-tabs-content-holder]:overflow-y-auto [&_.ant-tabs-content]:h-full"
            items={[
              {
                key: 'kit',
                label: 'Kit',
                children: (
                  <div className="flex flex-col gap-2">
                    <div className="text-text-muted text-xs italic text-center">
                      If a pad sends different signals for different spots, add
                      each one so every hit counts.
                    </div>
                    {[...KIT_ELEMENTS.values()].map(renderElement)}
                  </div>
                ),
              },
              {
                key: 'control',
                label: 'App Navigation',
                children: (
                  <div className="flex flex-col gap-2">
                    {Object.entries(GROUPED_CONTROL_ELEMENTS).map(
                      ([group, elements]) => {
                        return (
                          <>
                            <div className="capitalize text-text-muted">
                              {group}
                            </div>
                            <div className="flex flex-col gap-2">
                              {elements.map(renderElement)}
                            </div>
                          </>
                        );
                      },
                    )}
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
