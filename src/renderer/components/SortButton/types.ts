export type SortKey = 'name' | 'favorite' | 'lastAdded' | 'difficulty';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}
