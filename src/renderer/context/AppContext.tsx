import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Difficulty } from 'scan-chart';
import { usePersisted } from '../hooks/usePersisted';

interface AppContextValue {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  currentPath: string | null;
  setCurrentPath: (p: string | null) => void;
  supportDismissed: boolean;
  setSupportDismissed: (d: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [difficulty, setDifficulty] = usePersisted<Difficulty>(
    'settings.difficulty',
    'expert',
  );
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [supportDismissed, setSupportDismissed] = usePersisted(
    'settings.supportDismissed',
    false,
  );
  const value = useMemo(
    () => ({
      difficulty,
      setDifficulty,
      currentPath,
      setCurrentPath,
      supportDismissed,
      setSupportDismissed,
    }),
    [
      difficulty,
      setDifficulty,
      currentPath,
      setCurrentPath,
      supportDismissed,
      setSupportDismissed,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }

  return ctx;
}
