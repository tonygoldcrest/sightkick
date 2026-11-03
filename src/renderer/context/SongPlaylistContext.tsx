import { createContext, ReactNode, useContext } from 'react';

const SongPlaylistContext = createContext<readonly string[]>([]);

export function SongPlaylistProvider({
  ids,
  children,
}: {
  ids: readonly string[];
  children: ReactNode;
}) {
  return (
    <SongPlaylistContext.Provider value={ids}>
      {children}
    </SongPlaylistContext.Provider>
  );
}

export function useSongPlaylist(): readonly string[] {
  return useContext(SongPlaylistContext);
}
