import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { App } from 'antd';
import { mapValues, uniq, without } from 'es-toolkit';
import {
  ControlMapping,
  InputElement,
  InputMapping,
  IpcErrorResponse,
} from '../../types';
import {
  controlLabel,
  controlSource,
  inputBus,
  InputDevice,
  isTypingTarget,
} from '../input';
import { usePersisted } from '../hooks/usePersisted';
import { CATEGORY_CONFLICTS, CONTROL_CATEGORIES } from '../constants';

interface InputContextValue {
  selectedDevice: InputDevice | null;
  setSelectedDevice: (d: InputDevice | null) => void;
  inputMapping: InputMapping;
  controlMapping: ControlMapping;
  kitControlIds: Set<string>;
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
  faster: [],
  slower: [],
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

function assignControlInto(
  current: Partial<Record<keyof ControlMapping, string[]>> | undefined,
  element: keyof ControlMapping,
  controlId: string,
): Record<keyof ControlMapping, string[]> {
  const conflicting = CATEGORY_CONFLICTS[CONTROL_CATEGORIES.get(element)!];

  return mapValues({ ...EMPTY_CONTROL_MAPPING, ...current }, (list, key) => {
    if (key === element) {
      return uniq([...list, controlId]);
    }

    return conflicting.includes(CONTROL_CATEGORIES.get(key)!)
      ? without(list, controlId)
      : list;
  });
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
  const { notification } = App.useApp();
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
  const kitControlIds = useMemo(
    () => new Set(Object.values(inputMapping).flat()),
    [inputMapping],
  );
  const assignControl = useCallback(
    (element: InputElement, controlId: string) => {
      if (!selectedDevice) {
        return;
      }

      if (isControlElement(element)) {
        setControlMappings((prev) => ({
          ...prev,
          [selectedDevice.id]: assignControlInto(
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

    return () => inputBus.stop();
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

    const unsubscribe = window.electron.ipcRenderer.on<IpcErrorResponse>(
      'midi-error',
      () => {
        notification.error({
          title: "Couldn't connect to your MIDI device",
          description: `"${selectedDevice.name}" isn't responding. Reconnect it, close any other app using it, or pick another device in settings.`,
          placement: 'bottomRight',
        });
      },
    );

    window.electron.ipcRenderer.sendMessage('listen-midi', selectedDevice.port);

    return () => {
      unsubscribe();
      window.electron.ipcRenderer.sendMessage('stop-listen-midi');
    };
  }, [selectedDevice, notification]);

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
      kitControlIds,
      assignControl,
      removeControl,
    }),
    [
      selectedDevice,
      setSelectedDevice,
      inputMapping,
      controlMapping,
      kitControlIds,
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
