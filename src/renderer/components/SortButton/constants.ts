import { SortKey } from './types';

export const DIRECTIONAL_KEYS: SortKey[] = ['name', 'lastAdded', 'difficulty'];

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'favorite', label: 'Favorite' },
  { key: 'lastAdded', label: 'Last added' },
  { key: 'difficulty', label: 'Difficulty' },
];
