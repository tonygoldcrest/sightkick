import { useState } from 'react';
import { Spin } from 'antd';
import { Outlet, useNavigate, useOutlet } from 'react-router-dom';
import { SongFilter } from '../components/SongFilter';
import { SongList } from '../components/SongList';
import { SettingsButton } from '../components/SettingsButton';
import {
  SortButton,
  SORT_OPTIONS,
  DIRECTIONAL_KEYS,
} from '../components/SortButton';
import { SplittingQueue } from '../components/SplittingQueue';
import { EmptySongState } from '../components/EmptySongState';
import { useApp } from '../context/AppContext';
import { useInput } from '../context/InputContext';
import { StemToolsProvider } from '../context/StemToolsContext';
import { useStemTools } from '../hooks/useStemTools';
import { useSongList } from '../hooks/useSongList';
import { useDownload } from '../hooks/useDownload';
import { useSongFilter } from '../hooks/useSongFilter';
import { useInputControls } from '../hooks/useInputControls';
import { ALL_DIFFICULTIES } from '../../constants';
import { useGameModeSelector } from '../hooks/useGameModeSelector';

export function SongListView() {
  const { currentPath, difficulty, setDifficulty } = useApp();
  const { controlMapping } = useInput();
  const navigate = useNavigate();
  const songOpen = useOutlet() !== null;
  const stemTools = useStemTools();
  const {
    songList,
    splittingIds,
    splitProgress,
    scanProgress,
    handleSplit,
    handleLikeChange,
    addSong,
  } = useSongList();
  const scanPercent =
    scanProgress && scanProgress.total > 0
      ? Math.round((scanProgress.current / scanProgress.total) * 100)
      : undefined;
  const {
    nameFilter,
    setNameFilter,
    libraryMode,
    setLibraryMode,
    sort,
    setSort,
    filteredSongList,
    onlineResults,
    onlineTotal,
    onlineLoading,
    loadMore,
  } = useSongFilter(songList, difficulty);
  const { downloadingIds, handleDownload } = useDownload(
    onlineResults,
    addSong,
  );
  const [focusedSongIndex, setFocusedSongIndex] = useState<number | undefined>(
    undefined,
  );
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [focusedSortIndex, setFocusedSortIndex] = useState(0);
  const sortAvailable = libraryMode !== 'online';
  const [prevNameFilter, setPrevNameFilter] = useState(nameFilter);
  const [prevLibraryMode, setPrevLibraryMode] = useState(libraryMode);
  const [prevSort, setPrevSort] = useState(sort);
  const [prevSortAvailable, setPrevSortAvailable] = useState(sortAvailable);
  const gameModeSelector = useGameModeSelector();

  if (
    nameFilter !== prevNameFilter ||
    libraryMode !== prevLibraryMode ||
    sort !== prevSort
  ) {
    setPrevNameFilter(nameFilter);
    setPrevLibraryMode(libraryMode);
    setPrevSort(sort);
    setFocusedSongIndex(undefined);
  }

  if (sortAvailable !== prevSortAvailable) {
    setPrevSortAvailable(sortAvailable);

    if (!sortAvailable) {
      setIsSortOpen(false);
    }
  }

  const applyFocusedSort = (index: number) => {
    const { key } = SORT_OPTIONS[index];

    if (key === 'favorite') {
      setSort({ key: 'favorite', direction: 'asc' });

      return;
    }

    setSort({
      key,
      direction: sort.key === key ? sort.direction : 'asc',
    });
  };
  const moveSortFocus = (delta: number) => {
    const next =
      (focusedSortIndex + delta + SORT_OPTIONS.length) % SORT_OPTIONS.length;

    setFocusedSortIndex(next);
    applyFocusedSort(next);
  };
  const toggleFocusedSortDirection = () => {
    const { key } = SORT_OPTIONS[focusedSortIndex];

    if (!DIRECTIONAL_KEYS.includes(key)) {
      return;
    }

    setSort({
      key,
      direction: sort.direction === 'asc' ? 'desc' : 'asc',
    });
  };
  const openSort = () => {
    if (!sortAvailable) {
      return;
    }

    const currentIndex = SORT_OPTIONS.findIndex(
      (option) => option.key === sort.key,
    );

    setFocusedSortIndex(currentIndex === -1 ? 0 : currentIndex);
    setIsSortOpen(true);
  };
  const play = async (id: string) => {
    if (gameModeSelector.isOpen) {
      return;
    }

    const gameMode = await gameModeSelector.open();

    if (gameMode) {
      navigate(`/${id}?gameMode=${gameMode}`);
    }
  };

  useInputControls(
    controlMapping,
    isSortOpen
      ? {
          up: () => moveSortFocus(-1),
          down: () => moveSortFocus(1),
          confirm: toggleFocusedSortDirection,
          back: () => setIsSortOpen(false),
        }
      : {
          up: () =>
            setFocusedSongIndex((index) => {
              if (filteredSongList.length === 0) {
                return 0;
              }

              if (index === undefined) {
                return filteredSongList.length - 1;
              }

              return (
                (index - 1 + filteredSongList.length) % filteredSongList.length
              );
            }),
          down: () =>
            setFocusedSongIndex((index) => {
              if (filteredSongList.length === 0) {
                return 0;
              }

              if (index === undefined) {
                return 0;
              }

              return (index + 1) % filteredSongList.length;
            }),
          confirm: () => {
            if (focusedSongIndex === undefined) {
              return;
            }

            const song = filteredSongList[focusedSongIndex];

            if (!song) {
              return;
            }

            if (libraryMode === 'local') {
              play(song.id);
            } else if (
              libraryMode === 'online' &&
              !songList.find(({ id }) => song.id === id)
            ) {
              handleDownload(song.id);
            }
          },
          sort: openSort,
          library: () =>
            setLibraryMode(libraryMode === 'online' ? 'local' : 'online'),
          difficulty: () => {
            const difficultyIndex = ALL_DIFFICULTIES.indexOf(difficulty);

            setDifficulty(
              ALL_DIFFICULTIES[(difficultyIndex + 1) % ALL_DIFFICULTIES.length],
            );
          },
        },
    !songOpen && !gameModeSelector.isOpen,
  );

  return (
    <StemToolsProvider value={stemTools}>
      {gameModeSelector.element}

      <div className="h-screen flex flex-col bg-bg">
        <div
          className="border-b border-divider p-4 z-10 flex flex-col gap-4"
          style={{ background: 'var(--gradient-header)' }}
        >
          <div className="flex gap-2 items-center">
            <SongFilter
              nameFilter={nameFilter}
              onChangeFilter={setNameFilter}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              filteredSongsCount={
                libraryMode === 'online' && onlineTotal !== undefined
                  ? onlineTotal
                  : filteredSongList.length
              }
              libraryMode={libraryMode}
              onChangeLibraryMode={setLibraryMode}
            />
            <SortButton
              sort={sort}
              disabled={!sortAvailable}
              onSortChange={setSort}
              isOpen={isSortOpen}
              onOpenChange={setIsSortOpen}
              focusedIndex={isSortOpen ? focusedSortIndex : undefined}
            />
            <SettingsButton page="song-list" scanPercent={scanPercent} />
          </div>
          <SplittingQueue
            splittingIds={splittingIds}
            splitProgress={splitProgress}
            songList={songList}
          />
        </div>

        <div className="relative grow overflow-hidden w-full flex">
          <div className="relative w-full max-w-250 grow overflow-hidden mx-auto bg-bg flex flex-col">
            {filteredSongList.length > 0 ||
            (libraryMode === 'online' && onlineLoading) ? (
              <SongList
                songList={filteredSongList}
                scrollKey={nameFilter}
                downloadingIds={downloadingIds}
                downloadingDisabled={currentPath === null}
                libraryMode={libraryMode}
                difficulty={difficulty}
                onClickSong={(id) => {
                  if (libraryMode === 'local') {
                    play(id);
                  }
                }}
                downloadedIds={
                  libraryMode === 'online'
                    ? new Set(songList.map((s) => s.id))
                    : undefined
                }
                splittingIds={splittingIds}
                onSplit={handleSplit}
                onDownload={handleDownload}
                onLikeChange={handleLikeChange}
                onLoadMore={libraryMode === 'online' ? loadMore : undefined}
                focusedIndex={!isSortOpen ? focusedSongIndex : undefined}
              />
            ) : (
              <EmptySongState
                libraryMode={libraryMode}
                hasFolder={currentPath !== null}
                hasSongs={songList.length > 0}
              />
            )}
          </div>

          {libraryMode === 'online' && onlineLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-10">
              <Spin size="large" />
            </div>
          )}
        </div>

        <div className="fixed inset-0 pointer-events-none z-100">
          <Outlet />
        </div>
      </div>
    </StemToolsProvider>
  );
}
