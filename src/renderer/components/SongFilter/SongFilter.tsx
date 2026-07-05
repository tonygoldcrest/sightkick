import { Button, Divider, Input } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faGlobe, faSearch } from '@fortawesome/free-solid-svg-icons';
import { cn } from '../../cn';
import { Tooltip } from '../Tooltip';
import { MappingHint } from '../MappingHint';
import { ALL_DIFFICULTIES } from '../../../constants';
import { Difficulty } from 'scan-chart';

export type Mode = 'local' | 'online';

export interface SongFilterProps {
  onChangeFilter: (value: string) => void;
  nameFilter: string;
  className?: string;
  filteredSongsCount: number;
  mode: Mode;
  onChangeMode: (value: Mode) => void;
  showHints?: boolean;
  difficulty: Difficulty;
  setDifficulty: (newDifficulty: Difficulty) => void;
}

export function SongFilter({
  onChangeFilter: onChange,
  onChangeMode,
  mode = 'local',
  nameFilter,
  className,
  difficulty,
  setDifficulty,
  filteredSongsCount,
  showHints,
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
          onChange(event.target.value);
        }}
        suffix={
          <div className="flex gap-1 items-center">
            <div className="text-text-faint text-[13.5px]">
              {filteredSongsCount} results
            </div>

            <Divider vertical />

            <Tooltip title="Charts come in Easy to Expert versions - easier ones have fewer notes to play. Songs without the version you pick won't show up.">
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
                <MappingHint
                  key={option.value}
                  element={
                    showHints && mode !== option.value ? 'ride' : undefined
                  }
                >
                  <Tooltip title={option.tooltipText} placement="bottomLeft">
                    <Button
                      className="grow"
                      type={mode === option.value ? 'primary' : 'default'}
                      icon={option.icon}
                      data-testid={`mode-${option.value}`}
                      onClick={() => onChangeMode(option.value)}
                    ></Button>
                  </Tooltip>
                </MappingHint>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
