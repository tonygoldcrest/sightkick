import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { InputElement } from '../types';

export interface AudioFile {
  name: string;
  src: string;
  elements: HTMLAudioElement[];
  volume: number;
}

export const PLAYHEAD_STYLES = ['Cursor', 'Measure'] as const;

export type PlayheadStyle = (typeof PLAYHEAD_STYLES)[number];

export type MappingElement = {
  value: InputElement;
  color: string;
  displayName: string;
  type: 'cymbal' | 'drum' | 'control';
  icon: IconDefinition;
};
