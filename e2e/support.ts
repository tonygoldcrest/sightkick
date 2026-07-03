import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { _electron as electron, ElectronApplication } from '@playwright/test';

const MAIN_ENTRY = path.join(__dirname, '..', 'out', 'main', 'index.js');

export interface Harness {
  app: ElectronApplication;
  libraryDir: string;
}

const ALBUM_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function writeFixtureLibrary(): string {
  const libraryDir = mkdtempSync(path.join(tmpdir(), 'sightkick-library-'));
  const songDir = path.join(libraryDir, 'test-song');

  mkdirSync(songDir, { recursive: true });

  writeFileSync(path.join(songDir, 'album.png'), ALBUM_PNG);

  writeFileSync(
    path.join(songDir, 'song.ini'),
    [
      '[song]',
      'name = Master of Puppets',
      'artist = Metallica',
      'charter = Test Charter',
      'pro_drums = True',
      'five_lane_drums = False',
      'diff_drums = 4',
      '',
    ].join('\n'),
  );

  writeFileSync(
    path.join(songDir, 'notes.chart'),
    [
      '[Song]',
      '{',
      '  Resolution = 480',
      '}',
      '[SyncTrack]',
      '{',
      '  0 = TS 4',
      '  0 = B 120000',
      '}',
      '[ExpertDrums]',
      '{',
      '  0 = N 0 0',
      '  480 = N 1 0',
      '  960 = N 0 0',
      '  1440 = N 1 0',
      '  1920 = N 0 0',
      '  2400 = N 2 0',
      '  2400 = N 66 0',
      '  2880 = N 0 0',
      '  3360 = N 1 0',
      '}',
      '',
    ].join('\n'),
  );

  return libraryDir;
}

function seedUserData(seed: Record<string, unknown>): string {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'sightkick-userdata-'));

  writeFileSync(
    path.join(userDataDir, 'config.json'),
    JSON.stringify(seed, undefined, 2),
  );

  return userDataDir;
}

export async function launchApp(
  options: { seedLibrary?: boolean } = {},
): Promise<Harness> {
  const libraryDir = writeFixtureLibrary();
  const userDataDir = seedUserData(
    options.seedLibrary ? { lastOpenedPath: libraryDir } : {},
  );
  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      START_MINIMIZED: '1',
    },
  });

  return { app, libraryDir };
}
