import { useCallback, useEffect, useRef, useState } from 'react';
import { useInput } from '../../context/InputContext';
import { InputElement } from '../../../types';
import {
  controlSource,
  InputDevice,
  inputBus,
  isTypingTarget,
  makeControlId,
} from '../../input';

export function useInputConfig(isOpen: boolean) {
  const {
    setSelectedDevice,
    selectedDevice,
    inputMapping,
    controlMapping,
    assignControl,
    removeControl,
  } = useInput();
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [listeningTo, setListeningTo] = useState<InputElement>();
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const listeningToRef = useRef(listeningTo);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    if (!isOpen) {
      setListeningTo(undefined);
    }
  }

  useEffect(() => {
    listeningToRef.current = listeningTo;
  }, [listeningTo]);

  const refreshDevices = useCallback(() => {
    inputBus.listDevices().then((list) => {
      setDevices(list);

      if (selectedDevice && !list.some((d) => d.id === selectedDevice.id)) {
        setSelectedDevice(null);
      }
    });
  }, [selectedDevice, setSelectedDevice]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    refreshDevices();
  }, [isOpen, refreshDevices]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    return inputBus.capture(({ controlId }) => {
      const listening = listeningToRef.current;

      if (
        listening &&
        selectedDevice &&
        controlSource(controlId) === selectedDevice.sourceId
      ) {
        assignControl(listening, controlId);
        setListeningTo(undefined);
      }
    });
  }, [assignControl, selectedDevice, isOpen]);

  useEffect(() => {
    if (listeningTo === undefined) {
      return undefined;
    }

    const swallow = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (
        event.type === 'keydown' &&
        !event.repeat &&
        selectedDevice?.sourceId === 'keyboard'
      ) {
        assignControl(listeningTo, makeControlId('keyboard', event.code));
        setListeningTo(undefined);
      }
    };

    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);

    return () => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
    };
  }, [listeningTo, selectedDevice, assignControl]);

  return {
    devices,
    selectedDeviceId: selectedDevice?.id,
    selectedDeviceName: selectedDevice?.name,
    onSelectDevice: (id: string | undefined) => {
      setSelectedDevice(devices.find((device) => device.id === id) ?? null);
    },
    mapping: { ...inputMapping, ...controlMapping },
    listeningTo,
    onLearn: (element: InputElement) => setListeningTo(element),
    onStopLearn: () => setListeningTo(undefined),
    onRemoveControl: removeControl,
    onRefreshDevices: refreshDevices,
  };
}
