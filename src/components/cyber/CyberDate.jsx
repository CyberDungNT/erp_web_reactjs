import { useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '@/hooks/useBinding';

/**
 * Ô nhập ngày. Giá trị TRẢ VỀ (form.data) dạng chuỗi 'yyyy-MM-dd HH:mm:ss' (gửi thẳng xuống SQL được).
 *   chỉ chọn ngày  -> giờ = 00:00:00 (giá trị cũ đã có giờ thì giữ nguyên giờ đó khi đổi ngày)
 *   showTime       -> chọn cả giờ : phút : giây
 * Nhận vào mọi dạng thường gặp: '2026-10-15', '2026-10-15T08:30:00' (SQL trả về), '2026-10-15 08:30:00', Date.
 * (Giá trị nạp vào được giữ nguyên tới khi người dùng đổi – không tự đổi định dạng, tránh form bị coi là "có thay đổi".)
 *
 *   <CyberDate {...form.bind('Ngay_Ct')} label="Ngày CT" min="2026-01-01" />
 *   <CyberDate {...form.bind('Gio_Vao')} label="Giờ vào" showTime />
 * Props: min, max, readOnly, disabled, showToday (nút "Hôm nay" / "Bây giờ"), showTime
 */
const p2 = (n) => String(n).padStart(2, '0');

/** Phần ngày 'yyyy-MM-dd' (hiển thị trên ô ngày, so min / max) */
export function toDateString(v) {
  if (!v) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
  return String(v).slice(0, 10);
}

/** Phần giờ 'HH:mm:ss' của giá trị (không có -> '00:00:00') */
export function toTimeString(v) {
  if (!v) return '00:00:00';
  if (v instanceof Date) return `${p2(v.getHours())}:${p2(v.getMinutes())}:${p2(v.getSeconds())}`;
  const m = /[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(v));
  return m ? `${p2(m[1])}:${m[2]}:${m[3] || '00'}` : '00:00:00';
}

/** Chuẩn 'yyyy-MM-dd HH:mm:ss' – định dạng CyberDate trả về */
export function toDateTimeString(v) {
  const d = toDateString(v);
  return d ? `${d} ${toTimeString(v)}` : '';
}

export default function CyberDate(props) {
  const { min, max, readOnly, disabled, showToday = true, showTime = false } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('date'));

  // chọn ngày: giữ giờ đang có (nếu có); chọn ngày + giờ: lấy đúng giờ đã chọn
  const onChange = (e) => {
    const v = e.target.value;
    if (!v) return setValue(null);
    setValue(showTime ? toDateTimeString(v.replace('T', ' ')) : `${v} ${toTimeString(value)}`);
  };
  const now = () => {
    const d = new Date();
    setValue(showTime ? toDateTimeString(d) : `${toDateString(d)} ${toTimeString(value)}`);
  };

  return (
    <CyberField {...props} htmlFor={id}>
      <div className="cy-input-group">
        <input
          id={id}
          type={showTime ? 'datetime-local' : 'date'}
          step={showTime ? 1 : undefined}
          className="cy-input"
          value={showTime ? (value ? `${toDateString(value)}T${toTimeString(value)}` : '') : toDateString(value)}
          min={showTime ? (min ? `${toDateString(min)}T00:00:00` : undefined) : toDateString(min)}
          max={showTime ? (max ? `${toDateString(max)}T23:59:59` : undefined) : toDateString(max)}
          readOnly={readOnly}
          disabled={disabled}
          onChange={onChange}
        />
        {showToday && !readOnly && !disabled && (
          <button type="button" className="cy-btn-icon" title={showTime ? 'Bây giờ' : 'Hôm nay'} onClick={now}>
            ●
          </button>
        )}
      </div>
    </CyberField>
  );
}
