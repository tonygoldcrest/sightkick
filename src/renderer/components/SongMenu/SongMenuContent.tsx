import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolder,
  faHandScissors,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { Divider } from 'antd';

interface Props {
  showSplit: boolean;
  splitting: boolean;
  onOpenDirectory: () => void;
  onSplit: () => void;
  onDelete: () => void;
}

const menuButtonClass =
  'flex items-center gap-3 px-4 py-2 text-text-muted hover:text-text cursor-pointer bg-transparent border-0 whitespace-nowrap w-full text-left';

export function SongMenuContent({
  showSplit,
  splitting,
  onOpenDirectory,
  onSplit,
  onDelete,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <button className={menuButtonClass} onClick={onOpenDirectory}>
        <FontAwesomeIcon icon={faFolder} className="w-4" />
        Open song directory
      </button>

      {showSplit && (
        <>
          <Divider />

          <button
            className={`${menuButtonClass} disabled:opacity-40 disabled:cursor-default`}
            disabled={splitting}
            onClick={onSplit}
          >
            <FontAwesomeIcon icon={faHandScissors} className="w-4" />
            {splitting ? 'Splitting…' : 'Split stems'}
          </button>
        </>
      )}

      <Divider />

      {confirmingDelete ? (
        <div className="flex flex-col gap-2 px-4 py-2">
          <p className="m-0 max-w-56 text-sm text-text-muted">
            Remove this song from your library? The files will be deleted.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent px-0 py-1 text-(--color-red)"
              onClick={onDelete}
            >
              Remove
            </button>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent px-0 py-1 text-text-muted"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="delete-song"
          className={`${menuButtonClass} text-(--color-red) hover:text-(--color-red)`}
          onClick={() => setConfirmingDelete(true)}
        >
          <FontAwesomeIcon icon={faTrash} className="w-4" />
          Remove from library
        </button>
      )}
    </>
  );
}
