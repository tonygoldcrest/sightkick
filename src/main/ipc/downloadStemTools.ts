import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { IpcDownloadStemToolsResponse, StemToolsManifest } from '../../types';
import {
  getArchiveName,
  getBundleDir,
  getManifestName,
  getPlatformSlug,
  getStemToolsDir,
  releaseAssetUrl,
} from '../stemTools';

class CancelledError extends Error {}

let activeProc: ReturnType<typeof spawn> | undefined;
let abortController: AbortController | undefined;
let cancelled = false;
let activeStagingDir: string | undefined;
let activeArchivePath: string | undefined;

function cleanupActiveDownload() {
  const staging = activeStagingDir;
  const archive = activeArchivePath;

  activeStagingDir = undefined;
  activeArchivePath = undefined;

  if (staging && path.isAbsolute(staging)) {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  if (archive && path.isAbsolute(archive)) {
    fs.rmSync(archive, { force: true });
  }
}

export function cancelStemTools() {
  cancelled = true;
  abortController?.abort();
  activeProc?.kill();
  cleanupActiveDownload();
}

function countFiles(dir: string): number {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  return entries.reduce((total, entry) => {
    if (entry.isDirectory()) {
      return total + countFiles(path.join(dir, entry.name));
    }

    return total + (entry.isFile() ? 1 : 0);
  }, 0);
}

async function fetchManifest(slug: string): Promise<StemToolsManifest> {
  const response = await fetch(releaseAssetUrl(getManifestName(slug)));

  if (!response.ok) {
    throw new Error(`Manifest download failed: ${response.status}`);
  }

  return (await response.json()) as StemToolsManifest;
}

async function downloadArchive(
  event: Electron.IpcMainEvent,
  slug: string,
  destPath: string,
): Promise<void> {
  abortController = new AbortController();

  const response = await fetch(releaseAssetUrl(getArchiveName(slug)), {
    signal: abortController.signal,
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length')) || 0;
  const reader = response.body!.getReader();
  const fileStream = fs.createWriteStream(destPath);
  let downloaded = 0;
  let lastProgress = -1;

  try {
    let result = await reader.read();

    while (!result.done) {
      if (cancelled) {
        throw new CancelledError();
      }

      downloaded += result.value.length;

      if (!fileStream.write(result.value)) {
        await new Promise<void>((resolve) => fileStream.once('drain', resolve));
      }

      if (contentLength > 0) {
        const progress = Math.round((downloaded / contentLength) * 50);

        if (progress !== lastProgress) {
          lastProgress = progress;
          event.reply('download-stem-tools', {
            phase: 'downloading',
            progress,
          } satisfies IpcDownloadStemToolsResponse);
        }
      }

      result = await reader.read();
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      fileStream.end((err?: Error | null) => (err ? reject(err) : resolve())),
    );
  }
}

async function extractArchive(
  event: Electron.IpcMainEvent,
  archivePath: string,
  stagingDir: string,
  fileCount: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    event.reply('download-stem-tools', {
      phase: 'extracting',
      progress: 50,
    } satisfies IpcDownloadStemToolsResponse);

    const proc = spawn('tar', ['-xzf', archivePath, '-C', stagingDir]);

    activeProc = proc;

    const stderr: string[] = [];
    let lastProgress = 50;

    proc.stderr?.on('data', (data: Buffer) => stderr.push(data.toString()));

    const poll = setInterval(() => {
      const progress =
        fileCount > 0
          ? 50 +
            Math.min(49, Math.round((countFiles(stagingDir) / fileCount) * 50))
          : 50;

      if (progress !== lastProgress) {
        lastProgress = progress;
        event.reply('download-stem-tools', {
          phase: 'extracting',
          progress,
        } satisfies IpcDownloadStemToolsResponse);
      }
    }, 300);

    proc.on('error', (err) => {
      clearInterval(poll);
      activeProc = undefined;
      reject(err);
    });
    proc.on('close', (code, signal) => {
      clearInterval(poll);
      activeProc = undefined;

      if (cancelled || signal === 'SIGTERM' || signal === 'SIGKILL') {
        reject(new CancelledError());
      } else if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`Extraction failed with code ${code}: ${stderr.join('')}`),
        );
      }
    });
  });
}

function validate(stagingBundleDir: string, manifest: StemToolsManifest): void {
  const extracted = countFiles(stagingBundleDir);

  if (extracted < manifest.fileCount) {
    throw new Error(
      `Incomplete extraction: expected ${manifest.fileCount} files, got ${extracted}`,
    );
  }
}

export async function downloadStemTools(event: Electron.IpcMainEvent) {
  const slug = getPlatformSlug();

  if (!slug) {
    event.reply('download-stem-tools', {
      success: false,
      error: 'Unsupported platform',
    } satisfies IpcDownloadStemToolsResponse);

    return;
  }

  cancelled = false;
  abortController = undefined;
  activeProc = undefined;

  const stemToolsDir = getStemToolsDir();
  const bundleDir = getBundleDir();
  const archivePath = path.join(os.tmpdir(), getArchiveName(slug));
  const stagingDir = path.join(stemToolsDir, `.staging-${Date.now()}`);
  const stagingBundleDir = path.join(stagingDir, 'demucs-split');

  activeArchivePath = archivePath;
  activeStagingDir = stagingDir;

  try {
    const manifest = await fetchManifest(slug);

    fs.mkdirSync(stemToolsDir, { recursive: true });
    await downloadArchive(event, slug, archivePath);

    if (cancelled) {
      throw new CancelledError();
    }

    fs.mkdirSync(stagingDir, { recursive: true });
    await extractArchive(event, archivePath, stagingDir, manifest.fileCount);

    validate(stagingBundleDir, manifest);
    fs.writeFileSync(
      path.join(stagingBundleDir, 'manifest.json'),
      JSON.stringify(manifest),
    );

    fs.rmSync(bundleDir, { recursive: true, force: true });
    fs.renameSync(stagingBundleDir, bundleDir);
    cleanupActiveDownload();

    event.reply('download-stem-tools', {
      success: true,
    } satisfies IpcDownloadStemToolsResponse);
  } catch (err) {
    cleanupActiveDownload();

    if (err instanceof CancelledError) {
      event.reply('download-stem-tools', {
        success: false,
        cancelled: true,
      } satisfies IpcDownloadStemToolsResponse);

      return;
    }

    event.reply('download-stem-tools', {
      success: false,
      error: String(err),
    } satisfies IpcDownloadStemToolsResponse);
  }
}
