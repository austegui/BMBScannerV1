import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ReceiptData } from '../types/receipt';
import { useState } from 'react';

// QuickBooks expense categories
const CATEGORIES = [
  'Advertising & Marketing',
  'Auto & Transport',
  'Bank Charges & Fees',
  'Computer & Internet',
  'Contractors',
  'Education & Training',
  'Equipment',
  'Insurance',
  'Interest',
  'Legal & Professional',
  'Meals & Entertainment',
  'Office Supplies',
  'Other Expenses',
  'Rent & Lease',
  'Repairs & Maintenance',
  'Shipping & Delivery',
  'Taxes & Licenses',
  'Travel',
  'Utilities',
] as const;

// Payment methods
const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Check',
  'Bank Transfer',
  'Other',
] as const;

// Zod schema for QuickBooks expense form
const expenseSchema = z.object({
  vendor: z.string().min(1, 'Vendor name required'),
  date: z.string().min(1, 'Date required'),
  amount: z.number().min(0.01, 'Amount required'),
  category: z.string().min(1, 'Category required'),
  paymentMethod: z.string().min(1, 'Payment method required'),
  tax: z.number().min(0).nullable(),
  memo: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ReceiptReviewProps {
  initialData: ReceiptData;
  previewUrl: string;
  ocrText?: string;
  onConfirm: (data: ReceiptData) => void;
  onBack: () => void;
}

export function ReceiptReview({ initialData, previewUrl, ocrText, onConfirm, onBack }: ReceiptReviewProps) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  };

  // Convert initialData to form-compatible format
  const defaultValues: ExpenseFormData = {
    vendor: initialData.merchantName || '',
    date: formatDateForInput(initialData.date),
    amount: initialData.total ?? 0,
    category: '',
    paymentMethod: '',
    tax: initialData.tax ?? null,
    memo: '',
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
  });

  const onSubmit = (data: ExpenseFormData) => {
    // Convert back to ReceiptData format for compatibility
    const receiptData: ReceiptData = {
      merchantName: data.vendor,
      date: new Date(data.date),
      total: data.amount,
      tax: data.tax,
      lineItems: [],
      // Store QuickBooks-specific fields in a way that can be used later
      category: data.category,
      paymentMethod: data.paymentMethod,
      memo: data.memo,
    } as ReceiptData & { category: string; paymentMethod: string; memo?: string };
    onConfirm(receiptData);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
  };

  const inputErrorStyle = {
    ...inputStyle,
    border: '1px solid #ef4444',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    color: '#374151',
    marginBottom: '0.5rem',
  };

  const fieldStyle = {
    marginBottom: '1rem',
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
        Review Expense
      </h2>

      {/* Receipt Image Thumbnail */}
      <div style={{ marginBottom: '1.5rem' }}>
        <img
          src={previewUrl}
          alt="Receipt preview"
          onClick={() => setShowFullImage(true)}
          style={{
            width: '100%',
            maxHeight: '150px',
            objectFit: 'cover',
            borderRadius: '8px',
            border: '2px solid #e5e7eb',
            cursor: 'pointer',
          }}
        />
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', textAlign: 'center' }}>
          Tap to enlarge
        </p>
      </div>

      {/* OCR Text Reference */}
      {ocrText && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowOcrText(!showOcrText)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>📝 OCR Text (tap to {showOcrText ? 'hide' : 'view'})</span>
            <span>{showOcrText ? '▲' : '▼'}</span>
          </button>
          {showOcrText && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              maxHeight: '200px',
              overflow: 'auto',
            }}>
              <pre style={{
                margin: 0,
                fontSize: '0.75rem',
                color: '#374151',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
              }}>
                {ocrText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImage && (
        <div
          onClick={() => setShowFullImage(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            cursor: 'pointer',
          }}
        >
          <img
            src={previewUrl}
            alt="Receipt full view"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Vendor/Payee */}
        <div style={fieldStyle}>
          <label htmlFor="vendor" style={labelStyle}>
            Vendor / Payee *
          </label>
          <input
            id="vendor"
            type="text"
            {...register('vendor')}
            placeholder="e.g., Home Depot"
            style={errors.vendor ? inputErrorStyle : inputStyle}
          />
          {errors.vendor && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.vendor.message}
            </p>
          )}
        </div>

        {/* Date */}
        <div style={fieldStyle}>
          <label htmlFor="date" style={labelStyle}>
            Date *
          </label>
          <input
            id="date"
            type="date"
            {...register('date')}
            style={errors.date ? inputErrorStyle : inputStyle}
          />
          {errors.date && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Amount */}
        <div style={fieldStyle}>
          <label htmlFor="amount" style={labelStyle}>
            Total Amount *
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              fontSize: '1rem',
            }}>
              $
            </span>
            <input
              id="amount"
              type="number"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
              placeholder="0.00"
              style={{
                ...(errors.amount ? inputErrorStyle : inputStyle),
                paddingLeft: '1.5rem',
              }}
            />
          </div>
          {errors.amount && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.amount.message}
            </p>
          )}
        </div>

        {/* Category */}
        <div style={fieldStyle}>
          <label htmlFor="category" style={labelStyle}>
            Category *
          </label>
          <select
            id="category"
            {...register('category')}
            style={{
              ...(errors.category ? inputErrorStyle : inputStyle),
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            <option value="">Select category...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.category.message}
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div style={fieldStyle}>
          <label htmlFor="paymentMethod" style={labelStyle}>
            Payment Method *
          </label>
          <select
            id="paymentMethod"
            {...register('paymentMethod')}
            style={{
              ...(errors.paymentMethod ? inputErrorStyle : inputStyle),
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            <option value="">Select payment method...</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          {errors.paymentMethod && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.paymentMethod.message}
            </p>
          )}
        </div>

        {/* Tax (optional) */}
        <div style={fieldStyle}>
          <label htmlFor="tax" style={labelStyle}>
            Tax (optional)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              fontSize: '1rem',
            }}>
              $
            </span>
            <input
              id="tax"
              type="number"
              step="0.01"
              {...register('tax', {
                setValueAs: (v) => (v === '' || v === null ? null : Number(v))
              })}
              placeholder="0.00"
              style={{
                ...inputStyle,
                paddingLeft: '1.5rem',
              }}
            />
          </div>
        </div>

        {/* Memo (optional) */}
        <div style={fieldStyle}>
          <label htmlFor="memo" style={labelStyle}>
            Memo / Notes (optional)
          </label>
          <textarea
            id="memo"
            {...register('memo')}
            placeholder="Add notes about this expense..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: 1,
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>

          <button
            type="submit"
            style={{
              flex: 1,
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Save Expense
          </button>
        </div>
      </form>
    </div>
  );
}
