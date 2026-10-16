import { useCallback, useState } from 'react';
import { reportError } from '@/utils/errorReporter';

/**
 * Quản lý dữ liệu form + two-way binding cho các control Cyber*.
 *
 *   const form = useCyberForm({ MaKH: '', SoLuong: 0 });
 *   <CyberTextBox {...form.bind('MaKH')} label="Mã KH" />
 *
 *   form.data            -> object dữ liệu hiện tại
 *   form.setField(f, v)  -> gán giá trị từ code, control tự cập nhật
 *   form.setData(obj)    -> gán lại toàn bộ
 *   form.reset()         -> về giá trị ban đầu
 */
export function useCyberForm(initial = {}) {
  const [initialData] = useState(initial);
  const [data, setData] = useState(initial);

  const setField = useCallback((field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const bind = useCallback(
    (field, extra = {}) => {
      // Dev: bind tới field không có trong dữ liệu form -> thường là gõ sai tên field
      if (import.meta.env.DEV && (!field || (data && Object.keys(data).length && !(field in data) && !(field in initialData)))) {
        reportError(field ? `form.bind('${field}'): field không có trong dữ liệu form (sai tên hoặc chưa khai báo giá trị ban đầu).` : 'form.bind() thiếu tên field.',
          { source: 'binding', type: 'warning' });
      }
      return { data, setData, field, ...extra };
    },
    [data, initialData]
  );

  const reset = useCallback(() => setData(initialData), [initialData]);

  return { data, setData, setField, bind, reset };
}
