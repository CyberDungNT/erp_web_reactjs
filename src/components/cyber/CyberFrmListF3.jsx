import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useCyberForm } from '@/hooks/useCyberForm';
import Icon from '@/components/icons/Icon';
import CyberPopup from './CyberPopup';
import { msgbox } from './CyberMsgBox';
import { toast } from './CyberToast';

/**
 * FORM GỐC SỬA / THÊM MỚI DANH MỤC (F3) – mọi form chỉnh sửa của danh mục "kế thừa" form này.
 *
 * Màn danh mục (screens/ListScreen) bấm Mới / Sửa -> lấy FormInPut ở bảng cấu hình CP_SysList (vd 'DMTK0')
 *   -> mở file cùng tên trong src/modules (vd src/modules/dm/DMTK0.jsx) và truyền props:
 *      { mode: 'new' | 'edit' | 'view', row, list: { code, title, config, fields }, onClose, onSaved }
 *      (mode 'view' = Xem bản ghi (F2): mọi ô chỉ đọc, không có nút Lưu)
 *      (fields = tên các cột dữ liệu danh mục – thêm mới thì form khởi tạo đủ các cột này, rỗng)
 *
 * Form con chỉ cần vẽ phần ô nhập, còn popup, nút Lưu / Quay ra (góc dưới), Ctrl+S, hỏi khi thoát mà chưa lưu,
 * khoá nút khi đang lưu, toast lỗi... đã có sẵn ở đây:
 *
 *   export default function DMTK0(props) {
 *     return (
 *       <CyberFrmListF3 {...props} width={720}
 *         validate={(d) => (!d.Tk0 ? 'Chưa nhập tài khoản' : null)}
 *         onSave={(data, ctx) => callProc('CP_...', [...])}>
 *         {(form, ctx) => (
 *           <div className="grid grid--2">
 *             <CyberTextBox {...form.bind('Tk0')} label="Tài khoản" readOnly={!ctx.isNew} />
 *           </div>
 *         )}
 *       </CyberFrmListF3>
 *     );
 *   }
 *
 * Props (ngoài các props ListScreen truyền vào – nhớ {...props}):
 *   children   (form, ctx) => JSX  – ctx: { mode, isNew, isView, row, list, user, close }
 *   onSave     async (data, ctx) => ... – lỗi thì throw (toast tự hiện), xong -> toast thành công, gọi onSaved, đóng popup
 *              (trả về kết quả callProc: có bảng Status = N thì coi là lỗi, báo Note)
 *   validate   (data, ctx) => chuỗi lỗi | null – có lỗi thì báo toast, không lưu
 *   defaults   giá trị mặc định khi thêm mới (object hoặc hàm (ctx) => object)
 *   title, width (mặc định 640), height, keepOpen (lưu xong không đóng – thêm liên tục)
 */
export default function CyberFrmListF3({
  mode = 'new', row, list, onClose, onSaved,
  children, onSave, validate, defaults, title, width = 640, height, keepOpen = false,
}) {
  const { user } = useAuth();
  const isNew = mode === 'new';
  const isView = mode === 'view';
  const ctxBase = { mode, isNew, isView, row, list, user };
  // Thêm mới: đủ mọi cột của danh mục (rỗng) + defaults – để form.bind nhận ra field
  const blank = () => Object.fromEntries((list?.fields || []).map((f) => [f, '']));
  const freshNew = () => ({ ...blank(), ...(typeof defaults === 'function' ? defaults(ctxBase) : defaults) });
  const start = isNew ? freshNew() : { ...row };
  const form = useCyberForm(start, { draft: false });
  const [saving, setSaving] = useState(false);
  const firstData = useRef(form.data);
  const dirty = form.data !== firstData.current;

  const close = useCallback(async () => {
    if (saving) return;
    if (dirty) {
      const ok = await msgbox.yesNo('Dữ liệu đã thay đổi nhưng chưa lưu. Quay ra và bỏ thay đổi?', { title: title || list?.title });
      if (!ok) return;
    }
    onClose?.();
  }, [saving, dirty, onClose, title, list]);

  const ctx = { ...ctxBase, close };

  const save = async () => {
    if (saving) return;
    const err = validate?.(form.data, ctx);
    if (err) return toast.warning(err);
    if (!onSave) return toast.error(`Form ${list?.config?.FormInPut || ''} chưa khai báo onSave (thủ tục lưu).`);
    setSaving(true);
    try {
      const res = await onSave(form.data, ctx);
      // Kết quả callProc có bảng Status = N -> thủ tục từ chối: báo Note, giữ popup
      const st = res?.tables?.find((t) => t?.[0] && 'Status' in t[0])?.[0];
      if (st && String(st.Status).trim().toUpperCase() === 'N') throw new Error(String(st.Note || 'Không lưu được dữ liệu.'));
      toast.success(isNew ? 'Đã thêm mới.' : 'Đã lưu thay đổi.');
      onSaved?.(form.data, res);
      if (keepOpen && isNew) {
        const fresh = freshNew();
        form.setData(fresh);
        firstData.current = fresh;
      } else {
        firstData.current = form.data;
        onClose?.();
      }
    } catch (e) {
      toast.error(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S: lưu (chỉ popup trên cùng)
  const isViewRef = useRef(isView);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      const all = document.querySelectorAll('.cy-popup');
      if (!all.length || !all[all.length - 1].classList.contains('f3')) return;
      e.preventDefault();
      if (!isViewRef.current) saveRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const heading = title || `${isNew ? 'Thêm mới' : isView ? 'Xem' : 'Sửa'} – ${list?.title || ''}`;

  return (
    <CyberPopup open onClose={close} title={heading} width={width} height={height} className={`f3 ${saving ? 'is-busy' : ''}`}
      footer={(
        <div className="f3__foot">
          <span className="f3__hint">{dirty ? 'Có thay đổi chưa lưu' : ''}</span>
          {!isView && <button type="button" className="cy-btn cy-btn--primary f3__btn" onClick={save} disabled={saving} title="Lưu (Ctrl+S)">
            <Icon name={saving ? 'refresh' : 'tick'} size={15} className={saving ? 'cf__spin' : ''} />
            <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
          </button>}
          <button type="button" className="cy-btn f3__btn" onClick={close} disabled={saving} title="Quay ra (Esc)">
            <Icon name="exit" size={15} /><span>Quay ra</span>
          </button>
        </div>
      )}>
      <span className="cf__progress" aria-hidden="true" />
      <fieldset className={`f3__body ${isView ? "is-view" : ""}`} disabled={saving || isView}>
        {typeof children === 'function' ? children(form, ctx) : children}
      </fieldset>
    </CyberPopup>
  );
}
