import themedark from './theme';
import { InputElement } from '../types';
import { MappingElement } from './types';
import { faCircle, faXmark } from '@fortawesome/free-solid-svg-icons';

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
