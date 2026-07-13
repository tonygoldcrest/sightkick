import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
import type { SizeProp } from '@fortawesome/fontawesome-svg-core';
import { times } from 'es-toolkit/compat';
import themedark from '../../theme';
import { cn } from '../../cn';

interface Props {
  rating: number;
  perfect?: boolean;
  glow?: boolean;
  size?: SizeProp;
  count?: number;
  className?: string;
}

export function Stars({
  rating,
  perfect = false,
  glow = false,
  size,
  count = 5,
  className,
}: Props) {
  return (
    <div className={cn('flex items-center', className)}>
      {times(count, (num) => {
        const isFilled = num < rating;
        const color = perfect
          ? themedark.color.starPerfect
          : isFilled
          ? themedark.color.star
          : themedark.color.textDim;
        const filter = glow
          ? perfect
            ? themedark.shadow.starPerfect
            : isFilled
            ? themedark.shadow.star
            : ''
          : undefined;

        return (
          <FontAwesomeIcon
            key={num}
            data-filled={isFilled ? 'true' : undefined}
            icon={isFilled ? faStarSolid : faStarRegular}
            size={size}
            style={{ color, filter }}
          />
        );
      })}
    </div>
  );
}
