import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '../../hooks/useBinding';

/**
 * Ô nhập số, tự format phân cách hàng nghìn ngay khi gõ, giữ đúng vị trí con trỏ.
 * Giá trị bind là kiểu number (hoặc null khi để trống).
 *
 *   <CyberNumeric {...form.bind('DonGia')} label="Đơn giá" decimals={2} />
 *   <CyberNumeric {...form.bind('SoLuong')} decimals={0} min={0} />
 *
 * Props:
 *   decimals      số chữ số thập phân (mặc định 0)
 *   thousandSep   ký tự phân cách nghìn (mặc định ',')
 *   decimalSep    ký tự thập phân (mặc định '.')  -> kiểu VN: thousandSep='.' decimalSep=','
 *   allowNegative cho phép số âm (mặc định true)
 *   min, max      giới hạn, áp dụng khi rời ô
 *   fixedDecimals khi rời ô thì bù đủ số 0 thập phân (mặc định true)
 *   readOnly, disabled, placeholder, onEnter
 */
export function formatNumber(num, { decimals = 0, thousandSep = ',', decimalSep = '.', fixed = true } = {}) {
  if (num === null || num === undefined || num === '' || isNaN(num)) return '';
  const n = Number(num);
  let [intPart, decPart = ''] = Math.abs(n).toFixed(decimals).split('.');
  if (!fixed) decPart = decPart.replace(/0+$/, '');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return (n < 0 ? '-' : '') + intPart + (decPart ? decimalSep + decPart : '');
}

export default function CyberNumeric(props) {
  const {
    decimals = 0, thousandSep = ',', decimalSep = '.', allowNegative = true,
    min, max, fixedDecimals = true, readOnly, disabled, placeholder, onEnter,
  } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('num'));
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);
  const fmtOpts = { decimals, thousandSep, decimalSep, fixed: fixedDecimals };
  const [text, setText] = useState(() => formatNumber(value, fmtOpts));
  const lastEmitted = useRef(value);

  // Đồng bộ khi giá trị bị đổi từ bên ngoài (two-way binding)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(formatNumber(value, fmtOpts));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  const isSignificant = (ch, idx) =>
    /\d/.test(ch) || ch === decimalSep || (ch === '-' && idx === 0);

  /** Làm sạch chuỗi người dùng gõ -> {formatted, number} */
  const parse = (raw) => {
    const trimmed = raw.trim();
    const neg = allowNegative && trimmed.startsWith('-');
    let intDigits = '';
    let decDigits = '';
    let seenDec = false;
    for (const ch of trimmed) {
      if (/\d/.test(ch)) {
        if (seenDec) { if (decDigits.length < decimals) decDigits += ch; }
        else intDigits += ch;
      } else if (ch === decimalSep && decimals > 0 && !seenDec) {
        seenDec = true;
      }
    }
    intDigits = intDigits.replace(/^0+(?=\d)/, '');
    if (intDigits === '' && seenDec) intDigits = '0';

    const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    const formatted = (neg ? '-' : '') + grouped + (seenDec ? decimalSep + decDigits : '');
    const number = intDigits === '' && !seenDec ? null : Number((neg ? '-' : '') + intDigits + '.' + (decDigits || '0'));
    return { formatted, number };
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    // đếm số ký tự "có nghĩa" trước con trỏ
    let count = 0;
    for (let i = 0; i < caret; i++) if (isSignificant(raw[i], i)) count++;

    const { formatted, number } = parse(raw);

    // tìm vị trí mới trong chuỗi đã format
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < count) {
      if (isSignificant(formatted[pos], pos)) seen++;
      pos++;
    }
    pendingCaret.current = pos;

    setText(formatted);
    if (number !== lastEmitted.current) {
      lastEmitted.current = number;
      setValue(number);
    }
  };

  const handleBlur = (e) => {
    let n = value;
    if (n !== null && n !== undefined && n !== '') {
      if (min !== undefined && n < min) n = min;
      if (max !== undefined && n > max) n = max;
    }
    if (n !== value) {
      lastEmitted.current = n;
      setValue(n);
    }
    setText(formatNumber(n, fmtOpts));
    props.onBlur?.(e);
  };

  return (
    <CyberField {...props} htmlFor={id}>
      <input
        ref={inputRef}
        id={id}
        className="cy-input cy-input--number"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.(value, e)}
      />
    </CyberField>
  );
}
