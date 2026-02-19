import { useRef, useState, useEffect } from 'react';
import { ImagePreview } from './ImagePreview';
import { compressImage } from '../utils/imageCompression';
import { detectBlur, detectDarkness } from '../utils/imageQuality';
import { extractText, terminateOCR } from '../services/ocrService';
import { parseReceipt } from '../utils/receiptParser';
import { ReceiptReview } from './ReceiptReview';
import { ReceiptData } from '../types/receipt';
import { saveExpense, uploadReceiptImage, getApprovalStatusForDate } from '../services/supabase';

// Extended type for QuickBooks data from the form
interface ExpenseData extends ReceiptData {
  category?: string;
  categoryId?: string;
  paymentAccount?: string;
  paymentAccountId?: string;
  classId?: string | null;
  className?: string | null;
  vendorId?: string | null;
  memo?: string;
  // Legacy field kept for compatibility
  paymentMethod?: string;
}

interface CameraCaptureProps {
  onComplete: () => void;
  onCancel: () => void;
  userInitials: string | null;
  userId: string;
}

export function CameraCapture({ onComplete, onCancel, userInitials, userId }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ocrResult, setOcrResult] = useState<ReceiptData | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [showReview, setShowReview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => {
      terminateOCR();
    };
  }, []);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      // Compress the image
      const compressionResult = await compressImage(file);

      // Log compression stats
      const reductionPercent = ((compressionResult.originalSize - compressionResult.compressedSize) / compressionResult.originalSize * 100).toFixed(1);
      console.log('Image compression stats:', {
        original: `${(compressionResult.originalSize / 1024 / 1024).toFixed(2)} MB`,
        compressed: `${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)} MB`,
        reduction: `${reductionPercent}%`
      });

      // Run quality checks in parallel
      const [blurResult, darknessResult] = await Promise.all([
        detectBlur(compressionResult.file),
        detectDarkness(compressionResult.file)
      ]);

      // Build warnings array
      const qualityWarnings: string[] = [];
      if (blurResult.isBlurry) {
        qualityWarnings.push('Image may be blurry. Hold phone steady and ensure good lighting.');
      }
      if (darknessResult.isDark) {
        qualityWarnings.push('Image appears too dark. Try using flash or finding better lighting.');
      }

      // Log quality scores
      console.log('Quality:', {
        blurVariance: blurResult.variance,
        brightness: darknessResult.brightness
      });

      // Update state
      setWarnings(qualityWarnings);
      const url = URL.createObjectURL(compressionResult.file);
      setPreviewUrl(url);
      setCapturedFile(compressionResult.file);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedFile(null);
    setWarnings([]);
    setOcrText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProceed = async () => {
    if (!capturedFile) return;

    setShowReview(false);
    setIsProcessing(true);
    setOcrProgress(0);

    try {
      console.log('[CameraCapture] Starting OCR processing...');

      const rawOCRResult = await extractText(capturedFile, (progress) => {
        setOcrProgress(progress);
      });

      console.log('[CameraCapture] OCR complete, raw text:', rawOCRResult.text);

      // Store raw OCR text for reference
      setOcrText(rawOCRResult.text);

      // Parse into structured data (best effort)
      const parsedData = parseReceipt(rawOCRResult.text);
      console.log('[CameraCapture] Parsed receipt data:', parsedData);

      setOcrResult(parsedData);
      setShowReview(true);
    } catch (error) {
      console.error('[CameraCapture] OCR processing failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to process receipt: ${message}`);
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleConfirm = async (data: ReceiptData) => {
    const expenseData = data as ExpenseData;
    console.log('[CameraCapture] Saving expense:', expenseData);

    setIsSaving(true);
    setSaveError(null);

    try {
      // Upload image to Supabase Storage
      let imageUrl: string | null = null;
      if (capturedFile) {
        console.log('[CameraCapture] Uploading receipt image...');
        imageUrl = await uploadReceiptImage(capturedFile);
        console.log('[CameraCapture] Image uploaded:', imageUrl);
      }

      // Save expense to database
      const dateStr = expenseData.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
      const approvalStatus = getApprovalStatusForDate(dateStr);
      console.log('[CameraCapture] Saving expense to database...', { approvalStatus, dateStr });

      const memo = userInitials ?? null;

      await saveExpense({
        vendor: expenseData.merchantName || 'Unknown',
        date: dateStr,
        amount: expenseData.total || 0,
        category: expenseData.category || 'Other Expenses',
        payment_method: expenseData.paymentAccount || expenseData.paymentMethod || 'Other',
        tax: expenseData.tax || null,
        memo,
        image_url: imageUrl,
        approval_status: approvalStatus,
        qbo_vendor_id: expenseData.vendorId ?? null,
        qbo_account_id: expenseData.categoryId ?? null,
        qbo_account_name: expenseData.category ?? null,
        qbo_payment_account_id: expenseData.paymentAccountId ?? null,
        qbo_class_id: expenseData.classId ?? null,
        qbo_purchase_id: null,
        qbo_pushed_at: null,
        qbo_error: null,
        qbo_sync_attempts: 0,
        created_by: userId,
      });

      console.log('[CameraCapture] Expense saved successfully!');

      // Cleanup and navigate back to list
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      onComplete();
    } catch (error) {
      console.error('[CameraCapture] Failed to save expense:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  // Show review form if OCR is complete
  if (showReview && ocrResult && previewUrl) {
    return (
      <>
        <ReceiptReview
          initialData={ocrResult}
          previewUrl={previewUrl}
          ocrText={ocrText}
          userInitials={userInitials}
          onConfirm={handleConfirm}
          onBack={() => setShowReview(false)}
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
            zIndex: 1000
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p style={{ color: '#374151', fontWeight: '500' }}>Saving expense...</p>
          </div>
        )}
        {/* Error message */}
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
            zIndex: 1000
          }}>
            <p style={{ color: '#dc2626', fontWeight: '500', marginBottom: '0.5rem' }}>
              Failed to save
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
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </>
    );
  }

  // Show preview if we have a captured image
  if (previewUrl) {
    return (
      <ImagePreview
        previewUrl={previewUrl}
        onRetake={handleRetake}
        onProceed={handleProceed}
        isProcessing={isProcessing}
        warnings={warnings}
        ocrProgress={ocrProgress}
      />
    );
  }

  // Show capture button
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '1rem'
    }}>
      {/* Camera capture input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* File upload input (no capture) */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button
        onClick={handleButtonClick}
        disabled={isProcessing}
        style={{
          width: '100%',
          maxWidth: '320px',
          minHeight: '56px',
          padding: '1rem',
          fontSize: '1.125rem',
          fontWeight: '600',
          backgroundColor: isProcessing ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}
      >
        {isProcessing ? 'Processing...' : '📷 Take Photo'}
      </button>

      <button
        onClick={handleUploadClick}
        disabled={isProcessing}
        style={{
          width: '100%',
          maxWidth: '320px',
          minHeight: '56px',
          padding: '1rem',
          marginTop: '0.75rem',
          fontSize: '1.125rem',
          fontWeight: '600',
          backgroundColor: isProcessing ? '#e5e7eb' : '#ffffff',
          color: isProcessing ? '#9ca3af' : '#374151',
          border: '2px solid #d1d5db',
          borderRadius: '8px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
        }}
      >
        {isProcessing ? 'Processing...' : '📁 Upload File'}
      </button>

      <p style={{
        marginTop: '1rem',
        color: '#6b7280',
        fontSize: '0.875rem',
        textAlign: 'center'
      }}>
        Take a photo or upload an existing receipt image
      </p>

      <button
        onClick={onCancel}
        style={{
          marginTop: '2rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          backgroundColor: 'transparent',
          color: '#6b7280',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        ← Back to Expenses
      </button>
    </div>
  );
}
