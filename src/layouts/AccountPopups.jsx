import { useEffect, useRef, useState } from 'react';
import { CyberCheckBox, CyberPopup, CyberTextBox, msgbox, toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { useAuth } from '@/auth/AuthContext';
import { ACCOUNT_PROCS, changePassword, updateAvatar } from '@/auth/authService';
import { fileUrl, uploadFile } from '@/api/fileApi';
import AvatarImage from './AvatarImage';
import './account.css';

/**
 * Popup tài khoản mở từ menu avatar (MainLayout):
 *   ChangePasswordPopup – đổi mật khẩu (CP_SysChangePassword – authService.changePassword)
 *   AvatarPopup         – đổi ảnh đại diện: chọn ảnh -> cắt vuông 256px -> tải lên API file -> lưu Url_Avatar (CP_SysUpdateAvatar)
 * Lỗi / cảnh báo: toast.
 */

// ===================== Đổi mật khẩu =====================
export function ChangePasswordPopup({ open, onClose }) {
  const { user, lang } = useAuth();
  const E = lang === 'E';
  const [data, setData] = useState({ Old: '', New: '', Confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setData({ Old: '', New: '', Confirm: '' }); setShow(false); } }, [open]);

  const min = ACCOUNT_PROCS.minPasswordLength;
  const strength = scorePassword(data.New);

  const submit = async () => {
    if (busy) return;
    if (!data.Old) return toast.warning(E ? 'Enter your current password.' : 'Nhập mật khẩu hiện tại.');
    if ((data.New || '').length < min) return toast.warning(E ? `New password must be at least ${min} characters.` : `Mật khẩu mới phải có ít nhất ${min} ký tự.`);
    if (data.New === data.Old) return toast.warning(E ? 'New password must differ from the current one.' : 'Mật khẩu mới phải khác mật khẩu hiện tại.');
    if (data.New !== data.Confirm) return toast.warning(E ? 'Password confirmation does not match.' : 'Nhập lại mật khẩu mới không khớp.');
    setBusy(true);
    try {
      const note = await changePassword(user, data.Old, data.New);
      toast.success(note && !/^ok$/i.test(note) ? note : (E ? 'Password changed.' : 'Đã đổi mật khẩu.'));
      onClose();
    } catch (err) {
      toast.error(err?.message || String(err), { title: E ? 'Change password' : 'Đổi mật khẩu' });
    } finally { setBusy(false); }
  };

  const bind = (field) => ({ data, setData, field });
  const type = show ? 'text' : 'password';
  return (
    <CyberPopup open={open} onClose={busy ? undefined : onClose} title={E ? 'Change password' : 'Đổi mật khẩu'} width={460} className="acc-pop"
      footer={(
        <>
          <button type="button" className="cy-btn cy-btn--primary" onClick={submit} disabled={busy}>
            <Icon name={busy ? 'refresh' : 'tick'} size={15} className={busy ? 'cf__spin' : ''} /> {E ? 'Save' : 'Lưu'}
          </button>
          <button type="button" className="cy-btn" onClick={onClose} disabled={busy}><Icon name="exit" size={15} /> {E ? 'Cancel' : 'Quay ra'}</button>
        </>
      )}>
      <form className="acc-pw" onSubmit={(e) => { e.preventDefault(); submit(); }} autoComplete="off">
        <p className="acc-pw__who"><Icon name="user" size={15} /> {user?.User_name}</p>
        <CyberTextBox {...bind('Old')} type={type} label={E ? 'Current password' : 'Mật khẩu hiện tại'} labelWidth={150} autoFocus autoComplete="current-password" />
        <CyberTextBox {...bind('New')} type={type} label={E ? 'New password' : 'Mật khẩu mới'} labelWidth={150} autoComplete="new-password" />
        <div className="acc-pw__meter" data-level={strength.level} aria-hidden={!data.New}>
          <span /><span /><span /><span />
          <em>{data.New ? strength.text[E ? 1 : 0] : (E ? `At least ${min} characters` : `Ít nhất ${min} ký tự`)}</em>
        </div>
        <CyberTextBox {...bind('Confirm')} type={type} label={E ? 'Confirm password' : 'Nhập lại mật khẩu mới'} labelWidth={150} autoComplete="new-password"
          onEnter={submit} />
        <CyberCheckBox value={show} onChange={setShow} text={E ? 'Show passwords' : 'Hiện mật khẩu'} label=" " labelWidth={150} />
        <button type="submit" hidden />
      </form>
    </CyberPopup>
  );
}

/** Độ mạnh mật khẩu 0..4 (độ dài, chữ hoa / thường, số, ký tự đặc biệt) */
function scorePassword(pw = '') {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const text = [['Rất yếu', 'Very weak'], ['Yếu', 'Weak'], ['Trung bình', 'Fair'], ['Mạnh', 'Strong'], ['Rất mạnh', 'Very strong']][s];
  return { level: s, text };
}

