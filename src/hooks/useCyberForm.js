import { useCallback, useState } from 'react';

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
    (field, extra = {}) => ({ data, setData, field, ...extra }),
    [data]
  );

  const reset = useCallback(() => setData(initialData), [initialData]);

  return { data, setData, setField, bind, reset };
}
