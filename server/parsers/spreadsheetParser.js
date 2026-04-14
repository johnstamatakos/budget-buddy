import * as XLSX from 'xlsx';

export function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length > 0) {
      results.push(...rows);
    }
  }

  if (results.length === 0) {
    throw new Error('No data found in the spreadsheet. Make sure it has rows with transaction data.');
  }

  // Convert to a readable string for Claude
  const headers = Object.keys(results[0]);
  const lines = [headers.join(' | ')];
  for (const row of results.slice(0, 500)) { // cap at 500 rows
    lines.push(headers.map((h) => String(row[h] ?? '')).join(' | '));
  }

  return lines.join('\n');
}
