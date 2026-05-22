import { readFileSync } from 'node:fs';

const source = readFileSync('utils/generatePdf.ts', 'utf8');
const signatureImageBlock = source.match(/sigStack\.push\(\{[\s\S]*?image: settings\.unterschrift,[\s\S]*?\}\);/);

if (!signatureImageBlock) {
  console.error('Could not find pdfmake signature image block.');
  process.exit(1);
}

if (/alignment:\s*['"]center['"]/.test(signatureImageBlock[0])) {
  console.error('PDF signature image must not be centered; it should align with the signature line.');
  process.exit(1);
}
