import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastReply, makeEvent } from './test-support';

const holder = vi.hoisted(() => ({
  saveResult: { canceled: false, filePath: '' } as {
    canceled: boolean;
    filePath: string | undefined;
  },
  printToPDF: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  dialog: { showSaveDialog: vi.fn(async () => holder.saveResult) },
  BrowserWindow: class {
    static fromWebContents = () => undefined;

    webContents = {
      printToPDF: (...args: unknown[]) => holder.printToPDF(...args),
    };

    loadFile = vi.fn(async () => undefined);

    destroy = vi.fn();
  },
}));

const { exportPdf } = await import('./exportPdf');
const electron = await import('electron');
const payload = {
  html: '<html><body>sheet</body></html>',
  fileName: 'Song.pdf',
};

function outputPath(): string {
  return path.join(
    os.tmpdir(),
    `pdf-export-test-${Date.now()}-${Math.random()}.pdf`,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('exportPdf', () => {
  it('prints the html and writes the chosen file', async () => {
    const out = outputPath();

    holder.saveResult = { canceled: false, filePath: out };
    holder.printToPDF.mockResolvedValueOnce(Buffer.from('%PDF-1.7 body'));

    const event = makeEvent();

    await exportPdf(event as never, payload);

    expect(holder.printToPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );
    expect(fs.readFileSync(out).toString()).toContain('%PDF');
    expect(lastReply(event, 'export-pdf')!.args[0]).toMatchObject({
      ok: true,
      filePath: out,
    });

    fs.rmSync(out);
  });

  it('defaults the save dialog to the given file name', async () => {
    holder.saveResult = { canceled: false, filePath: outputPath() };
    holder.printToPDF.mockResolvedValueOnce(Buffer.from('%PDF'));

    await exportPdf(makeEvent() as never, payload);

    const options = vi.mocked(electron.dialog.showSaveDialog).mock.calls[0]![0];

    expect(options.defaultPath?.endsWith('Song.pdf')).toBe(true);
  });

  it('replies canceled and does not print when the dialog is dismissed', async () => {
    holder.saveResult = { canceled: true, filePath: undefined };

    const event = makeEvent();

    await exportPdf(event as never, payload);

    expect(holder.printToPDF).not.toHaveBeenCalled();
    expect(lastReply(event, 'export-pdf')!.args[0]).toMatchObject({
      canceled: true,
    });
  });

  it('replies with the error message when printing fails', async () => {
    holder.saveResult = { canceled: false, filePath: outputPath() };
    holder.printToPDF.mockRejectedValueOnce(new Error('boom'));

    const event = makeEvent();

    await exportPdf(event as never, payload);

    expect(lastReply(event, 'export-pdf')!.args[0]).toMatchObject({
      error: 'boom',
    });
  });
});
