import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/icons/Icon';
import { useAuth } from '@/auth/AuthContext';
import { getLastLogin, getUnits, setLastLogin } from '@/auth/authService';
import { msgbox } from '@/components/cyber';

/**
 * Thẻ "ĐƠN VỊ LÀM VIỆC" ở đáy menu trái.
 * Bấm -> danh sách đơn vị (CP_SysGetUnits). Chọn đơn vị khác -> đăng xuất, màn đăng nhập điền sẵn đơn vị mới
 * (đổi đơn vị phải đăng nhập lại vì quyền + menu khác nhau theo đơn vị).
 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function UnitSwitcher({ collapsed }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(null);
  const [error, setError] = useState(null);
  const [kw, setKw] = useState('');
  const ref = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (!units) {
      getUnits(user?.User_name || '')
        .then((r) => setUnits(r.units))
        .catch((e) => setError(e.message));
    }
    const close = (e) => { if (!ref.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open, units, user?.User_name]);

  const shown = useMemo(() => {
    const k = norm(kw.trim());
    return (units || []).filter((u) => !k || norm(u.Ten_TTCP).includes(k) || norm(u.Ma_TTCP).includes(k));
  }, [units, kw]);

  const pick = async (u) => {
    if (String(u.Ma_TTCP) === String(user?.Ma_TTCP)) return setOpen(false);
    setOpen(false);
    const ok = await msgbox.yesNo(`Chuyển sang đơn vị "${u.Ten_TTCP}"?`, {
      title: 'Đổi đơn vị làm việc', detail: 'Bạn cần đăng nhập lại để tải quyền và menu của đơn vị mới.',
    });
    if (!ok) return;
    setLastLogin({ ...getLastLogin(), userName: user?.User_name, maTTCP: u.Ma_TTCP });
    logout();
  };

  let lastGroup;
  return (
    <div className={`unit ${collapsed ? 'unit--collapsed' : ''}`} ref={ref}>
      <button type="button" className={`unit__card ${open ? 'is-open' : ''}`}
        onClick={(e) => {
          // bảng chọn đặt ngay trên thẻ, hiển thị bằng portal để không bị menu trái cắt mất
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ left: r.left, bottom: window.innerHeight - r.top + 6, width: Math.max(r.width, 300) });
          setOpen((v) => !v);
        }}
        title={`${user?.Ten_TTCP} (${user?.Ma_TTCP})`} aria-expanded={open}>
        <span className="unit__icon"><Icon name="briefcase" size={18} /></span>
        {/* Luôn dựng phần chữ, ẩn bằng CSS khi thu gọn -> co/giãn menu không làm chữ bị ép xuống dòng */}
        <span className="unit__text" aria-hidden={collapsed || undefined}>
          <small>ĐƠN VỊ LÀM VIỆC</small>
          <b>{user?.Ten_TTCP}</b>
        </span>
        <Icon name="chevronUpDown" size={16} className="unit__chev" />
      </button>
      {open && pos && createPortal(
        <div className="unit__pop" role="listbox" ref={popRef} style={pos}>
          <div className="unit__pop-head">
            <Icon name="search" size={14} />
            <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Tìm đơn vị..." />
          </div>
          <div className="unit__list">
            {!units && !error && <div className="unit__empty">Đang tải...</div>}
            {error && <div className="unit__empty cy-text-danger">{error}</div>}
            {units && !shown.length && <div className="unit__empty">Không tìm thấy</div>}
            {shown.map((u) => {
              const head = u.Ma_Dvcs !== lastGroup ? (lastGroup = u.Ma_Dvcs) : null;
              const cur = String(u.Ma_TTCP) === String(user?.Ma_TTCP);
              return (
                <div key={u.Ma_TTCP}>
                  {head != null && <div className="unit__group">Đơn vị cơ sở {head}</div>}
                  <button type="button" role="option" aria-selected={cur} className={`unit__opt ${cur ? 'is-current' : ''}`} onClick={() => pick(u)}>
                    <span>{u.Ten_TTCP}</span>
                    {cur ? <Icon name="tick" size={15} strokeWidth={2.4} /> : <small>{u.Ma_TTCP}</small>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
