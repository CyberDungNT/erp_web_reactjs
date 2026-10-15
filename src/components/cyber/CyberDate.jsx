import { useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '../../hooks/useBinding';

/**
 * Ô nhập ngày. Giá trị lưu dạng chuỗi 'yyyy-MM-dd' (gửi thẳng xuống SQL được).
 * Nhận vào cả dạng '2026-10-15T00:00:00' từ SQL trả về.
 *   <CyberDate {...form.bind('NgayCT')} label="Ngày CT" min="2026-01-01" />
 * Props: min, max, readOnly, disabled, showToday (nút "Hôm nay")
 */
export function toDateString(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

export default function CyberDate(props) {
  const { min, max, readOnly, disabled, showToday = true } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('date'));

  return (
    <CyberField {...props} htmlFor={id}>
      <div className="cy-input-group">
        <input
          id={id}
          type="date"
          className="cy-input"
          value={toDateString(value)}
          min={toDateString(min)}
          max={toDateString(max)}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value || null)}
        />
        {showToday && !readOnly && !disabled && (
          <button type="button" className="cy-btn-icon" title="Hôm nay"
            onClick={() => setValue(toDateString(new Date()))}>
            ●
          </button>
        )}
      </div>
    </CyberField>
  );
}
