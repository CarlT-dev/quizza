/**
 * Document text extraction contracts.
 *
 * Extraction is pluggable per file extension: each supported format ships an
 * ExtractorAdapter, and the registry (services/extractor-registry) picks the
 * right one. Adding PPTX later means adding one adapter file — nothing else
 * upstream changes.
 */

export type DocExtractErrorReason = 'unsupported' | 'unreadable' | 'empty' | 'too-large';

/** Error raised by the registry/adapters with a machine-readable reason. */
export class DocExtractError extends Error {
  /** Why extraction failed — used by the UI to decide the fallback. */
  reason: DocExtractErrorReason;

  constructor(reason: DocExtractErrorReason, message: string) {
    super(message);
    this.name = 'DocExtractError';
    this.reason = reason;
  }
}

export interface ExtractResult {
  /** Sanitized text: whitespace collapsed, control characters stripped. */
  text: string;
  /** True when the text was cut to the character cap. */
  truncated: boolean;
  /** Sanitized length before truncation. */
  originalLength: number;
}

export interface ExtractOptions {
  /** Hard cap on returned characters (the adapter should stop early when possible). */
  maxChars: number;
}

/** One adapter per document format. */
export interface ExtractorAdapter {
  /** Lowercase extensions this adapter handles, without the dot (e.g. 'docx'). */
  extensions: string[];
  /** Extract raw text from the file (the registry sanitizes and caps it). */
  extract(file: File, options: ExtractOptions): Promise<string>;
}
