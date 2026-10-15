import { useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '../../hooks/useBinding';

/**
 * Ô nhập chữ.
 *   <CyberTextBox {...form.bind('TenKH')} label="Tên KH" maxLength={100} />
 *   <CyberTextBox value={x} onChange={setX} multiline rows={3} />
 * Props: placeholder, maxLength, readOnly, disabled, multiline, rows, upperCase, type ('text'|'password'|'email'), onEnter,
 *        addon (nút/biểu tượng gắn bên phải ô), autoComplete, name, onKeyUp
 */
export default function CyberTextBox(props) {
  const {
    placeholder, maxLength, readOnly, disabled, multiline, rows = 3,
    upperCase, type = 'text', onEnter, onBlur, autoFocus, inputStyle, addon, autoComplete, name, onKeyUp,
  } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('txt'));

  const handleChange = (e) => {
    let v = e.target.value;
    if (upperCase) v = v.toUpperCase();
    setValue(v);
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) onEnter?.(value, e);
  };

  const common = {
    id, className: 'cy-input', placeholder, maxLength, readOnly, disabled, autoFocus,
    value: value ?? '', onChange: handleChange, onKeyDown: handleKeyDown, onKeyUp, onBlur, style: inputStyle,
    autoComplete, name,
  };

  return (
    <CyberField {...props} htmlFor={id}>
      {multiline ? (
        <textarea {...common} rows={rows} />
      ) : addon ? (
        <div className="cy-input-group">
          <input {...common} type={type} />
          {addon}
        </div>
      ) : (
        <input {...common} type={type} />
      )}
    </CyberField>
  );
}
