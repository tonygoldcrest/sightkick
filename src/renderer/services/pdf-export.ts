import themedark from '../theme';

interface SheetPdfParams {
  name: string;
  artist: string;
  charter: string;
  vexflowContainer: HTMLElement;
}

const VIEWBOX_PAD_TOP = 72;
const VIEWBOX_PAD_BOTTOM = 28;
const html = String.raw;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function selfContainedMusicHtml(vexflowContainer: HTMLElement): string {
  const clone = vexflowContainer.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('svg').forEach((svg) => {
    const viewBox = svg.getAttribute('viewBox');

    if (!viewBox) {
      return;
    }

    const [, , width, height] = viewBox.split(/\s+/).map(Number);
    const paddedHeight = height + VIEWBOX_PAD_TOP + VIEWBOX_PAD_BOTTOM;

    svg.setAttribute(
      'viewBox',
      `0 ${-VIEWBOX_PAD_TOP} ${width} ${paddedHeight}`,
    );
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(paddedHeight));
    svg.removeAttribute('style');

    const row = svg.parentElement;

    if (row) {
      row.style.marginTop = `${(-VIEWBOX_PAD_TOP / width) * 100}%`;
      row.style.marginBottom = `${(-VIEWBOX_PAD_BOTTOM / width) * 100}%`;
    }
  });

  return clone.innerHTML;
}

export function buildSheetPdfHtml({
  name,
  artist,
  charter,
  vexflowContainer,
}: SheetPdfParams): string {
  return html`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
          }
          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          .sheet {
            color: ${themedark.color.ink};
            font-family: ${themedark.font.display};
          }
          .title {
            margin: 0 0 4px;
            text-align: center;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          .credits {
            text-align: right;
            font-style: italic;
            font-size: 10px;
            margin-bottom: 10px;
          }
          .music > div {
            break-inside: avoid;
            width: 100% !important;
            height: auto !important;
            position: static !important;
          }
          .music svg {
            display: block;
            width: 100%;
            height: auto;
            overflow: visible;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1 class="title">${escapeHtml(name)}</h1>
          <div class="credits">
            <div>Music by ${escapeHtml(artist)}</div>
            <div>Arranged by ${escapeHtml(charter)}</div>
          </div>
          <div class="music">${selfContainedMusicHtml(vexflowContainer)}</div>
        </div>
      </body>
    </html>`;
}
