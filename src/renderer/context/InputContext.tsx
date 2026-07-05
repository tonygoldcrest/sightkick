import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { uniq } from 'es-toolkit';
import { InputElement, InputMapping } from '../../types';
import {
  controlLabel,
  controlSource,
  inputBus,
  InputDevice,
  isTypingTarget,
} from '../input';
import { usePersisted } from '../hooks/usePersisted';

interface InputContextValue {
  selectedDevice: InputDevice | null;
  setSelectedDevice: (d: InputDevice | null) => void;
  inputMapping: InputMapping;
  assignControl: (element: InputElement, controlId: string) => void;
  removeControl: (element: InputElement, controlId: string) => void;
}

const EMPTY_INPUT_MAPPING: InputMapping = {
  hihat: [],
  ride: [],
  crash: [],
  kick: [],
  snare: [],
  tom1: [],
  tom2: [],
  tom3: [],
  pause: [],
};
const KIT_ELEMENTS = Object.keys(EMPTY_INPUT_MAPPING) as InputElement[];
const InputContext = createContext<InputContextValue | null>(null);

export function InputProvider({ children }: { children: ReactNode }) {
  const [selectedDevice, setSelectedDevice] = usePersisted<InputDevice | null>(
    'settings.selectedDevice',
    null,
  );
  const [inputMappings, setInputMappings] = usePersisted<
    Record<string, InputMapping>
  >('settings.inputMappings', {});
  const inputMapping = useMemo(
    () => ({
      ...EMPTY_INPUT_MAPPING,
      ...(selectedDevice ? inputMappings[selectedDevice.id] : undefined),
    }),
    [selectedDevice, inputMappings],
  );
  const updateMapping = useCallback(
    (update: (current: InputMapping) => InputMapping) => {
      if (!selectedDevice) {
        return;
      }

      setInputMappings((prev) => ({
        ...prev,
        [selectedDevice.id]: update({
          ...EMPTY_INPUT_MAPPING,
          ...prev[selectedDevice.id],
        }),
      }));
    },
    [selectedDevice, setInputMappings],
  );
  const assignControl = useCallback(
    (element: InputElement, controlId: string) => {
      updateMapping(
        (current) =>
          Object.fromEntries(
            KIT_ELEMENTS.map((key) => [
              key,
              key === element
                ? uniq([...(current[key] ?? []), controlId])
                : (current[key] ?? []).filter((c) => c !== controlId),
            ]),
          ) as InputMapping,
      );
    },
    [updateMapping],
  );
  const removeControl = useCallback(
    (element: InputElement, controlId: string) => {
      updateMapping((current) => ({
        ...current,
        [element]: (current[element] ?? []).filter((c) => c !== controlId),
      }));
    },
    [updateMapping],
  );

  useEffect(() => {
    inputBus.start();
  }, []);

  useEffect(() => {
    inputBus.listDevices().then((list) => {
      setSelectedDevice((prev: InputDevice | null) =>
        prev && list.some((d) => d.id === prev.id) ? prev : null,
      );
    });
  }, [setSelectedDevice]);

  useEffect(() => {
    if (selectedDevice?.sourceId !== 'midi') {
      return undefined;
    }

    window.electron.ipcRenderer.sendMessage('listen-midi', selectedDevice.port);

    return () => {
      window.electron.ipcRenderer.sendMessage('stop-listen-midi');
    };
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedDevice?.sourceId !== 'keyboard') {
      return undefined;
    }

    const mapping = inputMappings[selectedDevice.id] ?? {};
    const boundCodes = new Set(
      Object.values(mapping)
        .flat()
        .filter((controlId) => controlSource(controlId) === 'keyboard')
        .map((controlId) => controlLabel(controlId)),
    );

    if (boundCodes.size === 0) {
      return undefined;
    }

    const suppressDefault = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (boundCodes.has(event.code)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', suppressDefault);

    return () => {
      window.removeEventListener('keydown', suppressDefault);
    };
  }, [selectedDevice, inputMappings]);

  const value = useMemo(
    () => ({
      selectedDevice,
      setSelectedDevice,
      inputMapping,
      assignControl,
      removeControl,
    }),
    [
      selectedDevice,
      setSelectedDevice,
      inputMapping,
      assignControl,
      removeControl,
    ],
  );

  return (
    <InputContext.Provider value={value}>{children}</InputContext.Provider>
  );
}

export function useInput(): InputContextValue {
  const ctx = useContext(InputContext);

  if (!ctx) {
    throw new Error('useInput must be used within InputProvider');
  }

  return ctx;
}
