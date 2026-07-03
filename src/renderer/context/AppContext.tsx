import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { uniq } from 'es-toolkit';
import { Difficulty } from 'scan-chart';
import { InputElement, InputMapping } from '../../types';
import {
  controlLabel,
  controlSource,
  inputBus,
  InputDevice,
  isTypingTarget,
} from '../input';
import { PlayheadStyle, PLAYHEAD_STYLES } from '../types';
import { usePersisted } from '../hooks/usePersisted';

interface AppContextValue {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  playheadStyle: PlayheadStyle;
  setPlayheadStyle: (s: PlayheadStyle) => void;
  enableColors: boolean;
  setEnableColors: (v: boolean) => void;
  showBarNumbers: boolean;
  setShowBarNumbers: (v: boolean) => void;
  showTempo: boolean;
  setShowTempo: (v: boolean) => void;
  showReference: boolean;
  setShowReference: (v: boolean) => void;
  countIn: boolean;
  setCountIn: (v: boolean) => void;
  currentPath: string | null;
  setCurrentPath: (p: string | null) => void;
  selectedDevice: InputDevice | null;
  setSelectedDevice: (d: InputDevice | null) => void;
  inputMapping: InputMapping;
  assignControl: (element: InputElement, controlId: string) => void;
  removeControl: (element: InputElement, controlId: string) => void;
  zoom: number;
  setZoom: (z: number) => void;
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
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [difficulty, setDifficulty] = usePersisted<Difficulty>(
    'settings.difficulty',
    'expert',
  );
  const [playheadStyle, setPlayheadStyle] = usePersisted<PlayheadStyle>(
    'settings.playheadStyle',
    PLAYHEAD_STYLES[0],
  );

  useEffect(() => {
    if (!PLAYHEAD_STYLES.includes(playheadStyle)) {
      setPlayheadStyle(PLAYHEAD_STYLES[0]);
    }
  }, [playheadStyle, setPlayheadStyle]);

  const [enableColors, setEnableColors] = usePersisted(
    'settings.enableColors',
    true,
  );
  const [showBarNumbers, setShowBarNumbers] = usePersisted(
    'settings.showBarNumbers',
    false,
  );
  const [showTempo, setShowTempo] = usePersisted('settings.showTempo', false);
  const [showReference, setShowReference] = usePersisted(
    'settings.showReference',
    true,
  );
  const [countIn, setCountIn] = usePersisted('settings.countIn', true);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = usePersisted<InputDevice | null>(
    'settings.selectedDevice',
    null,
  );
  const [inputMappings, setInputMappings] = usePersisted<
    Record<string, InputMapping>
  >('settings.inputMappings', {});
  const [zoom, setZoom] = usePersisted<number>('settings.zoom', 1);
  const inputMapping: InputMapping = {
    ...EMPTY_INPUT_MAPPING,
    ...(selectedDevice ? inputMappings[selectedDevice.id] : undefined),
  };
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

  return (
    <AppContext.Provider
      value={{
        difficulty,
        setDifficulty,
        playheadStyle,
        setPlayheadStyle,
        enableColors,
        setEnableColors,
        showBarNumbers,
        setShowBarNumbers,
        showTempo,
        setShowTempo,
        countIn,
        setCountIn,
        currentPath,
        setCurrentPath,
        selectedDevice,
        setSelectedDevice,
        inputMapping,
        assignControl,
        removeControl,
        showReference,
        setShowReference,
        zoom,
        setZoom,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }

  return ctx;
}
