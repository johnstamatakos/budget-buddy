import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  if (!data.text || data.text.trim().length < 50) {
    throw new Error(
      'Could not extract text from this PDF. Make sure it is a text-based PDF exported from your bank website, not a scanned image.'
    );
  }
  return data.text;
}
