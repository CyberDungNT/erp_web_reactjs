import { useEffect, useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '@/hooks/useBinding';
import { callProc } from '@/api/apiClient';

/**
 * Combobox chọn 1 giá trị từ bảng dữ liệu.
 *
 *   // truyền bảng dữ liệu sẵn
 *   <CyberCombobox {...form.bind('MaKho')} dataSource={khoTable} valueField="MaKho" displayField="TenKho" />
 *   // hoặc tự gọi proc để lấy dữ liệu
 *   <CyberCombobox {...form.bind('MaKho')} procName="GetKho" para="" valueField="MaKho" displayField="TenKho" />
 *
 * Props:
 *   dataSource     mảng dòng dữ liệu
 *   procName, para nếu không có dataSource thì tự gọi proc này
 *   valueField     tên cột lưu lại khi chọn
 *   displayField   tên cột hiển thị
 *   showValue      hiển thị dạng "value - text"
 *   allowEmpty     có dòng trống ở đầu (mặc định true), emptyText
 *   onChange(value, row)  trả thêm cả dòng được chọn
 */
export default function CyberCombobox(props) {
  const {
    dataSource, procName, para, valueField = 'value', displayField = 'text',
    showValue, allowEmpty = true, emptyText = '-- Chọn --', disabled,
  } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('cbo'));
  const [rows, setRows] = useState(dataSource || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (dataSource) { setRows(dataSource); return; }
    if (!procName) return;
    let cancelled = false;
    setLoading(true);
    callProc(procName, para)
      .then((res) => !cancelled && setRows(res.table))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [dataSource, procName, para]);

  const handleChange = (e) => {
    const idx = e.target.selectedIndex - (allowEmpty ? 1 : 0);
    const row = idx >= 0 ? rows[idx] : null;
    setValue(row ? row[valueField] : null, row);
  };

  return (
    <CyberField {...props} htmlFor={id} error={props.error || error}>
      <select id={id} className="cy-input" disabled={disabled || loading}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={handleChange}>
        {allowEmpty && <option value="">{loading ? 'Đang tải...' : emptyText}</option>}
        {rows.map((r, i) => (
          <option key={i} value={String(r[valueField])}>
            {showValue ? `${r[valueField]} - ${r[displayField]}` : r[displayField]}
          </option>
        ))}
      </select>
    </CyberField>
  );
}
