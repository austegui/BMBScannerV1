import { describe, it, expect } from 'vitest';
import { parseReceipt } from './receiptParser';

describe('parseReceipt', () => {
  describe('merchant extraction', () => {
    it('extracts merchant from first line', () => {
      const text = 'HOME DEPOT\n123 Main St\nDate: 01/15/2026';
      const result = parseReceipt(text);
      expect(result.merchantName).toBe('HOME DEPOT');
    });

    it('skips generic headers', () => {
      const text = 'RECEIPT\nACE HARDWARE\nThank you';
      const result = parseReceipt(text);
      expect(result.merchantName).toBe('ACE HARDWARE');
    });
  });

  describe('date extraction', () => {
    it('parses MM/DD/YYYY format', () => {
      const text = 'Store\n01/15/2026\nTotal: $10';
      const result = parseReceipt(text);
      expect(result.date?.toISOString().split('T')[0]).toBe('2026-01-15');
    });

    it('parses Month DD, YYYY format', () => {
      const text = 'Store\nJan 15, 2026\nTotal: $10';
      const result = parseReceipt(text);
      expect(result.date?.toISOString().split('T')[0]).toBe('2026-01-15');
    });
  });

  describe('total extraction', () => {
    it('extracts TOTAL with dollar sign', () => {
      const text = 'Item $5\nTOTAL $45.99';
      const result = parseReceipt(text);
      expect(result.total).toBe(45.99);
    });

    it('extracts Amount Due', () => {
      const text = 'Item $5\nAmount Due: $45.99';
      const result = parseReceipt(text);
      expect(result.total).toBe(45.99);
    });
  });

  describe('line item extraction', () => {
    it('extracts simple line item', () => {
      const text = 'STORE\nHammer $12.99\nTotal $12.99';
      const result = parseReceipt(text);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toBe('Hammer');
      expect(result.lineItems[0].totalPrice).toBe(12.99);
    });

    it('extracts quantity from @ pattern', () => {
      const text = 'STORE\nNails 2 @ $1.50 $3.00\nTotal $3.00';
      const result = parseReceipt(text);
      expect(result.lineItems[0].quantity).toBe(2);
      expect(result.lineItems[0].unitPrice).toBe(1.50);
    });
  });

  describe('edge cases', () => {
    it('returns nulls for empty text', () => {
      const result = parseReceipt('');
      expect(result.merchantName).toBeNull();
      expect(result.total).toBeNull();
      expect(result.lineItems).toHaveLength(0);
    });
  });
});