// ===================== Ảnh đại diện =====================
const AVATAR_SIZE = 256;     // ảnh lưu: vuông 256 x 256
const MAX_INPUT_MB = 10;     // ảnh chọn từ máy tối đa

/** Cắt giữa thành hình vuông + thu về AVATAR_SIZE -> Blob JPEG */
function squareCrop(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = AVATAR_SIZE; c.height = AVATAR_SIZE;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff'; g.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE); // ảnh PNG trong suốt -> nền trắng
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Không xử lý được ảnh.'))), 'image/jpeg', 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File không phải ảnh hợp lệ.')); };
    img.src = url;
  });
}

export function AvatarPopup({ open, onClose, initial }) {
  const { user, lang, updateUser } = useAuth();
  const E = lang === 'E';
  const [blob, setBlob] = useState(null);     // ảnh mới đã cắt (chưa lưu)
  const [preview, setPreview] = useState(''); // object URL của ảnh mới
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (open) { setBlob(null); setPreview(''); } }, [open]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.warning(E ? 'Choose an image file (jpg, png, webp...).' : 'Chọn file ảnh (jpg, png, webp...).');
    if (file.size > MAX_INPUT_MB * 1024 * 1024) return toast.warning(E ? `Image must be under ${MAX_INPUT_MB} MB.` : `Ảnh phải nhỏ hơn ${MAX_INPUT_MB} MB.`);
    try {
      const b = await squareCrop(file);
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch (err) { toast.error(err.message); }
  };

  const save = async () => {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const file = new File([blob], `avatar-${user?.User_name || 'user'}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const [saved] = await uploadFile(file, { user: user?.User_name, silent: true });
      const url = fileUrl(saved);
      await updateAvatar(user, url);
      updateUser({ Url_Avatar: url });
      toast.success(E ? 'Profile picture updated.' : 'Đã đổi ảnh đại diện.');
      onClose();
    } catch (err) {
      toast.error(err?.message || String(err), { title: E ? 'Profile picture' : 'Ảnh đại diện' });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (busy) return;
    const ok = await msgbox.yesNo(E ? 'Remove your profile picture?' : 'Bỏ ảnh đại diện hiện tại?', { title: E ? 'Profile picture' : 'Ảnh đại diện', yesText: E ? 'Remove' : 'Bỏ ảnh', noText: E ? 'Cancel' : 'Huỷ', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await updateAvatar(user, '');
      updateUser({ Url_Avatar: '' });
      toast.success(E ? 'Profile picture removed.' : 'Đã bỏ ảnh đại diện.');
      onClose();
    } catch (err) {
      toast.error(err?.message || String(err), { title: E ? 'Profile picture' : 'Ảnh đại diện' });
    } finally { setBusy(false); }
  };

  const current = user?.Url_Avatar;
  return (
    <CyberPopup open={open} onClose={busy ? undefined : onClose} title={E ? 'Profile picture' : 'Ảnh đại diện'} width={440} className="acc-pop"
      footer={(
        <>
          {current && !blob && (
            <button type="button" className="cy-btn cy-btn--danger acc-av__remove" onClick={remove} disabled={busy}><Icon name="trash" size={15} /> {E ? 'Remove' : 'Bỏ ảnh'}</button>
          )}
          <button type="button" className="cy-btn cy-btn--primary" onClick={save} disabled={!blob || busy}>
            <Icon name={busy ? 'refresh' : 'tick'} size={15} className={busy ? 'cf__spin' : ''} /> {busy ? (E ? 'Uploading...' : 'Đang tải lên...') : (E ? 'Save' : 'Lưu')}
          </button>
          <button type="button" className="cy-btn" onClick={onClose} disabled={busy}><Icon name="exit" size={15} /> {E ? 'Cancel' : 'Quay ra'}</button>
        </>
      )}>
      <div className="acc-av">
        <div className={`acc-av__drop ${drag ? 'is-drag' : ''}`}
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
          role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          title={E ? 'Choose image' : 'Chọn ảnh'}>
          <span className="acc-av__circle">
            {preview ? <img src={preview} alt="" /> : <AvatarImage url={current} initial={initial} />}
          </span>
          <span className="acc-av__cam"><Icon name="upload" size={16} /></span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <p className="acc-av__hint">
          {preview
            ? (E ? 'Preview – click Save to apply.' : 'Ảnh xem trước – bấm Lưu để dùng ảnh này.')
            : (E ? 'Click or drop an image here. It will be cropped to a square.' : 'Bấm hoặc kéo thả ảnh vào đây. Ảnh tự cắt thành hình vuông.')}
        </p>
        <button type="button" className="cy-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="folder" size={15} /> {E ? 'Choose image...' : 'Chọn ảnh từ máy...'}
        </button>
      </div>
    </CyberPopup>
  );
}
