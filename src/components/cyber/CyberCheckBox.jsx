import { useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '../../hooks/useBinding';

/**
 * Ô checkbox.
 *   <CyberCheckBox {...form.bind('ConKD')} text="Còn kinh doanh" />
 *   <CyberCheckBox {...form.bind('IsActive')} trueValue={1} falseValue={0} />  // SQL bit
 * Props: text (chữ cạnh ô), trueValue (mặc định true), falseValue (mặc định false), disabled
 */
export default function CyberCheckBox(props) {
  const { text, trueValue = true, falseValue = false, disabled } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('chk'));
  // so sánh lỏng để "1" == 1 == true đều được coi là chọn
  // eslint-disable-next-line eqeqeq
  const checked = value === trueValue || (value != null && value == trueValue);

  return (
    <CyberField {...props} htmlFor={id}>
      <label className="cy-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={!!checked} disabled={disabled}
          onChange={(e) => setValue(e.target.checked ? trueValue : falseValue)} />
        {text && <span>{text}</span>}
      </label>
    </CyberField>
  );
}
