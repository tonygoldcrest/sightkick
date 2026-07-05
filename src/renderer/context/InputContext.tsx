import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { mapValues, uniq, without } from 'es-toolkit';
import { ControlMapping, InputElement, InputMapping } from '../../types';
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
  controlMapping: ControlMapping;
  assignControl: (element: InputElement, controlId: string) => void;
  removeControl: (element: InputElement, controlId: string) => void;
}

const EMPTY_INPUT_MAPPING: Record<keyof InputMapping, string[]> = {
  hihat: [],
  ride: [],
  crash: [],
  kick: [],
  snare: [],
  tom1: [],
  tom2: [],
  tom3: [],
};
const EMPTY_CONTROL_MAPPING: Record<keyof ControlMapping, string[]> = {
  up: [],
  down: [],
  left: [],
  right: [],
  confirm: [],
  back: [],
  difficulty: [],
  library: [],
  sort: [],
  pause: [],
};
const CONTROL_KEYS = Object.keys(
  EMPTY_CONTROL_MAPPING,
) as (keyof ControlMapping)[];

function isControlElement(
  element: InputElement,
): element is keyof ControlMapping {
  return (CONTROL_KEYS as string[]).includes(element);
}

function assignInto<K extends string>(
  empty: Record<K, string[]>,
  current: Partial<Record<K, string[]>> | undefined,
  element: K,
  controlId: string,
): Record<K, string[]> {
  return mapValues({ ...empty, ...current }, (list, key) =>
    key === element ? uniq([...list, controlId]) : without(list, controlId),
  );
}

const InputContext = createContext<InputContextValue | null>(null);

export function InputProvider({ children }: { children: ReactNode }) {
  const [selectedDevice, setSelectedDevice] = usePersisted<InputDevice | null>(
    'settings.selectedDevice',
    null,
  );
  const [inputMappings, setInputMappings] = usePersisted<
    Record<string, InputMapping>
  >('settings.inputMappings', {});
  const [controlMappings, setControlMappings] = usePersisted<
    Record<string, ControlMapping>
  >('settings.controlMappings', {});
  const inputMapping = useMemo(
    () => ({
      ...EMPTY_INPUT_MAPPING,
      ...(selectedDevice ? inputMappings[selectedDevice.id] : undefined),
    }),
    [selectedDevice, inputMappings],
  );
  const controlMapping = useMemo(
    () => ({
      ...EMPTY_CONTROL_MAPPING,
      ...(selectedDevice ? controlMappings[selectedDevice.id] : undefined),
    }),
    [selectedDevice, controlMappings],
  );
  const assignControl = useCallback(
    (element: InputElement, controlId: string) => {
      if (!selectedDevice) {
        return;
      }

      if (isControlElement(element)) {
        setControlMappings((prev) => ({
          ...prev,
          [selectedDevice.id]: assignInto(
            EMPTY_CONTROL_MAPPING,
            prev[selectedDevice.id],
            element,
            controlId,
          ),
        }));

        return;
      }

      setInputMappings((prev) => ({
        ...prev,
        [selectedDevice.id]: assignInto(
          EMPTY_INPUT_MAPPING,
          prev[selectedDevice.id],
          element,
          controlId,
        ),
      }));
    },
    [selectedDevice, setControlMappings, setInputMappings],
  );
  const removeControl = useCallback(
    (element: InputElement, controlId: string) => {
      if (!selectedDevice) {
        return;
      }

      if (isControlElement(element)) {
        setControlMappings((prev) => ({
          ...prev,
          [selectedDevice.id]: {
            ...prev[selectedDevice.id],
            [element]: without(
              prev[selectedDevice.id]?.[element] ?? [],
              controlId,
            ),
          },
        }));

        return;
      }

      setInputMappings((prev) => ({
        ...prev,
        [selectedDevice.id]: {
          ...prev[selectedDevice.id],
          [element]: without(
            prev[selectedDevice.id]?.[element] ?? [],
            controlId,
          ),
        },
      }));
    },
    [selectedDevice, setControlMappings, setInputMappings],
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

    const boundCodes = new Set(
      [
        ...Object.values(inputMappings[selectedDevice.id] ?? {}),
        ...Object.values(controlMappings[selectedDevice.id] ?? {}),
      ]
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
  }, [selectedDevice, inputMappings, controlMappings]);

  const value = useMemo(
    () => ({
      selectedDevice,
      setSelectedDevice,
      inputMapping,
      controlMapping,
      assignControl,
      removeControl,
    }),
    [
      selectedDevice,
      setSelectedDevice,
      inputMapping,
      controlMapping,
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
