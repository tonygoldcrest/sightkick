import { Difficulty } from 'scan-chart';

export interface SongData {
  id: string;
  dir: string;
  albumCover: string | null;
  album: string;
  album_track: string;
  artist: string;
  banner_link_a: string;
  banner_link_b: string;
  charter: string;
  delay: string;
  diff_band: string;
  diff_bass: string;
  diff_bass_real: string;
  diff_bass_real_22: string;
  diff_bassghl: string;
  diff_dance: string;
  diff_drums: string;
  diff_drums_real: string;
  diff_drums_real_ps: string;
  diff_guitar: string;
  diff_guitar_coop: string;
  diff_guitar_real: string;
  diff_guitar_real_22: string;
  diff_guitarghl: string;
  diff_keys: string;
  diff_keys_real: string;
  diff_keys_real_ps: string;
  diff_rhythm: string;
  diff_vocals: string;
  diff_vocals_harm: string;
  drum_fallback_blue: string;
  five_lane_drums: string;
  genre: string;
  icon: string;
  link_name_a: string;
  link_name_b: string;
  loading_phrase: string;
  multiplier_note: string;
  name: string;
  playlist_track: string;
  preview_start_time: string;
  pro_drums: string;
  song_length: string;
  sysex_high_hat_ctrl: string;
  sysex_open_bass: string;
  sysex_rimshot: string;
  sysex_slider: string;
  video: string;
  video_start_time: string;
  year: string;
  liked?: boolean;
  updatedAt?: string;
  format: 'mid' | 'chart';
  audio: AudioData[];
  drumDifficulties?: Difficulty[];
  scoreData?: Record<Difficulty, ScoreData>;
}

export interface ScoreData {
  hitNotes?: number;
  totalNotes: number;
  falseHits: number;
}

export interface AudioData {
  src: string;
  name: string;
}

export type StemToolsStatus = 'ready' | 'download' | 'unsupported';

export type StemToolsPhase = 'downloading' | 'extracting';

export interface StemToolsManifest {
  version: string;
  fileCount: number;
  downloadSize: number;
  uncompressedSize: number;
}

export interface IpcCheckStemToolsResponse {
  status: StemToolsStatus;
  installedVersion?: string;
}

export interface IpcStemToolsRemoteResponse {
  available: boolean;
  latestVersion?: string;
  downloadSize?: number;
  uncompressedSize?: number;
  updateAvailable: boolean;
}

export interface IpcDownloadStemToolsResponse {
  phase?: StemToolsPhase;
  progress?: number;
  success?: boolean;
  cancelled?: boolean;
  error?: string;
}

export interface IpcDeleteStemToolsResponse {
  success: boolean;
  error?: string;
}

export interface IpcUpdateAvailable {
  phase: 'available';
  version: string;
  releaseUrl: string;
  releaseNotes?: string;
}

export type IpcUpdateStatus =
  | IpcUpdateAvailable
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string };

export interface IpcSplitSongResponse {
  id: string;
  progress?: number;
  success?: boolean;
  song?: SongData;
  error?: string;
  cancelled?: boolean;
}

export interface MidiDevice {
  port: number;
  name: string;
}

export enum MidiMessageType {
  NoteOn = 144,
  NoteOff = 128,
}

export interface MidiMessage {
  type: MidiMessageType;
  note: number;
  velocity: number;
  channel?: number;
}

export interface InputMapping {
  hihat?: string[];
  ride?: string[];
  crash?: string[];
  kick?: string[];
  snare?: string[];
  tom1?: string[];
  tom2?: string[];
  tom3?: string[];
}

export interface ControlMapping {
  up?: string[];
  down?: string[];
  left?: string[];
  right?: string[];
  confirm?: string[];
  back?: string[];
  difficulty?: string[];
  library?: string[];
  sort?: string[];
  pause?: string[];
  faster?: string[];
  slower?: string[];
}

export type InputElement = keyof InputMapping | keyof ControlMapping;

export type ElementMapping = Partial<Record<InputElement, string[]>>;

export type IpcUpdateSongPayload = Pick<SongData, 'id'> &
  Partial<Omit<SongData, 'id'>>;

export interface IpcErrorResponse {
  error: string;
}

export type IpcResult<T> = T | IpcErrorResponse;

export function isIpcError<T extends object>(
  payload: IpcResult<T>,
): payload is IpcErrorResponse {
  return 'error' in payload && typeof payload.error === 'string';
}

export interface IpcLoadSongResponse {
  data: SongData;
  fileData: Buffer;
}

export interface IpcLoadSongListResponse {
  songs: SongData[];
  lastOpenedPath: string | null;
  downloadedEncoreMd5s: string[];
}

export interface IpcScanProgressResponse {
  current: number;
  total: number;
}

export interface StorageSchema {
  songs: {
    [key: string]: SongData;
  };
}
