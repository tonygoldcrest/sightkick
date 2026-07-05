import { ParsedChart } from '../../../chart-parser/types';

export interface Beat {
  timeSeconds: number;
  isDownbeat: boolean;
}

export interface CountInInfo {
  beats: number;
  beatDurationSeconds: number;
}

export type TimingChart = Pick<ParsedChart, 'resolution' | 'tempos'>;
