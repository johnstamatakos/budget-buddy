import { parsePdf } from './pdfParser.js';
import { parseSpreadsheet } from './spreadsheetParser.js';

export async function parseFile(buffer, mimetype, originalname) {
  const ext = (originalname || '').toLowerCase().split('.').pop();

  if (
    mimetype === 'application/pdf' ||
    ext === 'pdf'
  ) {
    return parsePdf(buffer);
  }

  if (
    mimetype === 'text/csv' ||
    mimetype === 'application/vnd.ms-excel' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === 'csv' ||
    ext === 'xlsx' ||
    ext === 'xls'
  ) {
    return parseSpreadsheet(buffer);
  }

  throw new Error(`Unsupported file type: ${mimetype || ext}. Please upload a PDF, CSV, or Excel file.`);
}
