import { ReceiptData, LineItem } from '../types/receipt';

// Regex patterns for extraction
const GENERIC_HEADERS = /^(receipt|invoice|thank you|customer copy)$/i;

const DATE_PATTERNS = [
  // MM/DD/YYYY or MM-DD-YYYY
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/,
  // YYYY-MM-DD or YYYY/MM/DD
  /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
  // Month DD, YYYY (Jan 15, 2026)
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
  // DD-Month-YYYY (15-Jan-2026)
  /\b(\d{1,2})[\/\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\-](\d{4})\b/i,
];

const MONTH_MAP: { [key: string]: number } = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const TOTAL_PATTERN = /(?:total|amount\s*due|grand\s*total)[:\s]*\$?\s*([\d,]+\.?\d*)/i;
const TAX_PATTERN = /(?:tax|hst|gst|sales\s*tax)[:\s]*\$?\s*([\d,]+\.?\d*)/i;
const LINE_ITEM_PATTERN = /^(.+?)\s+\$?\s*([\d,]+\.\d{2})$/;
const QUANTITY_PATTERN = /^(.+?)\s+(\d+)\s*@\s*\$?\s*([\d,]+\.\d{2})\s+\$?\s*([\d,]+\.\d{2})$/;

/**
 * Parses raw OCR text into structured receipt data
 */
export function parseReceipt(rawText: string): ReceiptData {
  if (!rawText || rawText.trim().length === 0) {
    return {
      merchantName: null,
      date: null,
      total: null,
      tax: null,
      lineItems: [],
    };
  }

  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const merchantName = extractMerchant(lines);
  const date = extractDate(rawText);
  const total = extractTotal(rawText);
  const tax = extractTax(rawText);
  const lineItems = extractLineItems(lines);

  return {
    merchantName,
    date,
    total,
    tax,
    lineItems,
  };
}

/**
 * Extracts merchant name from first substantial line
 */
function extractMerchant(lines: string[]): string | null {
  for (const line of lines) {
    // Skip if line is too short
    if (line.length <= 3) continue;
    
    // Skip if it's all digits
    if (/^\d+$/.test(line)) continue;
    
    // Skip if it matches a date pattern
    if (DATE_PATTERNS.some(pattern => pattern.test(line))) continue;
    
    // Skip generic headers
    if (GENERIC_HEADERS.test(line)) continue;
    
    // This looks like a merchant name
    return line;
  }
  
  return null;
}

/**
 * Extracts date from text, trying multiple formats
 */
function extractDate(text: string): Date | null {
  // Try MM/DD/YYYY or MM-DD-YYYY
  const match1 = text.match(DATE_PATTERNS[0]);
  if (match1) {
    return createDate(parseInt(match1[3], 10), parseInt(match1[1], 10) - 1, parseInt(match1[2], 10));
  }

  // Try YYYY-MM-DD or YYYY/MM/DD
  const match2 = text.match(DATE_PATTERNS[1]);
  if (match2) {
    return createDate(parseInt(match2[1], 10), parseInt(match2[2], 10) - 1, parseInt(match2[3], 10));
  }

  // Try Month DD, YYYY
  const match3 = text.match(DATE_PATTERNS[2]);
  if (match3) {
    const month = MONTH_MAP[match3[1].toLowerCase().substring(0, 3)];
    return createDate(parseInt(match3[3], 10), month, parseInt(match3[2], 10));
  }

  // Try DD-Month-YYYY
  const match4 = text.match(DATE_PATTERNS[3]);
  if (match4) {
    const month = MONTH_MAP[match4[2].toLowerCase().substring(0, 3)];
    return createDate(parseInt(match4[3], 10), month, parseInt(match4[1], 10));
  }

  return null;
}

/**
 * Helper to create a Date object
 */
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day);
}

/**
 * Extracts total amount from text
 */
function extractTotal(text: string): number | null {
  return extractAmount(text, TOTAL_PATTERN);
}

/**
 * Extracts tax amount from text
 */
function extractTax(text: string): number | null {
  return extractAmount(text, TAX_PATTERN);
}

/**
 * Helper to extract numeric amount from text using a pattern
 */
function extractAmount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match) {
    const value = match[1].replace(/,/g, '');
    return parseFloat(value);
  }
  return null;
}

/**
 * Extracts line items from text
 */
function extractLineItems(lines: string[]): LineItem[] {
  const items: LineItem[] = [];

  for (const line of lines) {
    // Skip generic headers
    if (GENERIC_HEADERS.test(line)) continue;

    // Skip lines that look like totals or tax (these patterns include the label)
    if (TOTAL_PATTERN.test(line) || TAX_PATTERN.test(line)) continue;

    // Try to match quantity pattern first (e.g., "Nails 2 @ $1.50 $3.00")
    const qtyMatch = line.match(QUANTITY_PATTERN);
    if (qtyMatch) {
      const description = qtyMatch[1].trim();
      const quantity = parseInt(qtyMatch[2], 10);
      const unitPrice = parseFloat(qtyMatch[3].replace(/,/g, ''));
      const totalPrice = parseFloat(qtyMatch[4].replace(/,/g, ''));

      items.push({ description, quantity, unitPrice, totalPrice });
      continue;
    }

    // Try simple line item pattern (e.g., "Hammer $12.99")
    const itemMatch = line.match(LINE_ITEM_PATTERN);
    if (itemMatch) {
      const description = itemMatch[1].trim();
      const totalPrice = parseFloat(itemMatch[2].replace(/,/g, ''));

      items.push({ description, totalPrice });
    }
  }

  return items;
}
