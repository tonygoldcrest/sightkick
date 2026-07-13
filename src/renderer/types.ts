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

export type ControlCategory = 'shared' | 'library' | 'game';

export type MappingElement = {
  value: InputElement;
  color: string;
  displayName: string;
  category?: ControlCategory;
  type: 'cymbal' | 'drum' | 'control';
  icon: IconDefinition;
};

export type LibraryMode = 'local' | 'online';

export interface OnlineSong {
  source: 'online';
  id: string;
  downloadUrl: string;
  albumCover?: string;
  name: string;
  artist: string;
  charter: string;
  drumDifficulty: number;
}

export type GameMode = 'perform' | 'practice';

export type PracticeRange = { start: number; end: number };
