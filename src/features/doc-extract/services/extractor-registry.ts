/**
 * Picks the right ExtractorAdapter for a file and normalizes its output.
 *
 * This registry is the extension point for future formats (PPTX, etc.):
 * register one adapter file and everything upstream (CreateQuizPage,
 * the generation prompt) works unchanged.
 */

import { DocExtractError, type ExtractResult, type ExtractorAdapter } from '../types';
import { docxAdapter } from './adapters/docx.adapter';
import { pdfAdapter } from './adapters/pdf.adapter';
import { pptxAdapter } from './adapters/pptx.adapter';

/** Files above this size are rejected before parsing. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

/** Hard cap on extracted text handed to the AI (head-biased truncation). */
export const MAX_CONTEXT_CHARS = 30_000;

const registry = new Map<string, ExtractorAdapter>();

export function registerAdapter(adapter: ExtractorAdapter): void {
  for (const ext of adapter.extensions) {
    registry.set(ext.toLowerCase(), adapter);
  }
}

registerAdapter(docxAdapter);
registerAdapter(pdfAdapter);
registerAdapter(pptxAdapter);

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Strip control characters and collapse whitespace while keeping paragraph breaks. */
function sanitize(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex — intentional: strip control chars from extracted document text before handing it to the AI.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const ext = extensionOf(file.name);
  const adapter = registry.get(ext);

  if (!adapter) {
    throw new DocExtractError('unsupported', `"${ext || file.name}" is not a supported document type.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new DocExtractError('too-large', `"${file.name}" is larger than the 20MB limit.`);
  }

  let raw = '';
  try {
    raw = await adapter.extract(file, { maxChars: MAX_CONTEXT_CHARS });
  } catch (error) {
    if (error instanceof DocExtractError) throw error;
    throw new DocExtractError('unreadable', `"${file.name}" could not be read.`);
  }

  const text = sanitize(raw);
  if (!text) {
    throw new DocExtractError('empty', `"${file.name}" contains no readable text (it may be scanned images).`);
  }

  const truncated = text.length > MAX_CONTEXT_CHARS;
  return {
    text: truncated ? text.slice(0, MAX_CONTEXT_CHARS) : text,
    truncated,
    originalLength: text.length,
  };
}
