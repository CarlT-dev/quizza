/**
 * DOCX text extraction via mammoth (raw text, no styles).
 *
 * mammoth is imported dynamically so its ~100 KB stays out of the initial
 * bundle — it only loads when a user actually uploads a DOCX.
 */

import { DocExtractError } from '../../types';
import type { ExtractorAdapter } from '../../types';

/** ZIP local file header signature: "PK\x03\x04". Real DOCX files are ZIPs. */
const DOCX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function isZipFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return DOCX_MAGIC.every((byte, index) => head[index] === byte);
}

export const docxAdapter: ExtractorAdapter = {
  extensions: ['docx'],
  async extract(file: File): Promise<string> {
    if (!(await isZipFile(file))) {
      throw new DocExtractError('unreadable', `"${file.name}" is not a valid DOCX file.`);
    }

    // Lazy import keeps mammoth out of the main chunk; Vite resolves its
    // "browser" field to the browser build.
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  },
};
