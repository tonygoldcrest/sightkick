import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { PlayheadStyle, PLAYHEAD_STYLES } from '../types';
import { usePersisted } from '../hooks/usePersisted';

interface SongViewSettingsValue {
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
  zoom: number;
  setZoom: (z: number) => void;
}

const SongViewSettingsContext = createContext<SongViewSettingsValue | null>(
  null,
);

export function SongViewSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [playheadStyle, setPlayheadStyle] = usePersisted<PlayheadStyle>(
    'settings.playheadStyle',
    PLAYHEAD_STYLES[0],
  );
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
  const [zoom, setZoom] = usePersisted<number>('settings.zoom', 1);

  useEffect(() => {
    if (!PLAYHEAD_STYLES.includes(playheadStyle)) {
      setPlayheadStyle(PLAYHEAD_STYLES[0]);
    }
  }, [playheadStyle, setPlayheadStyle]);

  const value = useMemo(
    () => ({
      playheadStyle,
      setPlayheadStyle,
      enableColors,
      setEnableColors,
      showBarNumbers,
      setShowBarNumbers,
      showTempo,
      setShowTempo,
      showReference,
      setShowReference,
      countIn,
      setCountIn,
      zoom,
      setZoom,
    }),
    [
      playheadStyle,
      setPlayheadStyle,
      enableColors,
      setEnableColors,
      showBarNumbers,
      setShowBarNumbers,
      showTempo,
      setShowTempo,
      showReference,
      setShowReference,
      countIn,
      setCountIn,
      zoom,
      setZoom,
    ],
  );

  return (
    <SongViewSettingsContext.Provider value={value}>
      {children}
    </SongViewSettingsContext.Provider>
  );
}

export function useSongViewSettings(): SongViewSettingsValue {
  const ctx = useContext(SongViewSettingsContext);

  if (!ctx) {
    throw new Error(
      'useSongViewSettings must be used within SongViewSettingsProvider',
    );
  }

  return ctx;
}
