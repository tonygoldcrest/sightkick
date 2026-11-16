import { Button } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faHeart,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '../../cn';
import { SortKey, SortState } from './types';
import {
  defaultDirectionForKey,
  DIRECTIONAL_KEYS,
  SORT_OPTIONS,
} from './constants';

interface Props {
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  focusedIndex?: number;
}

export function SortMenu({ sort, onSortChange, focusedIndex }: Props) {
  const handleClick = (key: SortKey) => {
    if (key === 'favorite') {
      onSortChange({
        key: sort.key === 'favorite' ? null : 'favorite',
        direction: 'asc',
      });

      return;
    }

    if (sort.key === key) {
      onSortChange({
        key,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ key, direction: defaultDirectionForKey(key) });
    }
  };
  const dirIcon = (key: SortKey) => {
    if (!DIRECTIONAL_KEYS.includes(key)) {
      return null;
    }

    const direction =
      sort.key === key ? sort.direction : defaultDirectionForKey(key);

    return direction === 'asc' ? faArrowUp : faArrowDown;
  };

  return (
    <>
      {SORT_OPTIONS.map(({ key, label }, index) => {
        const icon = key === 'favorite' ? faHeart : dirIcon(key)!;

        return (
          <Button
            key={key}
            data-testid={`sort-option-${key}`}
            type={sort.key === key ? 'primary' : 'default'}
            onClick={() => handleClick(key)}
            className={cn('w-full justify-start', {
              'outline-2 outline-accent': index === focusedIndex,
            })}
          >
            <div className="flex justify-between w-full items-center">
              <div>{label}</div>
              <div>
                <FontAwesomeIcon icon={icon} />
              </div>
            </div>
          </Button>
        );
      })}
    </>
  );
}
