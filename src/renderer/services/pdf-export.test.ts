import { describe, expect, it } from 'vitest';
import { buildSheetPdfHtml } from './pdf-export';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeContainer(rowCount = 1): HTMLElement {
  const container = document.createElement('div');

  for (let i = 0; i < rowCount; i += 1) {
    const row = document.createElement('div');

    row.style.width = '1210px';
    row.style.height = '130px';
    row.style.position = 'relative';

    const svg = document.createElementNS(SVG_NS, 'svg');

    svg.setAttribute('viewBox', '0 0 1210 130');
    svg.setAttribute('width', '1210');
    svg.setAttribute('height', '130');
    svg.setAttribute('style', 'overflow: visible');
    row.appendChild(svg);
    container.appendChild(row);
  }

  return container;
}

function parse(htmlString: string): Document {
  return new DOMParser().parseFromString(htmlString, 'text/html');
}

describe('buildSheetPdfHtml', () => {
  const baseParams = {
    name: 'Song',
    artist: 'Artist',
    charter: 'Charter',
  };

  it('renders the title and credits', () => {
    const doc = parse(
      buildSheetPdfHtml({ ...baseParams, vexflowContainer: makeContainer() }),
    );

    expect(doc.querySelector('.title')?.textContent).toBe('Song');
    expect(doc.querySelector('.credits')?.textContent).toContain(
      'Music by Artist',
    );
    expect(doc.querySelector('.credits')?.textContent).toContain(
      'Arranged by Charter',
    );
  });

  it('escapes HTML in the metadata', () => {
    const html = buildSheetPdfHtml({
      name: 'A & B <x>',
      artist: '"Q"',
      charter: 'C',
      vexflowContainer: makeContainer(),
    });

    expect(html).toContain('A &amp; B &lt;x&gt;');
    expect(html).toContain('&quot;Q&quot;');
  });

  it('expands each row SVG viewBox to contain the note overhang', () => {
    const doc = parse(
      buildSheetPdfHtml({ ...baseParams, vexflowContainer: makeContainer() }),
    );
    const svg = doc.querySelector('svg')!;

    expect(svg.getAttribute('viewBox')).toBe('0 -72 1210 230');
    expect(svg.getAttribute('width')).toBe('1210');
    expect(svg.getAttribute('height')).toBe('230');
    expect(svg.hasAttribute('style')).toBe(false);
  });

  it('reclaims the added viewBox padding with negative row margins', () => {
    const doc = parse(
      buildSheetPdfHtml({ ...baseParams, vexflowContainer: makeContainer() }),
    );
    const row = doc.querySelector('svg')!.parentElement!;

    expect(parseFloat(row.style.marginTop)).toBeCloseTo((-72 / 1210) * 100);
    expect(parseFloat(row.style.marginBottom)).toBeCloseTo((-28 / 1210) * 100);
    expect(row.style.marginTop.endsWith('%')).toBe(true);
  });

  it('keeps every row and targets A4 with a white background', () => {
    const html = buildSheetPdfHtml({
      ...baseParams,
      vexflowContainer: makeContainer(3),
    });
    const doc = parse(html);

    expect(doc.querySelectorAll('.music > div')).toHaveLength(3);
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('background: #ffffff');
  });

  it('does not mutate the source container', () => {
    const container = makeContainer();

    buildSheetPdfHtml({ ...baseParams, vexflowContainer: container });

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(
      '0 0 1210 130',
    );
  });
});
