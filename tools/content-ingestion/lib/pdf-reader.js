'use strict';

// Extracts text from a PDF file using pdf-parse.
// Returns a single string with all page text joined by newlines.

module.exports = { readPdf };

async function readPdf(filePath) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch (_) {
    console.error('Error: pdf-parse is not installed. Run: npm install pdf-parse');
    process.exit(1);
  }

  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    console.error(`Error: PDF file not found: ${filePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}
