import { createContext, ReactNode, useEffect, useMemo } from 'react';

type NoteColorsValue = Record<string, never>;

const NoteColorsContext = createContext<NoteColorsValue | null>(null);

export function NoteColorsProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({}), []);

  useEffect(() => {
    document.body.style.setProperty('--color-red', '#c62828');
    document.body.style.setProperty('--color-orange', '#E8641A');
    document.body.style.setProperty('--color-yellow', '#C8930F');
    document.body.style.setProperty('--color-blue', '#1b6fc0');
    document.body.style.setProperty('--color-green', '#1f8a4c');
    document.body.style.setProperty('--color-red-dark', '#8b1c1c');
    document.body.style.setProperty('--color-orange-dark', '#9E430E');
    document.body.style.setProperty('--color-yellow-dark', '#8b660a');
    document.body.style.setProperty('--color-green-dark', '#166234');
    document.body.style.setProperty('--color-blue-dark', '#134d87');
  }, []);

  return (
    <NoteColorsContext.Provider value={value}>
      {children}
    </NoteColorsContext.Provider>
  );
}
