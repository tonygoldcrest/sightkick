import { ComponentProps } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type {
  IconDefinition,
  SizeProp,
} from '@fortawesome/fontawesome-svg-core';
import { cn } from '../../cn';
import { IconButtonSize, IconButtonType } from './types';

interface Props extends Omit<ComponentProps<'button'>, 'type'> {
  icon: IconDefinition;
  type?: IconButtonType;
  size?: IconButtonSize;
}

const TYPE_CLASSES: Record<IconButtonType, string> = {
  default: 'text-text-dim',
  primary: 'text-accent',
  danger: 'text-red',
};
const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};
const ICON_SIZE: Record<IconButtonSize, SizeProp> = {
  sm: 'xs',
  md: 'lg',
  lg: 'xl',
};

export function IconButton({
  icon,
  type = 'default',
  size = 'md',
  className,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center shrink-0 rounded-md bg-transparent p-0 border-0 cursor-pointer transition hover:brightness-150 disabled:opacity-40 disabled:cursor-default',
        SIZE_CLASSES[size],
        TYPE_CLASSES[type],
        className,
      )}
    >
      <FontAwesomeIcon icon={icon} size={ICON_SIZE[size]} />
    </button>
  );
}
