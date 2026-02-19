import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ReceiptData } from '../types/receipt';
import { useState, useEffect, useMemo } from 'react';
import {
  getQboAccounts,
  getQboClasses,
  getQboVendors,
  getConnectionStatus,
  QboAccount,
  QboClass,
  QboVendor,
} from '../services/qboService';

// Zod schema for QuickBooks expense form
const expenseSchema = z.object({
  vendor: z.string().min(1, 'Vendor name required'),
  vendorId: z.string().nullable(),
  date: z.string().min(1, 'Date required'),
  amount: z.number().min(0.01, 'Amount required'),
  category: z.string().min(1, 'Category required'),
  categoryId: z.string().min(1, 'Category required'),
  paymentAccount: z.string().min(1, 'Payment account required'),
  paymentAccountId: z.string().min(1, 'Payment account required'),
  classId: z.string().nullable(),
  className: z.string().nullable(),
  tax: z.number().min(0).nullable(),
  memo: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface EditDefaults {
  categoryId: string;
  categoryName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  classId: string | null;
  className: string | null;
  memo: string | null;
  vendorId: string | null;
}

interface ReceiptReviewProps {
  initialData: ReceiptData;
  previewUrl: string;
  ocrText?: string;
  editDefaults?: EditDefaults;
  onConfirm: (data: ReceiptData) => void;
  onBack: () => void;
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip punctuation and numbers.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

/**
 * Score how well an OCR merchant name matches a QBO vendor name.
 * Higher score = better match.
 */
function vendorMatchScore(ocrName: string, vendorName: string): number {
  const a = normalize(ocrName);
  const b = normalize(vendorName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b)) return 50 + b.length;
  if (b.includes(a)) return 50 + a.length;
  // Check word overlap
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  let overlap = 0;
  for (const w of aWords) {
    if (w.length > 1 && bWords.some((bw) => bw.includes(w) || w.includes(bw))) {
      overlap += w.length;
    }
  }
  return overlap;
}

export function ReceiptReview({ initialData, previewUrl, ocrText, editDefaults, onConfirm, onBack }: ReceiptReviewProps) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);
  const [isNewVendor, setIsNewVendor] = useState(false);

  // QBO entity state
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [classes, setClasses] = useState<QboClass[]>([]);
  const [vendors, setVendors] = useState<QboVendor[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [qboConnected, setQboConnected] = useState<boolean | null>(null);

  // Separate accounts by type
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'Expense'),
    [accounts]
  );
  const creditCardAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'Credit Card'),
    [accounts]
  );

  // Sort vendors by match score against OCR merchant name
  const sortedVendors = useMemo(() => {
    const ocrName = initialData.merchantName ?? '';
    if (!ocrName) return vendors;
    return [...vendors].sort(
      (a, b) => vendorMatchScore(ocrName, b.display_name) - vendorMatchScore(ocrName, a.display_name)
    );
  }, [vendors, initialData.merchantName]);

  // Best matching vendor
  const bestVendorMatch = useMemo(() => {
    const ocrName = initialData.merchantName ?? '';
    if (!ocrName || sortedVendors.length === 0) return null;
    const score = vendorMatchScore(ocrName, sortedVendors[0].display_name);
    return score > 5 ? sortedVendors[0] : null;
  }, [sortedVendors, initialData.merchantName]);

  // Fetch QBO entities on mount
  useEffect(() => {
    let cancelled = false;

    async function loadEntities() {
      setEntitiesLoading(true);

      // Check connection first
      const status = await getConnectionStatus();
      if (cancelled) return;
      setQboConnected(status.connected);

      if (!status.connected) {
        setEntitiesLoading(false);
        return;
      }

      // Fetch all entities in parallel
      const [accts, cls, vndrs] = await Promise.all([
        getQboAccounts(),
        getQboClasses(),
        getQboVendors(),
      ]);

      if (cancelled) return;
      setAccounts(accts);
      setClasses(cls);
      setVendors(vndrs);
      setEntitiesLoading(false);
    }

    loadEntities();
    return () => { cancelled = true; };
  }, []);

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  };

  // Convert initialData to form-compatible format
  const defaultValues: ExpenseFormData = {
    vendor: bestVendorMatch?.display_name ?? initialData.merchantName ?? '',
    vendorId: bestVendorMatch?.qbo_id ?? null,
    date: formatDateForInput(initialData.date),
    amount: initialData.total ?? 0,
    category: '',
    categoryId: '',
    paymentAccount: '',
    paymentAccountId: '',
    classId: null,
    className: null,
    tax: initialData.tax ?? null,
    memo: '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
  });

  // When entities finish loading and we have a best vendor match, pre-select it
  useEffect(() => {
    if (!entitiesLoading && bestVendorMatch && !editDefaults) {
      setValue('vendor', bestVendorMatch.display_name);
      setValue('vendorId', bestVendorMatch.qbo_id);
    }
  }, [entitiesLoading, bestVendorMatch, editDefaults, setValue]);

  // When editing, pre-fill QBO dropdowns from saved values
  useEffect(() => {
    if (!entitiesLoading && editDefaults) {
      if (editDefaults.categoryId) {
        setValue('categoryId', editDefaults.categoryId);
        setValue('category', editDefaults.categoryName);
      }
      if (editDefaults.paymentAccountId) {
        setValue('paymentAccountId', editDefaults.paymentAccountId);
        setValue('paymentAccount', editDefaults.paymentAccountName);
      }
      if (editDefaults.classId) {
        setValue('classId', editDefaults.classId);
        setValue('className', editDefaults.className);
      }
      if (editDefaults.memo) {
        setValue('memo', editDefaults.memo);
      }
      if (editDefaults.vendorId) {
        const v = vendors.find(vn => vn.qbo_id === editDefaults.vendorId);
        if (v) {
          setValue('vendorId', v.qbo_id);
          setValue('vendor', v.display_name);
        }
      }
    }
  }, [entitiesLoading, editDefaults, vendors, setValue]);

  const watchedVendorId = watch('vendorId');
  const watchedCategoryId = watch('categoryId');
  const watchedPaymentAccountId = watch('paymentAccountId');
  const watchedClassId = watch('classId');

  const onSubmit = (data: ExpenseFormData) => {
    // Convert back to ReceiptData format with QBO fields for CameraCapture
    const receiptData: ReceiptData & {
      category: string;
      categoryId: string;
      paymentAccount: string;
      paymentAccountId: string;
      classId: string | null;
      className: string | null;
      vendorId: string | null;
      memo?: string;
    } = {
      merchantName: data.vendor,
      date: new Date(data.date),
      total: data.amount,
      tax: data.tax,
      lineItems: [],
      category: data.category,
      categoryId: data.categoryId,
      paymentAccount: data.paymentAccount,
      paymentAccountId: data.paymentAccountId,
      classId: data.classId,
      className: data.className,
      vendorId: data.vendorId,
      memo: data.memo,
    };
    onConfirm(receiptData);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qboId = e.target.value;
    const acct = expenseAccounts.find((a) => a.qbo_id === qboId);
    if (acct) {
      setValue('categoryId', acct.qbo_id);
      setValue('category', acct.name);
    }
  };

  const handlePaymentAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qboId = e.target.value;
    const acct = creditCardAccounts.find((a) => a.qbo_id === qboId);
    if (acct) {
      setValue('paymentAccountId', acct.qbo_id);
      setValue('paymentAccount', acct.name);
    }
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qboId = e.target.value;
    if (!qboId) {
      setValue('classId', null);
      setValue('className', null);
    } else {
      const cls = classes.find((c) => c.qbo_id === qboId);
      if (cls) {
        setValue('classId', cls.qbo_id);
        setValue('className', cls.name);
      }
    }
  };

  const handleVendorSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      setIsNewVendor(true);
      setValue('vendorId', null);
      setValue('vendor', '');
    } else {
      setIsNewVendor(false);
      const v = vendors.find((vn) => vn.qbo_id === val);
      if (v) {
        setValue('vendorId', v.qbo_id);
        setValue('vendor', v.display_name);
      }
    }
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

  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
  };

  const selectErrorStyle = {
    ...selectStyle,
    border: '1px solid #ef4444',
  };

  // Not connected to QBO
  if (qboConnected === false) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.125rem', color: '#374151', marginBottom: '1rem' }}>
          Connect to QuickBooks first
        </p>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Go to Settings and connect your QuickBooks Online account to use the expense form.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Loading skeleton
  if (entitiesLoading || qboConnected === null) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading QBO data...</div>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
            <span>OCR Text (tap to {showOcrText ? 'hide' : 'view'})</span>
            <span>{showOcrText ? '^' : 'v'}</span>
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
          <label htmlFor="vendorSelect" style={labelStyle}>
            Vendor / Payee *
          </label>
          {!isNewVendor ? (
            <>
              <select
                id="vendorSelect"
                value={watchedVendorId ?? ''}
                onChange={handleVendorSelectChange}
                style={errors.vendor ? selectErrorStyle : selectStyle}
              >
                <option value="">Select vendor...</option>
                {sortedVendors.map((v) => (
                  <option key={v.qbo_id} value={v.qbo_id}>
                    {v.display_name}
                  </option>
                ))}
                <option value="__new__">-- New Vendor --</option>
              </select>
              {/* Hidden inputs for form validation */}
              <input type="hidden" {...register('vendor')} />
              <input type="hidden" {...register('vendorId')} />
            </>
          ) : (
            <>
              <input
                id="vendor"
                type="text"
                {...register('vendor')}
                placeholder="Enter new vendor name"
                style={errors.vendor ? inputErrorStyle : inputStyle}
              />
              <button
                type="button"
                onClick={() => {
                  setIsNewVendor(false);
                  setValue('vendor', '');
                  setValue('vendorId', null);
                }}
                style={{
                  marginTop: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#2563eb',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Back to vendor list
              </button>
            </>
          )}
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

        {/* Category (Expense Accounts) */}
        <div style={fieldStyle}>
          <label htmlFor="categorySelect" style={labelStyle}>
            Category *
          </label>
          <select
            id="categorySelect"
            value={watchedCategoryId ?? ''}
            onChange={handleCategoryChange}
            style={errors.categoryId ? selectErrorStyle : selectStyle}
          >
            <option value="">Select category...</option>
            {expenseAccounts.map((acct) => (
              <option key={acct.qbo_id} value={acct.qbo_id}>
                {acct.fully_qualified_name || acct.name}
              </option>
            ))}
          </select>
          <input type="hidden" {...register('category')} />
          <input type="hidden" {...register('categoryId')} />
          {(errors.category || errors.categoryId) && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              Category required
            </p>
          )}
        </div>

        {/* Payment Account (Credit Card Accounts) */}
        <div style={fieldStyle}>
          <label htmlFor="paymentAccountSelect" style={labelStyle}>
            Payment Account *
          </label>
          <select
            id="paymentAccountSelect"
            value={watchedPaymentAccountId ?? ''}
            onChange={handlePaymentAccountChange}
            style={errors.paymentAccountId ? selectErrorStyle : selectStyle}
          >
            <option value="">Select payment account...</option>
            {creditCardAccounts.map((acct) => (
              <option key={acct.qbo_id} value={acct.qbo_id}>
                {acct.fully_qualified_name || acct.name}
              </option>
            ))}
          </select>
          <input type="hidden" {...register('paymentAccount')} />
          <input type="hidden" {...register('paymentAccountId')} />
          {(errors.paymentAccount || errors.paymentAccountId) && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
              Payment account required
            </p>
          )}
        </div>

        {/* Class (optional) */}
        {classes.length > 0 && (
          <div style={fieldStyle}>
            <label htmlFor="classSelect" style={labelStyle}>
              Class (optional)
            </label>
            <select
              id="classSelect"
              value={watchedClassId ?? ''}
              onChange={handleClassChange}
              style={selectStyle}
            >
              <option value="">No class</option>
              {classes.map((cls) => (
                <option key={cls.qbo_id} value={cls.qbo_id}>
                  {cls.fully_qualified_name || cls.name}
                </option>
              ))}
            </select>
            <input type="hidden" {...register('classId')} />
            <input type="hidden" {...register('className')} />
          </div>
        )}

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
