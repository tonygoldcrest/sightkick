import { Song } from '../../../types';
import { SongSplitProgress } from '../SongSplitProgress';

interface Props {
  splittingIds: Set<string>;
  splitProgress: Map<string, number>;
  songList: Song[];
}

export function SplittingQueue({
  splittingIds,
  splitProgress,
  songList,
}: Props) {
  if (splittingIds.size === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-text-muted">Processing queue</div>
      <div className="flex gap-3 flex-wrap items-center">
        {[...splittingIds].map((id) => {
          const songData = songList.find((s) => s.id === id);

          if (!songData) {
            return null;
          }

          return (
            <SongSplitProgress
              key={id}
              songData={songData}
              progress={splitProgress.get(id) ?? 0}
              onCancel={() =>
                window.electron.ipcRenderer.sendMessage('cancel-split', id)
              }
            />
          );
        })}
      </div>
    </div>
  );
}
