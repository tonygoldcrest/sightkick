import { useCallback, useEffect, useRef, useState } from 'react';

const PREVIEW_PROTOCOL = 'sightkick:';
const DURATION_WAIT_MS = 8000;
const MIDDLE_TOLERANCE_SECONDS = 0.3;

type PreviewClip = {
  audio: HTMLAudioElement;
  release: () => void;
};

function middleTime(audio: HTMLAudioElement): number | null {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    return null;
  }

  return audio.duration / 2;
}

function whenMiddleKnown(audio: HTMLAudioElement): Promise<void> {
  if (middleTime(audio) !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      cleanup();
      resolve();
    };
    const onUpdate = () => {
      if (middleTime(audio) !== null) {
        finish();
      }
    };
    const timer = setTimeout(finish, DURATION_WAIT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener('durationchange', onUpdate);
      audio.removeEventListener('loadedmetadata', onUpdate);
    };

    audio.addEventListener('durationchange', onUpdate);
    audio.addEventListener('loadedmetadata', onUpdate);
  });
}

// A local file served without a Range response ignores currentTime and
// `play()` then starts at 0. Keep placing the playhead until it sticks.
function holdMiddle(audio: HTMLAudioElement, isCurrent: () => boolean) {
  let attempts = 0;
  const place = () => {
    if (!isCurrent() || attempts >= 4) {
      return;
    }

    const target = middleTime(audio);

    if (
      target === null ||
      Math.abs(audio.currentTime - target) <= MIDDLE_TOLERANCE_SECONDS
    ) {
      return;
    }

    attempts += 1;

    try {
      audio.currentTime = target;
    } catch {
      // The file cannot be seeked yet. A later duration or playing event retries.
    }
  };

  audio.addEventListener('durationchange', place);
  audio.addEventListener('loadedmetadata', place);
  audio.addEventListener('playing', place);

  return place;
}

async function openClip(src: string): Promise<PreviewClip> {
  // Blob URLs are fully seekable. The custom file protocol is not, unless the
  // response honors Range, so a direct Audio(src) preview stays at the start.
  if (src.startsWith(PREVIEW_PROTOCOL)) {
    try {
      const response = await fetch(src);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.preload = 'auto';

        return {
          audio,
          release: () => URL.revokeObjectURL(url),
        };
      }
    } catch {
      // Fall through and stream the original URL.
    }
  }

  const audio = new Audio(src);

  audio.preload = 'auto';

  return { audio, release: () => undefined };
}

function stopClips(clips: PreviewClip[]) {
  for (const clip of clips) {
    clip.audio.pause();
    clip.audio.removeAttribute('src');
    clip.audio.load();
    clip.release();
  }
}

export function useSongPreview() {
  const clipsRef = useRef<PreviewClip[]>([]);
  const idRef = useRef<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const stop = useCallback(() => {
    stopClips(clipsRef.current);
    clipsRef.current = [];
    idRef.current = null;
    setPreviewingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const togglePreview = useCallback((id: string, sources: string[]) => {
    if (sources.length === 0) {
      return;
    }

    if (idRef.current === id && clipsRef.current.length > 0) {
      const playing = clipsRef.current.some((clip) => !clip.audio.paused);

      if (playing) {
        for (const clip of clipsRef.current) {
          clip.audio.pause();
        }

        setPreviewingId(null);

        return;
      }

      for (const clip of clipsRef.current) {
        void clip.audio.play().catch(() => undefined);
      }

      setPreviewingId(id);

      return;
    }

    stopClips(clipsRef.current);
    clipsRef.current = [];
    idRef.current = id;

    void (async () => {
      const clips = await Promise.all(sources.map((src) => openClip(src)));

      if (idRef.current !== id) {
        stopClips(clips);

        return;
      }

      clipsRef.current = clips;

      const placers = clips.map((clip) =>
        holdMiddle(clip.audio, () => idRef.current === id),
      );

      await Promise.all(clips.map((clip) => whenMiddleKnown(clip.audio)));

      if (idRef.current !== id) {
        return;
      }

      for (const place of placers) {
        place();
      }

      const started = await Promise.all(
        clips.map((clip) =>
          clip.audio
            .play()
            .then(() => true)
            .catch(() => false),
        ),
      );

      if (idRef.current !== id) {
        return;
      }

      for (const place of placers) {
        place();
      }

      setPreviewingId(started.some(Boolean) ? id : null);
    })();
  }, []);

  return { previewingId, togglePreview, stopPreview: stop };
}
