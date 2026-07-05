import { Button, Popover } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';
import { popoverOpenChange, popoverStyles } from '../../overlayStyles';
import { SortMenu } from './SortMenu';
import { SortState } from './sort';

export * from './sort';

interface Props {
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  focusedIndex?: number;
}

export function SortButton({
  sort,
  onSortChange,
  isOpen,
  onOpenChange,
  focusedIndex,
}: Props) {
  return (
    <Popover
      open={isOpen}
      onOpenChange={popoverOpenChange(onOpenChange)}
      trigger="click"
      placement="bottomRight"
      styles={popoverStyles}
      content={
        <div className="min-w-60 flex flex-col gap-2">
          <SortMenu
            sort={sort}
            onSortChange={onSortChange}
            focusedIndex={focusedIndex}
          />
        </div>
      }
    >
      <Button
        icon={<FontAwesomeIcon icon={faSort} />}
        size="large"
        data-testid="sort-trigger"
      />
    </Popover>
  );
}
