/**
 * Receipt type definitions for OCR and data extraction
 */

/**
 * Bounding box coordinates for a word
 */
export interface WordBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Individual word from OCR with confidence and position
 */
export interface OCRWord {
  text: string;
  confidence: number;
  bbox: WordBBox;
}

/**
 * Raw output from Tesseract.js OCR
 */
export interface RawOCRResult {
  text: string;           // Full extracted text
  confidence: number;     // Overall confidence score (0-100)
  words: OCRWord[];       // Word-level data with positions
}

/**
 * Single line item on a receipt
 */
export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
}

/**
 * Parsed receipt data structure
 */
export interface ReceiptData {
  merchantName: string | null;
  date: Date | null;
  total: number | null;
  tax?: number | null;
  lineItems: LineItem[];
}
