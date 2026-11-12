/**
 * PPTX text extraction via JSZip + DOM parsing (raw text, no styles).
 *
 * JSZip is imported dynamically (already a dependency of mammoth) so its
 * bundle stays out of the initial chunk — it only loads when a user
 * actually uploads a PPTX.
 */

import { DocExtractError } from '../../types';
import type { ExtractorAdapter, ExtractOptions } from '../../types';

/** ZIP local file header signature: "PK\x03\x04". Real PPTX files are ZIPs. */
const PPTX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function isZipFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return PPTX_MAGIC.every((byte, index) => head[index] === byte);
}

/** Extract text from a slide XML string using DOMParser. */
function extractTextFromSlideXml(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  // PPTX text runs are in <a:t> elements (namespace: http://schemas.openxmlformats.org/drawingml/2006/main)
  const textNodes = doc.querySelectorAll('a\\:t, t');
  return Array.from(textNodes)
    .map((node) => node.textContent ?? '')
    .join(' ');
}

export const pptxAdapter: ExtractorAdapter = {
  extensions: ['pptx'],
  async extract(file: File, { maxChars }: ExtractOptions): Promise<string> {
    if (!(await isZipFile(file))) {
      throw new DocExtractError('unreadable', `"${file.name}" is not a valid PPTX file.`);
    }

    // Lazy import keeps JSZip out of the main chunk
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    // Find all slide XML files: ppt/slides/slide1.xml, slide2.xml, etc.
    const slideFiles = Object.keys(zip.files).filter((filename) =>
      filename.match(/^ppt\/slides\/slide\d+\.xml$/i)
    );

    if (slideFiles.length === 0) {
      throw new DocExtractError('empty', `"${file.name}" contains no slides.`);
    }

    // Extract text from each slide in order
    const slideTexts: string[] = [];
    let totalLength = 0;

    for (const slideFile of slideFiles.sort()) {
      const xml = await zip.files[slideFile].async('string');
      const text = extractTextFromSlideXml(xml);
      if (text.trim()) {
        slideTexts.push(text.trim());
        totalLength += text.length;
        // Head-biased: stop early once we have enough context
        if (totalLength >= maxChars) break;
      }
    }

    return slideTexts.join('\n\n');
  },
};