import { useLayoutEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '../../cn';
import { KIT_ELEMENTS } from '../../constants';
import { elementIcon } from '../../helpers';
import {
  faChevronDown,
  faChevronUp,
  faCircle,
  faGreaterThan,
} from '@fortawesome/free-solid-svg-icons';
import themedark from '../../theme';

interface ReferenceProps {
  className?: string;
  hidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
}

export function Reference({
  className,
  hidden = false,
  onHiddenChange,
}: ReferenceProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;

    if (!bar || hidden) {
      return;
    }

    const fit = () => {
      bar.style.zoom = '1';

      const available = window.innerWidth - 24;
      const needed = bar.scrollWidth;

      bar.style.zoom = needed > available ? String(available / needed) : '1';
    };

    fit();
    window.addEventListener('resize', fit);

    return () => window.removeEventListener('resize', fit);
  }, [hidden]);

  if (hidden) {
    if (!onHiddenChange) {
      return null;
    }

    return (
      <button
        type="button"
        aria-label="Show legend"
        className={cn(
          'bg-paper-light px-3 py-1 rounded-full border border-ink/13 text-ink shadow-paper-strong flex items-center gap-2 font-ui text-sm font-semibold',
          className,
        )}
        onClick={() => onHiddenChange?.(false)}
      >
        <FontAwesomeIcon icon={faChevronUp} />
        Legend
      </button>
    );
  }

  return (
    <div
      ref={barRef}
      className={cn(
        'relative bg-paper-light px-1 py-1 rounded-xl border border-ink/13 text-ink shadow-paper-strong flex items-center',
        className,
      )}
    >
      {onHiddenChange && (
        <button
          type="button"
          aria-label="Minimise legend"
          className="absolute left-1/2 top-0 flex h-5 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/13 bg-paper-light text-ink shadow-paper-strong"
          onClick={() => onHiddenChange(true)}
        >
          <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
        </button>
      )}
      {[...KIT_ELEMENTS.values()].map((element, index) => {
        return (
          <div key={element.value} className="flex items-center">
            {index > 0 && <span className="h-4 w-px shrink-0 bg-ink/20" />}
            <div className="px-1 py-0.5 flex items-center gap-1 text-nowrap">
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
      <div className="flex items-center">
        <span className="h-4 w-px shrink-0 bg-ink/20" />
        <div className="px-1 py-0.5 flex items-center gap-1 text-nowrap">
          <FontAwesomeIcon
            icon={faGreaterThan}
            color={themedark.color.ink}
            size="lg"
          />
          <div className="font-ui font-semibold">Hit hard</div>
        </div>
      </div>

      <div className="flex items-center">
        <span className="h-4 w-px shrink-0 bg-ink/20" />
        <div className="px-1 py-0.5 flex items-center gap-1 text-nowrap">
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
