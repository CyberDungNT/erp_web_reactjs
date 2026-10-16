import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { reportError } from '@/utils/errorReporter';
import { loadDraft, notifyRestored, removeDraft, saveDraft } from '@/utils/draftStore';
import { useScreen } from './screenContext';

const SAVE_DELAY_MS = 300; // gõ xong ~0,3 giây thì lưu nháp

/**
 * Quản lý dữ liệu form + two-way binding cho các control Cyber*.
 *
 *   const form = useCyberForm({ MaKH: '', SoLuong: 0 });
 *   <CyberTextBox {...form.bind('MaKH')} label="Mã KH" />
 *
 *   form.data            -> object dữ liệu hiện tại
 *   form.setField(f, v)  -> gán 1 field
 *   form.setData(obj)    -> gán lại toàn bộ (dữ liệu "sạch": vd vừa tải từ server / vừa lưu xong)
 *   form.reset()         -> về giá trị ban đầu + xoá bản nháp
 *
 * BẢN NHÁP TỰ ĐỘNG (giữ dữ liệu đang nhập khi F5 / mất mạng / phải đăng nhập lại):
 *   Form nằm trong 1 chức năng của màn chính -> những gì người dùng NHẬP (khác dữ liệu "sạch") được lưu nháp
 *   (mã hoá, sessionStorage của tab – xem utils/draftStore.js). Mở lại chức năng -> tự khôi phục + toast "Bỏ bản nháp".
 *   Lưu chứng từ xong: gọi form.setData(...) / form.reset() / form.markClean() -> bản nháp tự xoá.
 *
 * options:
 *   draft: false        -> tắt bản nháp cho form này (vd form tìm kiếm, form chứa mật khẩu)
 *                          (form khởi tạo rỗng {} – popup sửa dòng – mặc định KHÔNG lưu nháp; draft: true để bật)
 *   draftKey            -> tên riêng khi 1 màn có 2 form trùng danh sách field
 *   deferRestore        -> không tự khôi phục khi mở; tự gọi form.restoreDraft() (CyberForm: sau khi onLoad xong)
 *   extra / onRestoreExtra -> lưu kèm dữ liệu ngoài form (CyberForm dùng cho draftVars, vd danh sách dòng chi tiết)
 */
export function useCyberForm(initial = {}, options = {}) {
  const [initialData] = useState(initial);
  // Mặc định: form khai báo field ban đầu thì lưu nháp; form rỗng {} (thường là popup sửa dòng, nạp dữ liệu khi mở) thì không
  const { draft = Object.keys(initialData).length > 0, draftKey, deferRestore = false, extra, onRestoreExtra } = options;
  const [data, setRaw] = useState(initial);
  const screen = useScreen();
  const { user } = useAuth();

  // Khoá nháp: tài khoản + chức năng + danh sách field (không phụ thuộc thứ tự cửa sổ / số lần render)
  const key = draft && screen?.id && user?.User_name
    ? `${user.User_name}:${screen.id}:${draftKey || Object.keys(initialData).sort().join(',') || '_'}`
    : null;

  // "Sạch" = ban đầu / do code gán. Khác "sạch" mới là người dùng đang nhập dở -> mới lưu nháp.
  const baseline = useRef({ data: initial, extra: extra ?? null });
  const current = useRef({ data, extra: extra ?? null });
  current.current = { data, extra: extra ?? null };
  const ready = useRef(!key); // đã thử khôi phục chưa – trước đó không được ghi đè bản nháp đang có
  const onRestoreExtraRef = useRef(onRestoreExtra);
  onRestoreExtraRef.current = onRestoreExtra;

  /** Gán dữ liệu từ code = dữ liệu sạch */
  const setData = useCallback((v) => {
    setRaw((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      baseline.current = { ...baseline.current, data: next };
      return next;
    });
  }, []);

  const setField = useCallback((field, value) => {
    setRaw((prev) => ({ ...prev, [field]: value }));
  }, []);

  const bind = useCallback(
    (field, more = {}) => {
      // Dev: bind tới field không có trong dữ liệu form -> thường là gõ sai tên field
      if (import.meta.env.DEV && (!field || (data && Object.keys(data).length && !(field in data) && !(field in initialData)))) {
        reportError(field ? `form.bind('${field}'): field không có trong dữ liệu form (sai tên hoặc chưa khai báo giá trị ban đầu).` : 'form.bind() thiếu tên field.',
          { source: 'binding', type: 'warning' });
      }
      // control nhận setRaw: người dùng nhập -> KHÔNG phải dữ liệu sạch -> được lưu nháp
      return { data, setData: setRaw, field, ...more };
    },
    [data, initialData]
  );

  /** Coi dữ liệu hiện tại là "sạch" (vd vừa lưu chứng từ xong) -> xoá bản nháp */
  const markClean = useCallback(() => {
    baseline.current = { ...current.current };
    // Chưa thử khôi phục (CyberForm: markClean ngay sau onLoad rồi mới restoreDraft) -> KHÔNG được xoá bản nháp đang chờ
    if (key && ready.current) removeDraft(key);
  }, [key]);

  const reset = useCallback(() => {
    setRaw(initialData);
    baseline.current = { data: initialData, extra: baseline.current.extra };
    if (key) removeDraft(key);
  }, [initialData, key]);

  /** Khôi phục bản nháp (nếu có). Trả về true nếu đã khôi phục. */
  const restoreDraft = useCallback(async () => {
    if (!key) { ready.current = true; return false; }
    const saved = await loadDraft(key);
    ready.current = true;
    if (!saved || JSON.stringify(saved) === JSON.stringify(baseline.current)) return false;
    setRaw(saved.data);
    if (saved.extra != null) onRestoreExtraRef.current?.(saved.extra);
    notifyRestored(() => {
      setRaw(baseline.current.data);
      if (baseline.current.extra != null) onRestoreExtraRef.current?.(baseline.current.extra);
      removeDraft(key);
    });
    return true;
  }, [key]);

  // Mở chức năng -> tự khôi phục (CyberForm thì đợi onLoad xong mới khôi phục: deferRestore)
  useEffect(() => {
    if (!deferRestore) restoreDraft();
  }, [restoreDraft, deferRestore]);

  // Người dùng nhập -> lưu nháp (giãn cách); trở lại giống dữ liệu sạch -> xoá nháp
  const extraJson = extra === undefined ? '' : JSON.stringify(extra);
  useEffect(() => {
    if (!key || !ready.current) return undefined;
    const t = setTimeout(() => {
      const snap = current.current;
      if (JSON.stringify(snap) === JSON.stringify(baseline.current)) removeDraft(key);
      else saveDraft(key, snap);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [key, data, extraJson]);

  return { data, setData, setField, bind, reset, markClean, restoreDraft };
}
