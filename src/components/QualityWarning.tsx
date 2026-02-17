interface QualityWarningProps {
  warnings: string[];
}

export function QualityWarning({ warnings }: QualityWarningProps) {
  if (warnings.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#fff3cd',  // Amber/warning background
      border: '1px solid #ffc107',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px'
    }}>
      {warnings.map((warning, i) => (
        <p key={i} style={{
          margin: i === 0 ? 0 : '8px 0 0 0',
          color: '#856404',
          fontSize: '14px'
        }}>
          {warning}
        </p>
      ))}
    </div>
  );
}
