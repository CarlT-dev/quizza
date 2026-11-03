/**
 * PDF text extraction via pdf.js, loaded lazily so neither the library nor
 * its worker lands in the main bundle. Reads the text layer only — scanned
 * PDFs (no text layer) return '' and the registry maps that to 'empty'.
 */

import type { ExtractorAdapter, ExtractOptions } from '../../types';

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  // The worker stays out of the main chunk via the `?url` import.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

export const pdfAdapter: ExtractorAdapter = {
  extensions: ['pdf'],
  async extract(file: File, { maxChars }: ExtractOptions): Promise<string> {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;

    const chunks: string[] = [];
    let length = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      chunks.push(pageText);
      length += pageText.length + 1;
      // Head-biased: stop early once we have enough context.
      if (length >= maxChars) break;
    }

    return chunks.join('\n');
  },
};
