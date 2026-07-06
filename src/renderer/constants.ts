import themedark from './theme';
import { ControlMapping, InputElement } from '../types';
import { ControlCategory, MappingElement } from './types';
import { groupBy } from 'es-toolkit';
import {
  faAnglesRight,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faBook,
  faCheck,
  faChevronLeft,
  faCircle,
  faDumbbell,
  faPause,
  faSnowflake,
  faSort,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

const KIT_ELEMENT_LIST: MappingElement[] = [
  {
    value: 'hihat',
    displayName: 'Hi-Hat',
    color: themedark.color.yellow,
    icon: faXmark,
    type: 'cymbal',
  },
  {
    value: 'ride',
    displayName: 'Ride',
    color: themedark.color.blue,
    icon: faXmark,
    type: 'cymbal',
  },
  {
    value: 'crash',
    displayName: 'Crash',
    color: themedark.color.green,
    icon: faXmark,
    type: 'cymbal',
  },
  {
    value: 'snare',
    displayName: 'Snare',
    color: themedark.color.red,
    icon: faCircle,
    type: 'drum',
  },
  {
    value: 'tom1',
    displayName: 'Tom 1',
    icon: faCircle,
    color: themedark.color.yellow,
    type: 'drum',
  },
  {
    value: 'tom2',
    displayName: 'Tom 2',
    icon: faCircle,
    color: themedark.color.blue,
    type: 'drum',
  },
  {
    value: 'tom3',
    displayName: 'Tom 3',
    icon: faCircle,
    color: themedark.color.green,
    type: 'drum',
  },
  {
    value: 'kick',
    displayName: 'Kick',
    icon: faCircle,
    color: themedark.color.orange,
    type: 'drum',
  },
];

export const KIT_ELEMENTS = new Map<InputElement, MappingElement>(
  KIT_ELEMENT_LIST.map((element): [InputElement, MappingElement] => [
    element.value,
    element,
  ]),
);

export const CONTROL_ELEMENTS: MappingElement[] = [
  {
    value: 'up',
    displayName: 'Up',
    color: themedark.color.textMuted,
    icon: faArrowUp,
    category: 'shared',
    type: 'control',
  },
  {
    value: 'down',
    displayName: 'Down',
    color: themedark.color.textMuted,
    icon: faArrowDown,
    category: 'shared',
    type: 'control',
  },
  {
    value: 'left',
    displayName: 'Left',
    color: themedark.color.textMuted,
    icon: faArrowLeft,
    category: 'game',
    type: 'control',
  },
  {
    value: 'right',
    displayName: 'Right',
    color: themedark.color.textMuted,
    icon: faArrowRight,
    category: 'game',
    type: 'control',
  },
  {
    value: 'confirm',
    displayName: 'Confirm',
    color: themedark.color.textMuted,
    icon: faCheck,
    category: 'shared',
    type: 'control',
  },
  {
    value: 'back',
    displayName: 'Back',
    color: themedark.color.textMuted,
    icon: faChevronLeft,
    category: 'shared',
    type: 'control',
  },
  {
    value: 'difficulty',
    displayName: 'Difficulty',
    color: themedark.color.textMuted,
    icon: faDumbbell,
    category: 'library',
    type: 'control',
  },
  {
    value: 'library',
    displayName: 'Library',
    color: themedark.color.textMuted,
    icon: faBook,
    category: 'library',
    type: 'control',
  },
  {
    value: 'sort',
    displayName: 'Sort',
    color: themedark.color.textMuted,
    icon: faSort,
    category: 'library',
    type: 'control',
  },
  {
    value: 'pause',
    displayName: 'Pause',
    color: themedark.color.textMuted,
    icon: faPause,
    category: 'game',
    type: 'control',
  },
  {
    value: 'faster',
    displayName: 'Faster',
    color: themedark.color.textMuted,
    icon: faAnglesRight,
    category: 'game',
    type: 'control',
  },
  {
    value: 'slower',
    displayName: 'Slower',
    color: themedark.color.textMuted,
    icon: faSnowflake,
    category: 'game',
    type: 'control',
  },
];

export const GROUPED_CONTROL_ELEMENTS = groupBy(
  CONTROL_ELEMENTS,
  (e) => e.category!,
);

export const CONTROL_CATEGORIES = new Map<
  keyof ControlMapping,
  ControlCategory
>(CONTROL_ELEMENTS.map((e) => [e.value as keyof ControlMapping, e.category!]));

export const CATEGORY_CONFLICTS: Record<ControlCategory, ControlCategory[]> = {
  shared: ['shared', 'library', 'game'],
  library: ['shared', 'library'],
  game: ['shared', 'game'],
};
