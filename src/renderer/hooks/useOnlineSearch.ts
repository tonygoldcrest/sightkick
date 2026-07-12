import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { uniqBy } from 'es-toolkit';
import { Difficulty } from 'scan-chart';
import { Song } from '../../types';
import { ALL_DIFFICULTIES } from '../../constants';

type PageResult = { songs: Song[]; total: number | undefined };

interface NoteCount {
  instrument: string;
  difficulty: Difficulty;
  count: number;
}

function drumDifficulties(
  notesData: { noteCounts?: NoteCount[] } | undefined,
): Difficulty[] {
  const present = new Set(
    (notesData?.noteCounts ?? [])
      .filter((nc) => nc.instrument === 'drums' && nc.count > 0)
      .map((nc) => nc.difficulty),
  );

  return ALL_DIFFICULTIES.filter((d) => present.has(d));
}

function mapSongs(data: Record<string, unknown>[]): Song[] {
  return uniqBy(
    data.map(
      (chart): Song => ({
        id: String(chart.md5),
        dir: `https://files.enchor.us/${chart.md5}.sng`,
        albumCover: chart.albumArtMd5
          ? `https://files.enchor.us/${chart.albumArtMd5}.jpg`
          : undefined,
        name: String(chart.name ?? ''),
        artist: String(chart.artist ?? ''),
        charter: String(chart.charter ?? ''),
        album: String(chart.album ?? ''),
        year: String(chart.year ?? ''),
        genre: String(chart.genre ?? ''),
        fiveLaneDrums: false,
        proDrums: false,
        delaySeconds: 0,
        drumDifficulty:
          typeof chart.diff_drums === 'number' ? chart.diff_drums : 0,
        format: 'mid',
        audio: [],
        drumDifficulties: drumDifficulties(
          chart.notesData as { noteCounts?: NoteCount[] } | undefined,
        ),
      }),
    ),
    (song) => song.id,
  );
}

async function fetchEnchorePage(
  query: string,
  page: number,
  difficulty: Difficulty,
  signal: AbortSignal,
): Promise<PageResult> {
  const res = await fetch('https://api.enchor.us/search', {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      search: query,
      page,
      instrument: 'drums',
      drumType: 'fourLanePro',
      difficulty,
      source: 'website',
      drumsReviewed: false,
    }),
    method: 'POST',
    signal,
  });
  const json = await res.json();

  return {
    songs: mapSongs(json.data ?? []),
    total: (json.found as number | undefined) ?? undefined,
  };
}

export function useOnlineSearch(
  active: boolean,
  search: string,
  difficulty: Difficulty,
) {
  const { notification } = App.useApp();
  const [results, setResults] = useState<Song[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const searchRef = useRef(search);
  const difficultyRef = useRef(difficulty);
  const resultsRef = useRef<Song[]>([]);
  const cache = useRef<Map<string, PageResult>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const applyResults = useCallback(
    (next: Song[], nextTotal: number | undefined, nextHasMore: boolean) => {
      resultsRef.current = next;
      setResults(next);
      setHasMore(nextHasMore);

      if (nextTotal !== undefined) {
        setTotal(nextTotal);
      }
    },
    [],
  );
  const fetchPage = useCallback(
    async (query: string, page: number, diff: Difficulty, append: boolean) => {
      const cacheKey = `${query}:${diff}:${page}`;

      if (cache.current.has(cacheKey)) {
        const cached = cache.current.get(cacheKey)!;
        const next = append
          ? uniqBy([...resultsRef.current, ...cached.songs], (s) => s.id)
          : cached.songs;

        applyResults(
          next,
          cached.total,
          cached.total !== undefined
            ? next.length < cached.total
            : cached.songs.length > 0,
        );
        setLoading(false);

        return;
      }

      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;

      try {
        const { songs, total: pageTotal } = await fetchEnchorePage(
          query,
          page,
          diff,
          controller.signal,
        );

        cache.current.set(cacheKey, { songs, total: pageTotal });

        const next = append
          ? uniqBy([...resultsRef.current, ...songs], (s) => s.id)
          : songs;

        applyResults(
          next,
          pageTotal,
          pageTotal !== undefined ? next.length < pageTotal : songs.length > 0,
        );
        setLoading(false);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        notification.error({
          title: 'Search failed',
          description:
            'Unable to fetch songs from Encore. Please check your connection.',
          placement: 'bottomRight',
        });
        setLoading(false);
      }
    },
    [notification, applyResults],
  );
  const fetchFirstPages = useCallback(
    async (query: string, diff: Difficulty) => {
      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;

      const getOrFetch = async (page: number): Promise<PageResult> => {
        const cacheKey = `${query}:${diff}:${page}`;
        const cached = cache.current.get(cacheKey);

        if (cached) {
          return cached;
        }

        const r = await fetchEnchorePage(query, page, diff, controller.signal);

        cache.current.set(cacheKey, r);

        return r;
      };

      try {
        const [p1, p2] = await Promise.all([getOrFetch(1), getOrFetch(2)]);

        if (controller.signal.aborted) {
          return;
        }

        const combined = uniqBy([...p1.songs, ...p2.songs], (s) => s.id);
        const pageTotal = p1.total ?? p2.total;

        pageRef.current = 2;
        applyResults(
          combined,
          pageTotal,
          pageTotal !== undefined
            ? combined.length < pageTotal
            : p2.songs.length > 0,
        );
        setLoading(false);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        notification.error({
          title: 'Search failed',
          description:
            'Unable to fetch songs from Encore. Please check your connection.',
          placement: 'bottomRight',
        });
        setLoading(false);
      }
    },
    [notification, applyResults],
  );
  const searchKey = active ? `${search}:${difficulty}` : null;
  const [prevSearchKey, setPrevSearchKey] = useState<string | null>(null);

  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey);

    if (searchKey !== null) {
      setResults([]);
      setTotal(undefined);
      setHasMore(true);
      setLoading(true);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active) {
      return;
    }

    searchRef.current = search;
    difficultyRef.current = difficulty;

    const timer = setTimeout(() => {
      fetchFirstPages(search, difficulty);
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [active, search, difficulty, fetchFirstPages]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) {
      return;
    }

    pageRef.current += 1;
    fetchPage(searchRef.current, pageRef.current, difficultyRef.current, true);
  }, [loading, hasMore, fetchPage]);

  return { results, total, loading, loadMore };
}
