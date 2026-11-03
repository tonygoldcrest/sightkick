import { Divider } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '../../cn';
import { KIT_ELEMENTS } from '../../constants';
import { elementIcon } from '../../helpers';
import { faCircle, faGreaterThan } from '@fortawesome/free-solid-svg-icons';
import themedark from '../../theme';

interface ReferenceProps {
  className?: string;
}

export function Reference({ className }: ReferenceProps) {
  return (
    <div
      className={cn(
        'flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center rounded-xl border border-ink/13 bg-paper-light px-2 py-1 text-ink shadow-paper-strong narrow:px-1 narrow:text-xs mobile:w-[calc(100vw-1.5rem)] mobile:max-w-lg mobile:flex-wrap mobile:justify-center mobile:gap-y-1 mobile:px-2 mobile:py-2 mobile:text-sm!',
        className,
      )}
    >
      {[...KIT_ELEMENTS.values()].map((element, index) => {
        return (
          <div
            key={element.value}
            className="flex items-center mobile:w-1/4 mobile:shrink-0 mobile:justify-center"
          >
            {index > 0 && (
              <Divider vertical className="bg-ink/13 mobile:hidden" />
            )}
            <div className="flex items-center gap-2 text-nowrap px-2 py-0.5 narrow:gap-1 narrow:px-1.5">
              <FontAwesomeIcon
                icon={elementIcon(element.type)}
                color={element.color}
                size="lg"
              />
              <div className="font-ui font-semibold">{element.displayName}</div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center mobile:w-1/2 mobile:shrink-0 mobile:justify-center">
        <Divider vertical className="bg-ink/13 mobile:hidden" />
        <div className="flex items-center gap-2 text-nowrap px-2 py-0.5 narrow:gap-1 narrow:px-1.5">
          <FontAwesomeIcon
            icon={faGreaterThan}
            color={themedark.color.ink}
            size="lg"
          />
          <div className="font-ui font-semibold">Hit hard</div>
        </div>
      </div>

      <div className="flex items-center mobile:w-1/2 mobile:shrink-0 mobile:justify-center">
        <Divider vertical className="bg-ink/13 mobile:hidden" />
        <div className="flex items-center gap-2 text-nowrap px-2 py-0.5 narrow:gap-1 narrow:px-1.5">
          <div className="font-display flex items-center">
            <div className="text-xl mt-0.75">(</div>
            <FontAwesomeIcon icon={faCircle} color={themedark.color.ink} />
            <div className="text-xl mt-0.75">)</div>
          </div>
          <div className="font-ui font-semibold">Hit softly</div>
        </div>
      </div>
    </div>
  );
}
