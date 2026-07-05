import { useCallback, useEffect, useRef, useState } from 'react';
import { useInput } from '../../context/InputContext';
import { InputElement } from '../../../types';
import { controlSource, InputDevice, inputBus } from '../../input';

export function useInputConfig(isOpen: boolean) {
  const {
    setSelectedDevice,
    selectedDevice,
    inputMapping,
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

    const suppressDefault = (event: KeyboardEvent) => {
      event.preventDefault();
    };

    window.addEventListener('keydown', suppressDefault);

    return () => {
      window.removeEventListener('keydown', suppressDefault);
    };
  }, [listeningTo]);

  return {
    devices,
    selectedDeviceId: selectedDevice?.id,
    selectedDeviceName: selectedDevice?.name,
    onSelectDevice: (id: string | undefined) => {
      setSelectedDevice(devices.find((device) => device.id === id) ?? null);
    },
    mapping: inputMapping,
    listeningTo,
    onLearn: (element: InputElement) => setListeningTo(element),
    onStopLearn: () => setListeningTo(undefined),
    onRemoveControl: removeControl,
    onRefreshDevices: refreshDevices,
  };
}
