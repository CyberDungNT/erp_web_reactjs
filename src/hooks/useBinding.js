import { useCallback } from 'react';
import { reportError } from '@/utils/errorReporter';

/**
 * Hook nội bộ của các control: hỗ trợ 2 kiểu binding.
 *
 *  1) Bind vào object:   <CyberTextBox data={obj} setData={setObj} field="MaKH" />
 *                        (hoặc {...form.bind('MaKH')})
 *  2) Controlled thường: <CyberTextBox value={x} onChange={setX} />
 *
 * Trả về [giá trị hiện tại, hàm set]. Hàm set luôn gọi thêm onChange nếu có.
 */
export function useBinding(props, fieldName = 'field') {
  const { data, setData, value, onChange } = props;
  const field = props[fieldName];
  const isBound = !!field && (data !== undefined || setData !== undefined);
  const current = isBound ? data?.[field] : value;
  if (import.meta.env.DEV && isBound) checkBinding(data, setData, field);

  const setValue = useCallback(
    (v, extra) => {
      if (isBound && setData) setData((prev) => ({ ...(prev || {}), [field]: v }));
      onChange?.(v, extra);
    },
    [isBound, setData, field, onChange]
  );

  return [current, setValue];
}

/** Phát hiện bind sai thường gặp -> toast (chỉ khi dev, mỗi lỗi 1 lần nhờ chống lặp của reportError) */
function checkBinding(data, setData, field) {
  if (data !== undefined && data !== null && typeof data !== 'object') {
    reportError(`Control bind field '${field}' nhưng data không phải object (${typeof data}).`, { source: 'binding' });
  } else if (!setData) {
    reportError(`Control bind field '${field}' nhưng thiếu setData – nhập liệu sẽ không cập nhật được form.`, { source: 'binding' });
  }
}

/** Gán thêm 1 field phụ vào object bind (vd: lookup lưu cả TenKH). */
export function useExtraField(props, fieldName) {
  const { data, setData } = props;
  const field = props[fieldName];
  const current = field ? data?.[field] : undefined;
  const setValue = useCallback(
    (v) => {
      if (field && setData) setData((prev) => ({ ...(prev || {}), [field]: v }));
    },
    [field, setData]
  );
  return [current, setValue, !!field];
}
