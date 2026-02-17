import { QualityWarning } from './QualityWarning';

interface ImagePreviewProps {
  previewUrl: string;
  onRetake: () => void;
  onProceed: () => void;
  isProcessing: boolean;
  warnings: string[];
  ocrProgress?: number;
}

export function ImagePreview({ previewUrl, onRetake, onProceed, isProcessing, warnings, ocrProgress = 0 }: ImagePreviewProps) {
  const hasWarnings = warnings.length > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      padding: '1rem',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <QualityWarning warnings={warnings} />

      <img
        src={previewUrl}
        alt="Captured receipt"
        style={{
          width: '100%',
          maxHeight: '60vh',
          objectFit: 'contain',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          onClick={onRetake}
          disabled={isProcessing}
          style={{
            width: '100%',
            minHeight: '48px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: isProcessing ? '#d1d5db' : '#ffffff',
            color: '#374151',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          Retake Photo
        </button>

        <button
          onClick={onProceed}
          disabled={isProcessing}
          style={{
            width: '100%',
            minHeight: '48px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: isProcessing ? '#93c5fd' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing && ocrProgress > 0
            ? `Processing... ${ocrProgress}%`
            : isProcessing
            ? 'Processing...'
            : hasWarnings
            ? 'Use Anyway'
            : 'Use This Photo'}
        </button>
      </div>
    </div>
  );
}
