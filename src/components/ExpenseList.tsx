import { useState, useEffect, useRef } from 'react';
import { getExpenses, getPendingApprovalExpenses, deleteExpense, approveExpense, Expense } from '../services/supabase';
import { submitExpenseToQbo } from '../services/qboService';
import { useToast } from './Toast';

interface ExpenseListProps {
  onScanNew: () => void;
  onEdit?: (expense: Expense) => void;
  refreshTrigger?: number;
  isAdmin?: boolean;
}

export function ExpenseList({ onScanNew, onEdit, refreshTrigger, isAdmin }: ExpenseListProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const loadExpenses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mainData, pendingData] = await Promise.all([
        getExpenses(),
        isAdmin ? getPendingApprovalExpenses() : Promise.resolve([]),
      ]);
      setExpenses(mainData);
      setPendingExpenses(pendingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [refreshTrigger, isAdmin]);

  // Cleanup confirm timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const startDeleteConfirm = (id: string) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDeleteId(id);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmingDeleteId(null);
    }, 3000);
  };

  const cancelDeleteConfirm = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDeleteId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDeleteId(null);
    try {
      await deleteExpense(id);
      setExpenses(expenses.filter(e => e.id !== id));
      toast('success', 'Expense deleted');
    } catch {
      toast('error', 'Failed to delete expense');
    }
  };

  const handleApprove = async (expense: Expense) => {
    if (!expense.id) return;
    setApprovingId(expense.id);
    try {
      await approveExpense(expense.id);
      setPendingExpenses(prev => prev.filter(e => e.id !== expense.id));
      setExpenses(prev => [{ ...expense, approval_status: 'approved' as const }, ...prev].sort((a, b) => (b.date > a.date ? 1 : -1)));
      toast('success', 'Expense approved');
    } catch {
      toast('error', 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSubmitToQbo = async (expense: Expense) => {
    if (!expense.id) return;
    setSubmittingId(expense.id);
    try {
      const result = await submitExpenseToQbo(expense.id);
      setExpenses(prev =>
        prev.map(e =>
          e.id === expense.id
            ? { ...e, qbo_purchase_id: result.purchase_id, qbo_pushed_at: result.pushed_at, qbo_error: null }
            : e
        )
      );
      toast('success', 'Submitted to QuickBooks');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submit failed';
      toast('error', message);
      // Refresh to get updated error/attempts from DB
      loadExpenses();
    } finally {
      setSubmittingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading expenses...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>
          Expenses
        </h1>
        <button
          onClick={onScanNew}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          + Scan Receipt
        </button>
      </div>

      {/* Summary */}
      <div style={{
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem'
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Total ({expenses.length} expenses)
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0.25rem 0 0 0' }}>
          ${totalAmount.toFixed(2)}
        </p>
      </div>

      {/* Pending Approval (ADAM admin only) */}
      {isAdmin && pendingExpenses.length > 0 && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#92400e', margin: '0 0 0.75rem 0' }}>
            Pending Approval ({pendingExpenses.length})
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#b45309', margin: '0 0 0.75rem 0' }}>
            Previous-month expenses — approve to add to main list
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingExpenses.map((expense) => (
              <div
                key={expense.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  border: '1px solid #fcd34d',
                }}
              >
                <div>
                  <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 0.25rem 0' }}>{expense.vendor}</p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                    {formatDate(expense.date)} • ${Number(expense.amount).toFixed(2)}
                  </p>
                  {expense.created_by_email && (
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
                      Uploaded by {expense.created_by_email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => expense.id && handleApprove(expense)}
                  disabled={approvingId === expense.id}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: approvingId === expense.id ? 'wait' : 'pointer',
                    opacity: approvingId === expense.id ? 0.7 : 1,
                  }}
                >
                  {approvingId === expense.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
          <button onClick={loadExpenses} style={{ marginTop: '0.5rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )}

      {/* Expense List */}
      {expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No expenses yet</p>
          <button
            onClick={onScanNew}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Scan Your First Receipt
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {expenses.map((expense) => (
            <div
              key={expense.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 0.25rem 0' }}>
                    {expense.vendor}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                    {formatDate(expense.date)} • {expense.category}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
                    {expense.payment_method}
                  </p>
                  {expense.memo && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0 0', fontStyle: 'italic' }}>
                      {expense.memo}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '700', fontSize: '1.125rem', color: '#111827', margin: 0 }}>
                    ${Number(expense.amount).toFixed(2)}
                  </p>
                  {expense.tax && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                      Tax: ${Number(expense.tax).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f3f4f6',
                flexWrap: 'wrap',
              }}>
                {expense.image_url && (
                  <button
                    onClick={() => setSelectedImage(expense.image_url)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    View Receipt
                  </button>
                )}
                {/* Edit button — only when not yet submitted */}
                {!expense.qbo_pushed_at && onEdit && (
                  <button
                    onClick={() => onEdit(expense)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#fffbeb',
                      color: '#d97706',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                )}
                {/* Delete with inline confirm */}
                {confirmingDeleteId === expense.id ? (
                  <>
                    <span style={{
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#dc2626',
                      fontWeight: '500',
                    }}>
                      Sure?
                    </span>
                    <button
                      onClick={() => expense.id && handleDelete(expense.id)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={cancelDeleteConfirm}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => expense.id && startDeleteConfirm(expense.id)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                )}
                {/* QBO Submit Button */}
                {expense.qbo_pushed_at ? (
                  <span
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                      borderRadius: '4px',
                      fontWeight: '600',
                    }}
                  >
                    Submitted{expense.qbo_attachment_id ? ' (with receipt)' : ''}
                  </span>
                ) : expense.qbo_error && (expense.qbo_sync_attempts ?? 0) >= 3 ? (
                  <span
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#9ca3af',
                      borderRadius: '4px',
                      fontWeight: '600',
                    }}
                    title={expense.qbo_error}
                  >
                    Failed
                  </span>
                ) : expense.qbo_error ? (
                  <button
                    onClick={() => handleSubmitToQbo(expense)}
                    disabled={submittingId === expense.id}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: submittingId === expense.id ? 'wait' : 'pointer',
                      fontWeight: '600',
                      opacity: submittingId === expense.id ? 0.6 : 1,
                    }}
                    title={expense.qbo_error}
                  >
                    {submittingId === expense.id ? 'Retrying...' : 'Retry'}
                  </button>
                ) : expense.qbo_account_id ? (
                  <button
                    onClick={() => handleSubmitToQbo(expense)}
                    disabled={submittingId === expense.id}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: submittingId === expense.id ? 'wait' : 'pointer',
                      fontWeight: '600',
                      opacity: submittingId === expense.id ? 0.6 : 1,
                    }}
                  >
                    {submittingId === expense.id ? 'Submitting...' : 'Submit to QBO'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
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
            src={selectedImage}
            alt="Receipt"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </div>
  );
}
