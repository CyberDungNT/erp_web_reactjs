import { useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '@/hooks/useBinding';

/**
 * Nhóm radio button.
 *   <CyberRadioButton {...form.bind('GioiTinh')} items={[{ value: 'M', text: 'Nam' }, { value: 'F', text: 'Nữ' }]} />
 *   // hoặc truyền bảng dữ liệu:
 *   <CyberRadioButton {...form.bind('MaKho')} dataSource={khoTable} valueField="MaKho" displayField="TenKho" />
 * Props: items | dataSource+valueField+displayField, direction ('horizontal'|'vertical'), disabled
 */
export default function CyberRadioButton(props) {
  const { items, dataSource, valueField = 'value', displayField = 'text', direction = 'horizontal', disabled } = props;
  const [value, setValue] = useBinding(props);
  const [name] = useState(() => props.name || newId('radio'));

  const options = (items || dataSource || []).map((r) => ({
    value: r[valueField] ?? r.value,
    text: r[displayField] ?? r.text ?? r.label,
    row: r,
  }));

  return (
    <CyberField {...props}>
      <div className={`cy-radio-group cy-radio-group--${direction}`} role="radiogroup">
        {options.map((o) => (
          <label key={String(o.value)} className="cy-check">
            <input type="radio" name={name} disabled={disabled}
              checked={String(value ?? '') === String(o.value)}
              onChange={() => setValue(o.value, o.row)} />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
    </CyberField>
  );
}
