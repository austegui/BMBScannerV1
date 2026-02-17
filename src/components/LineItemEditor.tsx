import { LineItem } from '../types/receipt';

interface LineItemEditorProps {
  value: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export function LineItemEditor({ value, onChange }: LineItemEditorProps) {
  const handleItemChange = (index: number, field: keyof LineItem, newValue: string | number) => {
    const updatedItems = [...value];
    const item = { ...updatedItems[index] };

    if (field === 'description') {
      item.description = newValue as string;
    } else if (field === 'quantity') {
      item.quantity = newValue ? Number(newValue) : undefined;
      // Recalculate total if we have both quantity and unitPrice
      if (item.quantity && item.unitPrice) {
        item.totalPrice = item.quantity * item.unitPrice;
      }
    } else if (field === 'unitPrice') {
      item.unitPrice = newValue ? Number(newValue) : undefined;
      // Recalculate total if we have both quantity and unitPrice
      if (item.quantity && item.unitPrice) {
        item.totalPrice = item.quantity * item.unitPrice;
      }
    } else if (field === 'totalPrice') {
      item.totalPrice = Number(newValue);
    }

    updatedItems[index] = item;
    onChange(updatedItems);
  };

  const handleRemove = (index: number) => {
    const updatedItems = value.filter((_, i) => i !== index);
    onChange(updatedItems);
  };

  const handleAddItem = () => {
    const newItem: LineItem = {
      description: '',
      totalPrice: 0,
    };
    onChange([...value, newItem]);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
        Line Items
      </h3>

      {value.map((item, index) => (
        <div
          key={index}
          style={{
            padding: '0.75rem',
            marginBottom: '0.5rem',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Description */}
          <div style={{ marginBottom: '0.5rem' }}>
            <label
              htmlFor={`item-desc-${index}`}
              style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}
            >
              Description
            </label>
            <input
              id={`item-desc-${index}`}
              type="text"
              value={item.description}
              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.875rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>

          {/* Quantity and Unit Price (side by side on larger screens) */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor={`item-qty-${index}`}
                style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}
              >
                Qty
              </label>
              <input
                id={`item-qty-${index}`}
                type="number"
                value={item.quantity ?? ''}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                htmlFor={`item-price-${index}`}
                style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}
              >
                Unit Price
              </label>
              <input
                id={`item-price-${index}`}
                type="number"
                step="0.01"
                value={item.unitPrice ?? ''}
                onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Total Price and Remove Button */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor={`item-total-${index}`}
                style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}
              >
                Total Price
              </label>
              <input
                id={`item-total-${index}`}
                type="number"
                step="0.01"
                value={item.totalPrice}
                onChange={(e) => handleItemChange(index, 'totalPrice', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => handleRemove(index)}
              style={{
                minWidth: '44px',
                minHeight: '44px',
                padding: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {/* Add Item Button */}
      <button
        type="button"
        onClick={handleAddItem}
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          backgroundColor: '#f3f4f6',
          color: '#374151',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
          marginTop: '0.5rem',
        }}
      >
        + Add Item
      </button>
    </div>
  );
}
