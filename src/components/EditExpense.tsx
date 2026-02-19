import { useState } from 'react';
import { ReceiptReview } from './ReceiptReview';
import { ReceiptData } from '../types/receipt';
import { updateExpense, Expense } from '../services/supabase';
import { useToast } from './Toast';

interface EditExpenseProps {
  expense: Expense;
  onComplete: () => void;
  onCancel: () => void;
}

// Extended type matching CameraCapture's ExpenseData
interface ExpenseData extends ReceiptData {
  category?: string;
  categoryId?: string;
  paymentAccount?: string;
  paymentAccountId?: string;
  classId?: string | null;
  className?: string | null;
  vendorId?: string | null;
  memo?: string;
}

export function EditExpense({ expense, onComplete, onCancel }: EditExpenseProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();

  const initialData: ReceiptData = {
    merchantName: expense.vendor,
    date: new Date(expense.date),
    total: expense.amount,
    tax: expense.tax,
    lineItems: [],
  };

  const editDefaults = {
    categoryId: expense.qbo_account_id ?? '',
    categoryName: expense.qbo_account_name ?? expense.category,
    paymentAccountId: expense.qbo_payment_account_id ?? '',
    paymentAccountName: expense.payment_method,
    classId: expense.qbo_class_id,
    className: null as string | null,
    memo: expense.memo,
    vendorId: expense.qbo_vendor_id,
  };

  const previewUrl = expense.image_url || '';

  const handleConfirm = async (data: ReceiptData) => {
    if (!expense.id) return;
    const expenseData = data as ExpenseData;

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateExpense(expense.id, {
        vendor: expenseData.merchantName || 'Unknown',
        date: expenseData.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        amount: expenseData.total || 0,
        category: expenseData.category || expense.category,
        payment_method: expenseData.paymentAccount || expense.payment_method,
        tax: expenseData.tax || null,
        memo: expenseData.memo || null,
        qbo_vendor_id: expenseData.vendorId ?? null,
        qbo_account_id: expenseData.categoryId ?? null,
        qbo_account_name: expenseData.category ?? null,
        qbo_payment_account_id: expenseData.paymentAccountId ?? null,
        qbo_class_id: expenseData.classId ?? null,
      });

      toast('success', 'Expense updated');
      onComplete();
    } catch (error) {
      console.error('[EditExpense] Failed to update expense:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ReceiptReview
        initialData={initialData}
        previewUrl={previewUrl}
        editDefaults={editDefaults}
        onConfirm={handleConfirm}
        onBack={onCancel}
      />
      {/* Saving overlay */}
      {isSaving && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <p style={{ color: '#374151', fontWeight: '500' }}>Updating expense...</p>
        </div>
      )}
      {/* Error banner */}
      {saveError && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          right: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '1rem',
          zIndex: 1000,
        }}>
          <p style={{ color: '#dc2626', fontWeight: '500', marginBottom: '0.5rem' }}>
            Failed to update
          </p>
          <p style={{ color: '#7f1d1d', fontSize: '0.875rem' }}>{saveError}</p>
          <button
            onClick={() => setSaveError(null)}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
