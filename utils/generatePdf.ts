import * as FileSystem from 'expo-file-system/legacy';
import type { Trip } from '@/db/types';
import type { Settings } from '@/db/types';
import { formatGesamtzeit } from './format';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// ─── WebView preview helpers (HTML) ──────────────────────────────────────────
// These are used by bericht.tsx to render a live preview; the actual PDF uses pdfmake below.

const FIRST_PAGE_AVAIL = 128;
const OTHER_PAGE_AVAIL = 153;
const ROW_BASE_H = 9;
const BESON_LINE_H = 5;
const BESON_CHARS_PER_LINE = 100;

function estimateRowHeight(trip: Trip): number {
  const text = trip.besonderheiten ?? '';
  const extraLines = Math.max(0, Math.ceil(text.length / BESON_CHARS_PER_LINE) - 1);
  return ROW_BASE_H + extraLines * BESON_LINE_H;
}

function splitIntoPages(trips: Trip[]): Trip[][] {
  const pages: Trip[][] = [];
  let page: Trip[] = [];
  let used = 0;
  let avail = FIRST_PAGE_AVAIL;
  for (const trip of trips) {
    const h = estimateRowHeight(trip);
    if (page.length > 0 && used + h > avail) {
      pages.push(page);
      page = [];
      used = 0;
      avail = OTHER_PAGE_AVAIL;
    }
    page.push(trip);
    used += h;
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

const COLGROUP = `
  <colgroup>
    <col style="width:11%"/>
    <col style="width:8%"/>
    <col style="width:9%"/>
    <col style="width:9%"/>
    <col style="width:8%"/>
    <col style="width:13%"/>
    <col style="width:8%"/>
    <col style="width:23%"/>
    <col style="width:11%"/>
  </colgroup>`;

const THEAD = `
  <thead>
    <tr>
      <th>Datum</th><th>Beginn Fahrt</th><th>Ankunft Schule / Werkstätte</th>
      <th>Abfahrt Schule / Werkstätte</th><th>Ende Fahrt</th><th>Gesamtzeit</th>
      <th>Tour-Nr.</th><th>Besonderheiten</th><th>aufgezeichnet am</th>
    </tr>
  </thead>`;

function tripRowHtml(t: Trip): string {
  return `<tr>
    <td>${t.datum}</td><td>${t.beginFahrt}</td><td>${t.ankunftSchule}</td>
    <td>${t.abfahrtSchule}</td><td>${t.endeFahrt}</td><td>${formatGesamtzeit(t.gesamtzeit)}</td>
    <td>${t.tourNr}</td><td>${t.besonderheiten ?? ''}</td><td>${t.aufgezeichnetAm}</td>
  </tr>`;
}

export function buildReportHtml(trips: Trip[], settings: Settings, month: number, year: number): string {
  const monatJahr = `${MONTH_NAMES[month - 1]} ${year}`;
  const fahrerName = settings.fahrerName || '_______________';
  const totalMinutes = trips.reduce((sum, t) => sum + t.gesamtzeit, 0);
  const pages = splitIntoPages(trips);
  const totalPages = pages.length;

  const signatureImg = settings.unterschrift
    ? `<img src="${settings.unterschrift}" style="height:50px;max-width:180px;display:block;margin-bottom:4px;"/>`
    : '';

  const footer = `
  <div class="footer">
    <div>${signatureImg}<span class="signature-line">Unterschrift</span></div>
    <div><strong>Gesamt: ${formatGesamtzeit(totalMinutes)}</strong></div>
  </div>`;

  const pageBlocks = pages.map((chunk, i) => {
    const breakClass = i > 0 ? ' class="page-break"' : '';
    const isLast = i === pages.length - 1;
    return `<div${breakClass}>
      ${i === 0
        ? `<h1>Stundennachweis für den Monat: ${monatJahr}</h1>
           <div class="meta">Name, Vorname: <strong>${fahrerName}</strong></div>`
        : ''}
      <table>${COLGROUP}${THEAD}<tbody>${chunk.map(tripRowHtml).join('')}</tbody></table>
      <div class="page-number">Seite ${i + 1} von ${totalPages}</div>
      ${isLast ? footer : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"/>
<style>
  @page { size: A4 landscape; margin: 20mm 20mm 12mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; margin: 0; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 5mm; }
  .meta { margin-bottom: 5mm; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 0; }
  th { background: #f0f0f0; font-weight: bold; font-size: 9pt; padding: 2mm 1.5mm; border: 1px solid #555; text-align: center; white-space: normal; word-break: break-word; vertical-align: middle; }
  td { padding: 2mm 1.5mm; border: 1px solid #555; font-size: 10pt; text-align: center; vertical-align: middle; word-break: break-word; }
  tr:nth-child(even) td { background: #fafafa; }
  .page-number { text-align: right; font-size: 8pt; color: #666; margin-top: 2mm; }
  .footer { margin-top: 6mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11pt; }
  .signature-line { border-top: 1px solid #000; display: inline-block; width: 60mm; padding-top: 1mm; font-size: 9pt; }
  @media print { .page-break { page-break-before: always; } }
</style>
</head><body>${pageBlocks}</body></html>`;
}

// ─── PDF file generation (pdfmake) ───────────────────────────────────────────

function sanitize(str: string): string {
  return str
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildFileName(settings: Settings, month: number, year: number): string {
  const monthName = sanitize(MONTH_NAMES[month - 1]);
  const name = settings.fahrerName ? `_${sanitize(settings.fahrerName)}` : '';
  return `Stundennachweis_${monthName}_${year}${name}.pdf`;
}

function patchForPdfmake() {
  const g = global as any;
  if (g.__pdfmakePatched) return;

  // 1. String.prototype.replaceAll polyfill (missing in some Hermes versions)
  if (!String.prototype.replaceAll) {
    // eslint-disable-next-line no-extend-native
    (String.prototype as any).replaceAll = function (search: any, replacement: any) {
      return this.split(search).join(replacement);
    };
  }

  // 2. TextDecoder polyfill — pdfmake's font parser calls TextDecoder with
  //    encodings Expo's WinterCG implementation rejects:
  //    'ascii'     → not in WHATWG spec
  //    'utf-16be'  → not supported in Hermes (readString falls back to raw
  //                  Uint8Array, making postscriptName a Uint8Array, breaking
  //                  the replaceAll call above)
  //    other Mac / legacy encodings → same fallback problem
  const Native = g.TextDecoder;
  if (Native) {
    g.TextDecoder = class TextDecoder {
      private _label: string;
      private _inner: any;
      constructor(label = 'utf-8', options?: any) {
        this._label = String(label).toLowerCase();
        if (this._label !== 'utf-16be') {
          try {
            this._inner = new Native(
              this._label === 'ascii' ? 'utf-8' : label,
              options,
            );
          } catch {
            this._inner = new Native('utf-8', options);
          }
        }
      }
      decode(input?: any, options?: any): string {
        if (!input) return '';
        const buf: Uint8Array = input instanceof Uint8Array
          ? input
          : new Uint8Array(
              input.buffer instanceof ArrayBuffer ? input.buffer : input,
              input.byteOffset ?? 0,
              input.byteLength ?? input.length ?? 0,
            );
        if (this._label === 'utf-16be') {
          // Pure-JS UTF-16BE → string (no TextDecoder dependency)
          let s = '';
          for (let i = 0; i + 1 < buf.length; i += 2) {
            s += String.fromCharCode((buf[i] << 8) | buf[i + 1]);
          }
          return s;
        }
        if (this._inner) return this._inner.decode(buf, options);
        // Last-resort: Latin-1 byte mapping (safe for ASCII-only font names)
        let s = '';
        for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
        return s;
      }
      get encoding() { return this._label === 'utf-16be' ? 'utf-16be' : (this._inner?.encoding ?? 'utf-8'); }
      get fatal()    { return this._inner?.fatal    ?? false; }
      get ignoreBOM(){ return this._inner?.ignoreBOM ?? false; }
    };
  }

  g.__pdfmakePatched = true;
}

export async function generatePdf(
  trips: Trip[],
  settings: Settings,
  month: number,
  year: number,
): Promise<string> {
  patchForPdfmake();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]) as [any, any];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake: any = pdfMakeModule.default ?? pdfMakeModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vfs: any = vfsModule.default ?? vfsModule;
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.fonts = {
    Roboto: {
      normal:       'Roboto-Regular.ttf',
      bold:         'Roboto-Medium.ttf',
      italics:      'Roboto-Italic.ttf',
      bolditalics:  'Roboto-MediumItalic.ttf',
    },
  };

  const monatJahr = `${MONTH_NAMES[month - 1]} ${year}`;
  const fahrerName = settings.fahrerName || '_______________';
  const totalMinutes = trips.reduce((sum, t) => sum + t.gesamtzeit, 0);

  const headerRow = [
    { text: 'Datum', style: 'th' },
    { text: 'Beginn Fahrt', style: 'th' },
    { text: 'Ankunft Schule /\nWerkstätte', style: 'th' },
    { text: 'Abfahrt Schule /\nWerkstätte', style: 'th' },
    { text: 'Ende Fahrt', style: 'th' },
    { text: 'Gesamtzeit', style: 'th' },
    { text: 'Tour-Nr.', style: 'th' },
    { text: 'Besonderheiten', style: 'th' },
    { text: 'aufgezeichnet am', style: 'th' },
  ];

  const dataRows = trips.map((t) => [
    { text: t.datum,                         style: 'td' },
    { text: t.beginFahrt,                    style: 'td' },
    { text: t.ankunftSchule,                 style: 'td' },
    { text: t.abfahrtSchule,                 style: 'td' },
    { text: t.endeFahrt,                     style: 'td' },
    { text: formatGesamtzeit(t.gesamtzeit),  style: 'td' },
    { text: t.tourNr,                        style: 'td' },
    { text: t.besonderheiten ?? '',          style: 'td' },
    { text: t.aufgezeichnetAm,               style: 'td' },
  ]);

  const sigStack: unknown[] = [];
  if (settings.unterschrift) {
    sigStack.push({
      image: settings.unterschrift,
      fit: [113, 30],
      margin: [0, 0, 0, 2],
    });
  }
  sigStack.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 113, y2: 0, lineWidth: 0.5 }] });
  sigStack.push({ text: 'Unterschrift', fontSize: 8, margin: [0, 2, 0, 0] });

  const docDefinition = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [57, 57, 57, 35],

    footer: (currentPage: number, pageCount: number) => ({
      text: `Seite ${currentPage} von ${pageCount}`,
      alignment: 'right',
      margin: [0, 8, 57, 0],
      fontSize: 8,
      color: '#666666',
    }),

    content: [
      {
        text: `Stundennachweis für den Monat: ${monatJahr}`,
        fontSize: 14,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      {
        text: [
          { text: 'Name, Vorname: ', fontSize: 11 },
          { text: fahrerName, fontSize: 11, bold: true },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths: [80, 58, 65, 65, 58, 95, 58, '*', 80],
          body: [headerRow, ...dataRows],
        },
        layout: {
          hLineWidth:    () => 0.5,
          vLineWidth:    () => 0.5,
          hLineColor:    () => '#555555',
          vLineColor:    () => '#555555',
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return '#f0f0f0';
            return rowIndex % 2 === 0 ? '#fafafa' : null;
          },
          paddingTop:    () => 3,
          paddingBottom: () => 3,
          paddingLeft:   () => 3,
          paddingRight:  () => 3,
        },
      },
      {
        margin: [0, 15, 0, 0],
        columns: [
          { stack: sigStack },
          {
            text: `Gesamt: ${formatGesamtzeit(totalMinutes)}`,
            fontSize: 11,
            bold: true,
            alignment: 'right',
          },
        ],
      },
    ],

    styles: {
      th: { fontSize: 8, bold: true, alignment: 'center', color: '#000000' },
      td: { fontSize: 9, alignment: 'center', color: '#000000' },
    },

    defaultStyle: { fontSize: 9, color: '#000000', font: 'Roboto' },
  };

  const base64: string = await pdfMake.createPdf(docDefinition).getBase64();

  const fileName = buildFileName(settings, month, year);
  const destUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return destUri;
}
