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
        'bg-paper-light px-2 py-1 rounded-xl border border-ink/13 text-ink shadow-paper-strong flex items-center',
        className,
      )}
    >
      {[...KIT_ELEMENTS.values()].map((element, index) => {
        return (
          <div key={element.value} className="flex items-center">
            {index > 0 && <Divider vertical className="bg-ink/13" />}
            <div className="px-2 py-0.2 flex items-center gap-2 text-nowrap">
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
        <Divider vertical className="bg-ink/13" />
        <div className="px-2 py-0.2 flex items-center gap-2 text-nowrap">
          <FontAwesomeIcon
            icon={faGreaterThan}
            color={themedark.color.ink}
            size="lg"
          />
          <div className="font-ui font-semibold">Hit hard</div>
        </div>
      </div>

      <div className="flex items-center">
        <Divider vertical className="bg-ink/13" />
        <div className="px-2 py-0.2 flex items-center gap-2 text-nowrap">
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
