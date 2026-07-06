import { Button, Divider, Input } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faGlobe, faSearch } from '@fortawesome/free-solid-svg-icons';
import { cn } from '../../cn';
import { Tooltip } from '../Tooltip';
import { ALL_DIFFICULTIES } from '../../../constants';
import { Difficulty } from 'scan-chart';
import { LibraryMode } from '../../types';

export interface SongFilterProps {
  onChangeFilter: (value: string) => void;
  nameFilter: string;
  className?: string;
  filteredSongsCount: number;
  libraryMode: LibraryMode;
  onChangeLibraryMode: (value: LibraryMode) => void;
  difficulty: Difficulty;
  setDifficulty: (newDifficulty: Difficulty) => void;
}

export function SongFilter({
  onChangeFilter,
  onChangeLibraryMode,
  libraryMode = 'local',
  nameFilter,
  className,
  difficulty,
  setDifficulty,
  filteredSongsCount,
}: SongFilterProps) {
  const options = [
    {
      icon: <FontAwesomeIcon icon={faFolder} />,
      value: 'local',
      tooltipText: "Songs you've already got on your machine",
    },
    {
      icon: <FontAwesomeIcon icon={faGlobe} />,
      value: 'online',
      tooltipText: 'Go hunting for new songs to download',
    },
  ] as const;

  return (
    <div className={cn('grow', className)}>
      <Input
        prefix={
          <FontAwesomeIcon icon={faSearch} color="var(--color-text-dim)" />
        }
        placeholder="Enter song name"
        value={nameFilter}
        onChange={(event) => {
          onChangeFilter(event.target.value);
        }}
        suffix={
          <div className="flex gap-1 items-center">
            <div className="text-text-faint text-[13.5px]">
              {filteredSongsCount} results
            </div>

            <Divider vertical />

            <Tooltip
              title={
                <div>
                  <p>
                    Each song comes with several versions of its drum part, from
                    Easy (simplified) to Expert (the real thing).
                  </p>
                  <br />
                  <p>
                    Pick the one you want to play. If a song disappears, it just
                    doesn&apos;t include that version.
                  </p>
                </div>
              }
            >
              <div className="flex gap-2">
                {ALL_DIFFICULTIES.map((d) => (
                  <Button
                    key={d}
                    className="grow capitalize"
                    type={difficulty === d ? 'primary' : 'default'}
                    data-testid={`difficulty-${d}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </Tooltip>

            <Divider vertical />

            <div className="flex gap-2 items-center">
              {options.map((option) => (
                <Tooltip
                  key={option.value}
                  title={option.tooltipText}
                  placement="bottomLeft"
                >
                  <Button
                    className="grow"
                    type={libraryMode === option.value ? 'primary' : 'default'}
                    icon={option.icon}
                    data-testid={`mode-${option.value}`}
                    onClick={() => onChangeLibraryMode(option.value)}
                  ></Button>
                </Tooltip>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
