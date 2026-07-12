export type Lane = 'kick' | 'snare' | 'yellow' | 'blue' | 'green';

export interface Cell {
  lane: Lane;
  tom: boolean;
}

export interface DslBlock {
  resolution: number;
  timeSig?: [number, number];
  hits: { tick: number; cells: Cell[] }[];
}

export type NoteEvent = {
  tick: number;
  type: number;
  flags: number;
  length: number;
};
