import path from 'path';
import fs from 'fs';
import os from 'os';
import { app, BrowserWindow, dialog } from 'electron';

interface ExportPdfPayload {
  html: string;
  fileName: string;
}

export async function exportPdf(
  event: Electron.IpcMainEvent,
  { html, fileName }: ExportPdfPayload,
) {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const dialogOptions = {
    title: 'Export as PDF',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  };
  const { canceled, filePath } = await (parent
    ? dialog.showSaveDialog(parent, dialogOptions)
    : dialog.showSaveDialog(dialogOptions));

  if (canceled || !filePath) {
    event.reply('export-pdf', { canceled: true });

    return;
  }

  const tempHtmlPath = path.join(
    os.tmpdir(),
    `sightkick-export-${Date.now()}.html`,
  );
  const printWindow = new BrowserWindow({ show: false });

  try {
    fs.writeFileSync(tempHtmlPath, html);
    await printWindow.loadFile(tempHtmlPath);

    const pdf = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(filePath, new Uint8Array(pdf));
    event.reply('export-pdf', { ok: true, filePath });
  } catch (error) {
    event.reply('export-pdf', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    printWindow.destroy();
    fs.rm(tempHtmlPath, () => undefined);
  }
}
